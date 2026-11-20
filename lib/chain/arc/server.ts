/** ARCHIVED: the Arc testnet settlement, preserved but unused since the Solana port (see lib/chain/server.ts).
 *
 * Server-side Arc testnet access. Private keys are read from environment
 * variables and never leave the server. Three roles, three keys:
 *   UNDERWRITER_PRIVATE_KEY  owns the vault, deposits collateral, opens policies
 *   ORACLE_PRIVATE_KEY       attests the index for a period (cannot move funds)
 *   BENEFICIARY_PRIVATE_KEY  demo wallet for the business; only used to recycle
 *                            testnet funds back into the vault
 */
import { BaseError, ContractFunctionRevertedError, createPublicClient, createWalletClient, decodeEventLog, formatUnits, http, keccak256, toHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { vaultAbi } from "./abi";
import { arcTestnet, DEMO_SCALE, erc20Abi, EXPLORER, INDEX_LABEL, USDC_ADDRESS, VAULT_ADDRESS } from "./config";
import { REGIONS, SERIES, monthlyMean } from "../../engine/series";

export const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });

const account = (name: string) => {
  const k = process.env[name];
  return k && /^0x[0-9a-fA-F]{64}$/.test(k) ? privateKeyToAccount(k as Hex) : null;
};
export const roles = () => ({ underwriter: account("UNDERWRITER_PRIVATE_KEY"), oracle: account("ORACLE_PRIVATE_KEY"), beneficiary: account("BENEFICIARY_PRIVATE_KEY") });
const wallet = (acct: NonNullable<ReturnType<typeof account>>) => createWalletClient({ account: acct, chain: arcTestnet, transport: http() });
const usdc = (a: `0x${string}`) => publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [a] });
const fmt = (x: bigint) => Number(formatUnits(x, 6));

export interface ChainStatus {
  configured: boolean; reason?: string; chainId: number; explorer: string; vault: string | null; usdc: string; scale: number;
  owner?: string; oracle?: string; beneficiary?: string; canSettle?: boolean;
  vaultBalance?: number; reserved?: number; freeCollateral?: number; beneficiaryBalance?: number; policies?: number; block?: number;
}

export async function chainStatus(): Promise<ChainStatus> {
  const base = { chainId: arcTestnet.id, explorer: EXPLORER, vault: VAULT_ADDRESS, usdc: USDC_ADDRESS, scale: DEMO_SCALE };
  if (!VAULT_ADDRESS) return { ...base, configured: false, reason: "No vault address is configured. Deploy with `npm run chain -- deploy`." };
  try {
    const r = roles();
    const v = { address: VAULT_ADDRESS, abi: vaultAbi } as const;
    const [owner, oracle, reserved, next, bal, block] = await Promise.all([
      publicClient.readContract({ ...v, functionName: "owner" }), publicClient.readContract({ ...v, functionName: "oracle" }),
      publicClient.readContract({ ...v, functionName: "reserved" }), publicClient.readContract({ ...v, functionName: "nextPolicyId" }),
      usdc(VAULT_ADDRESS), publicClient.getBlockNumber(),
    ]);
    const beneficiary = r.beneficiary?.address ?? process.env.BENEFICIARY_ADDRESS;
    return {
      ...base, configured: true, owner, oracle, beneficiary, block: Number(block),
      canSettle: !!r.underwriter && !!r.oracle && r.underwriter.address === owner && r.oracle.address === oracle && !!beneficiary,
      vaultBalance: fmt(bal), reserved: fmt(reserved), freeCollateral: fmt(bal - reserved), policies: Number(next) - 1,
      beneficiaryBalance: beneficiary ? fmt(await usdc(beneficiary as `0x${string}`)) : undefined,
    };
  } catch (e) {
    return { ...base, configured: false, reason: `Could not read the vault on Arc testnet: ${e instanceof Error ? e.message.split("\n")[0] : e}` };
  }
}

export function revertName(e: unknown): string {
  if (e instanceof BaseError) {
    const r = e.walk((x) => x instanceof ContractFunctionRevertedError);
    if (r instanceof ContractFunctionRevertedError) return `${r.data?.errorName ?? "revert"}(${(r.data?.args ?? []).join(", ")})`;
    return e.shortMessage;
  }
  return e instanceof Error ? e.message : String(e);
}

export interface SettlementRequest { region: string; inceptionMonth: string; settleMonth: string; strikeOffset: number; coveredGallons: number; maxCoveredGallons: number }
export type SettlementEvent =
  | { type: "step"; id: string; label: string; status: "running" | "done" | "rejected" | "error"; tx?: string; detail?: string }
  | { type: "result"; result: SettlementResult }
  | { type: "error"; message: string };
export interface SettlementResult {
  policyId: number; period: number; indexId: string; indexLabel: string; indexMean: number; strike: number; quantityMilli: number;
  payoutUsdc: number; payoutNotional: number; expectedUsdc: number; beneficiary: string; vault: string;
  txs: { open: string; settle: string; close: string }; block: number;
  beneficiaryBefore: number; beneficiaryAfter: number; duplicateRejection: string; strangerRejection: string; explorer: string;
}

const micro = (x: number) => BigInt(Math.round(x * 1e6));

/**
 * Opens a policy, has the oracle attest one month, and lets the contract pay.
 * The oracle does NOT trust the caller for prices: the index mean and the
 * strike are recomputed here from the bundled EIA series. The caller supplies
 * only which month to settle and the gallons read from the ledger.
 */
export async function* runSettlement(req: SettlementRequest): AsyncGenerator<SettlementEvent> {
  const step = (id: string, label: string, status: "running" | "done" | "rejected" | "error", extra: { tx?: string; detail?: string } = {}): SettlementEvent => ({ type: "step", id, label, status, ...extra });
  try {
    const r = roles();
    if (!VAULT_ADDRESS || !r.underwriter || !r.oracle) throw new Error("Onchain settlement is not configured on this server (vault address or keys missing).");
    const beneficiary = (r.beneficiary?.address ?? process.env.BENEFICIARY_ADDRESS) as `0x${string}` | undefined;
    if (!beneficiary) throw new Error("No beneficiary wallet configured.");
    const v = { address: VAULT_ADDRESS, abi: vaultAbi } as const;

    // 1. Oracle derives the trigger from public data.
    yield step("oracle", "Oracle reads the EIA index for the period", "running");
    const series = SERIES[(REGIONS[req.region] ?? REGIONS.PADD2).series];
    const idx = monthlyMean(series.points);
    const inception = idx.get(req.inceptionMonth), mean = idx.get(req.settleMonth);
    if (inception === undefined || mean === undefined) throw new Error(`No index data for ${req.inceptionMonth} or ${req.settleMonth}.`);
    if (!(req.strikeOffset >= 0 && req.strikeOffset <= 3)) throw new Error("Strike offset out of range.");
    if (!(req.coveredGallons > 0 && req.coveredGallons <= 50_000 && req.maxCoveredGallons > 0 && req.maxCoveredGallons <= 50_000)) throw new Error("Covered gallons out of range for the demo vault.");
    const strike = micro(inception + req.strikeOffset), indexPrice = micro(mean);
    const qty = BigInt(Math.round(req.coveredGallons)), maxQty = BigInt(Math.round(req.maxCoveredGallons)); // milli-units at 1:1000 demo scale
    const period = Number(req.settleMonth.replace("-", ""));
    const limit = (2_000_000n * maxQty) / 1000n; // one month of maximum payout at $2.00 per gallon above strike
    yield step("oracle", "Oracle reads the EIA index for the period", "done", { detail: `${series.title.split(",")[0]}: ${req.settleMonth} mean $${mean.toFixed(4)}; strike $${(inception + req.strikeOffset).toFixed(4)}` });

    // 2. Collateral check, recycling the demo beneficiary's testnet funds if the vault is short.
    yield step("collateral", "Check free collateral in the vault", "running");
    let free = await publicClient.readContract({ ...v, functionName: "freeCollateral" });
    if (free < limit && r.beneficiary) {
      const bal = await usdc(r.beneficiary.address);
      const keep = 200_000n; // leave gas money
      if (bal > keep + 10_000n) {
        const w = wallet(r.beneficiary), amt = bal - keep;
        await publicClient.waitForTransactionReceipt({ hash: await w.writeContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: "approve", args: [VAULT_ADDRESS, amt] }) });
        await publicClient.waitForTransactionReceipt({ hash: await w.writeContract({ ...v, functionName: "deposit", args: [amt] }) });
        free = await publicClient.readContract({ ...v, functionName: "freeCollateral" });
      }
    }
    yield step("collateral", "Check free collateral in the vault", "done", { detail: `${fmt(free).toFixed(2)} USDC free, ${fmt(limit).toFixed(2)} USDC needed to reserve` });

    // 3. Open the policy. The contract itself refuses if collateral is short.
    yield step("open", "Open policy and reserve its limit", "running");
    const owner = wallet(r.underwriter);
    const indexId = keccak256(toHex(INDEX_LABEL));
    const args = [beneficiary, indexId, strike, 20_000_000n, maxQty, period, period, limit] as const;
    try { await publicClient.simulateContract({ ...v, functionName: "openPolicy", args, account: r.underwriter }); }
    catch (e) { yield step("open", "Open policy and reserve its limit", "rejected", { detail: `Contract refused: ${revertName(e)}` }); throw new Error(`The vault refused to open the policy: ${revertName(e)}. Add testnet collateral with \`npm run chain -- deposit\`.`); }
    const openTx = await owner.writeContract({ ...v, functionName: "openPolicy", args });
    const openRc = await publicClient.waitForTransactionReceipt({ hash: openTx });
    let policyId = 0n;
    for (const log of openRc.logs) { try { const d = decodeEventLog({ abi: vaultAbi, data: log.data, topics: log.topics }); if (d.eventName === "PolicyOpened") policyId = d.args.policyId; } catch { /* other contract's log */ } }
    yield step("open", "Open policy and reserve its limit", "done", { tx: openTx, detail: `Policy #${policyId}, ${fmt(limit).toFixed(2)} USDC reserved for ${beneficiary.slice(0, 8)}…` });

    // 4. An unauthorised caller tries to settle. Simulated only, so no gas is spent.
    yield step("stranger", "Unauthorised settlement attempt", "running");
    let strangerRejection = "not rejected";
    try { await publicClient.simulateContract({ ...v, functionName: "settle", args: [policyId, period, 19_000_000n, maxQty], account: beneficiary }); }
    catch (e) { strangerRejection = revertName(e); }
    yield step("stranger", "Unauthorised settlement attempt", "rejected", { detail: `Beneficiary tried to self-settle at a made-up price. Contract: ${strangerRejection}` });

    // 5. Oracle attests; contract computes and pays.
    yield step("settle", "Oracle attests the index; contract computes and pays", "running");
    const before = await usdc(beneficiary);
    const expected = await publicClient.readContract({ ...v, functionName: "quote", args: [policyId, indexPrice, qty] });
    const settleTx = await wallet(r.oracle).writeContract({ ...v, functionName: "settle", args: [policyId, period, indexPrice, qty] });
    const rc = await publicClient.waitForTransactionReceipt({ hash: settleTx });
    let payout = 0n;
    for (const log of rc.logs) { try { const d = decodeEventLog({ abi: vaultAbi, data: log.data, topics: log.topics }); if (d.eventName === "PeriodSettled") payout = d.args.payout; } catch { /* USDC transfer log */ } }
    const after = await usdc(beneficiary);
    yield step("settle", "Oracle attests the index; contract computes and pays", "done", { tx: settleTx, detail: `${fmt(payout).toFixed(6)} USDC paid in block ${rc.blockNumber}` });

    // 6. Replay the same attestation. Simulated: the contract must refuse.
    yield step("duplicate", "Duplicate settlement attempt", "running");
    let duplicateRejection = "not rejected";
    try { await publicClient.simulateContract({ ...v, functionName: "settle", args: [policyId, period, indexPrice, qty], account: r.oracle }); }
    catch (e) { duplicateRejection = revertName(e); }
    yield step("duplicate", "Duplicate settlement attempt", "rejected", { detail: `Same period attested again. Contract: ${duplicateRejection}` });

    // 7. Close and release the unused reserve.
    yield step("close", "Close policy and release unused reserve", "running");
    const closeTx = await owner.writeContract({ ...v, functionName: "closePolicy", args: [policyId] });
    await publicClient.waitForTransactionReceipt({ hash: closeTx });
    yield step("close", "Close policy and release unused reserve", "done", { tx: closeTx, detail: `${fmt(limit - payout).toFixed(2)} USDC returned to free collateral` });

    yield { type: "result", result: {
      policyId: Number(policyId), period, indexId, indexLabel: INDEX_LABEL, indexMean: Number(indexPrice) / 1e6, strike: Number(strike) / 1e6, quantityMilli: Number(qty),
      payoutUsdc: fmt(payout), payoutNotional: fmt(payout) * DEMO_SCALE, expectedUsdc: fmt(expected), beneficiary, vault: VAULT_ADDRESS,
      txs: { open: openTx, settle: settleTx, close: closeTx }, block: Number(rc.blockNumber), beneficiaryBefore: fmt(before), beneficiaryAfter: fmt(after),
      duplicateRejection, strangerRejection, explorer: EXPLORER,
    } };
  } catch (e) {
    yield { type: "error", message: e instanceof Error ? e.message.split("\n")[0] : String(e) };
  }
}
