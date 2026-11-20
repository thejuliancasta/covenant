/**
 * Server-side settlement on Solana devnet with Helius Privacy Rings.
 * Node runtime only. Private keys are read on the server (lib/chain/keys.ts)
 * and never leave it. Roles:
 *   underwriter  funds each step vault privately; reclaims untriggered steps
 *   oracle       posts the EIA monthly mean with the data file's sha256 (cannot move funds)
 *   fleet        demo wallet for the business; signs releases and receives payouts privately
 *
 * The oracle does NOT trust the caller for prices: the index mean and the strike
 * are recomputed here from the bundled EIA series. The caller supplies only which
 * months to use and the gallons read from the ledger.
 */
import { createHash, randomBytes } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Address } from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { REGIONS, SERIES, monthlyMean } from "../engine/series";
import { capPayout } from "../engine/payout";
import { ASSET_ID, DEPLOYMENT, EXPLORER, INDEXES, MINT, PROGRAM_ID, RINGS_PROGRAM_ID, STEP_LIMIT, STEP_SIZE, fromBase, fromMilli, periodOf, rpcUrl, toBase, toMilli, toMilliCeil } from "./config";
import { keysDir, loadRole, roles, type Role } from "./keys";
import {
  decodeReport, errorName, fetchProgramAccount, firstSignature, getClient, hex, initStepIx, programAddress,
  reclaimIx, releaseIx, reportIndexIx, reportPda, send, simulate, solBalance, stepPda,
} from "./program";
import { newVaultKey, privateBalance, privateSend, proveVaultSpend, receivedIn } from "./rings";
import { SOLANA_NETWORK, type ChainStatus, type CoverStep, type SettlementEvent, type SettlementRequest, type SettlementResult, type StepStatus } from "./types";

export type { ChainStatus, SettlementEvent, SettlementRequest, SettlementResult } from "./types";

// ---------------------------------------------------------------- mutex
let busy: Promise<void> = Promise.resolve();
/** One settlement at a time: private note selection must not race. */
async function acquire(): Promise<() => void> {
  const prev = busy;
  let release!: () => void;
  busy = new Promise<void>((r) => (release = r));
  await prev;
  return release;
}

const base = () => ({ network: SOLANA_NETWORK, explorer: EXPLORER, programId: PROGRAM_ID, ringsProgramId: RINGS_PROGRAM_ID, mint: MINT });
const short = (e: unknown) => (e instanceof Error ? e.message : String(e)).split("\n")[0].slice(0, 400);

// ------------------------------------------------------------------ status
let statusCache: { at: number; value: ChainStatus } | undefined;

export async function chainStatus(): Promise<ChainStatus> {
  if (statusCache && Date.now() - statusCache.at < 20_000) return statusCache.value;
  const b = base();
  const r = roles();
  // Not configured means nothing settles from this server, so show the deployed program's public
  // role wallets (deployments/solana-devnet.json), not whatever keys happen to be on this machine.
  const notConfigured = (reason: string): ChainStatus => ({
    ...b, configured: false, reason,
    underwriter: DEPLOYMENT.underwriter ?? r.underwriter?.address, oracle: DEPLOYMENT.oracle ?? r.oracle?.address, fleet: DEPLOYMENT.fleet ?? r.fleet?.address,
  });
  if (!PROGRAM_ID) return notConfigured("No Solana program is configured. Run `npm run solana:setup`.");
  if (!MINT || !ASSET_ID) return notConfigured("No tUSD mint is configured. Run `npm run solana:setup`.");
  if (!rpcUrl()) return notConfigured("No Helius devnet RPC is configured on this server (HELIUS_API_KEY).");
  if (!r.underwriter || !r.oracle || !r.fleet) return notConfigured("This server does not hold the underwriter, oracle and fleet keys (SOLANA_*_KEY or .solana-keys/).");
  try {
    const client = await getClient();
    const prog = await client.solanaRpc.getAccountInfo(programAddress(), { encoding: "base64" }).send();
    if (!prog.value?.executable) return notConfigured(`Program ${PROGRAM_ID} is not deployed on devnet.`);
    const [uw, fl, policies] = await Promise.all([privateBalance(r.underwriter), privateBalance(r.fleet), countPolicies()]);
    const value: ChainStatus = {
      ...b, configured: true, underwriter: r.underwriter.address, oracle: r.oracle.address, fleet: r.fleet.address,
      underwriterPrivateBalance: fromBase(uw), fleetPrivateBalance: fromBase(fl), policies,
    };
    statusCache = { at: Date.now(), value };
    return value;
  } catch (e) {
    return notConfigured(`Could not read Solana devnet: ${short(e)}`);
  }
}

/** Distinct policies with step accounts under the program. */
async function countPolicies(): Promise<number> {
  const client = await getClient();
  const accts = await (client.solanaRpc as any)
    .getProgramAccounts(programAddress(), { encoding: "base64", dataSlice: { offset: 32, length: 8 }, filters: [{ dataSize: 104n }] })
    .send();
  return new Set((accts as any[]).map((a) => String(a.account.data[0]))).size;
}

// ------------------------------------------------------------- settlement
/** sha256 of the EIA series file the oracle used (falls back to its canonical JSON if the file is not on disk). */
function seriesHash(seriesId: string): string {
  let bytes: Buffer;
  try { bytes = readFileSync(resolve(process.cwd(), "lib/data", `${seriesId}.json`)); }
  catch { bytes = Buffer.from(JSON.stringify(SERIES[seriesId as keyof typeof SERIES])); }
  return createHash("sha256").update(bytes).digest("hex");
}

const SOL_TARGETS: Record<string, number> = { underwriter: 0.3, oracle: 0.05, fleet: 0.1 };
async function ensureSol(role: Role) {
  const want = SOL_TARGETS[role.name] ?? 0.05;
  const have = await solBalance(role.address);
  if (have >= want / 3) return have;
  const payer = loadRole("payer");
  if (!payer) throw new Error(`${role.name} ${role.address} has ${have.toFixed(4)} SOL; top it up on devnet (no payer key on this server).`);
  await send(payer.signer, [getTransferSolInstruction({ source: payer.signer, destination: role.address, amount: BigInt(Math.round((want - have) * 1e9)) })], { cu: 50_000, label: `top up ${role.name}` });
  return solBalance(role.address);
}

/** Best effort: keep step viewing keys on local disk so a crashed run's vaults can still be recovered. */
function remember(record: unknown) {
  try { mkdirSync(keysDir(), { recursive: true, mode: 0o700 }); appendFileSync(resolve(keysDir(), "policies.jsonl"), JSON.stringify(record) + "\n", { mode: 0o600 }); } catch { /* read-only host */ }
}

export async function* runSettlement(req: SettlementRequest): AsyncGenerator<SettlementEvent> {
  const step = (id: string, label: string, status: StepStatus, extra: { tx?: string; detail?: string; private?: boolean } = {}): SettlementEvent => ({ type: "step", id, label, status, ...extra });
  let release: (() => void) | undefined;
  try {
    // 1. Oracle derives the trigger from public data.
    const L1 = "Oracle reads the EIA index for the period";
    yield step("oracle", L1, "running");
    const region = REGIONS[req.region] ? req.region : "PADD2";
    const series = SERIES[REGIONS[region].series];
    const idx = monthlyMean(series.points);
    const inception = idx.get(req.inceptionMonth), mean = idx.get(req.settleMonth);
    if (inception === undefined || mean === undefined) throw new Error(`No index data for ${req.inceptionMonth} or ${req.settleMonth}.`);
    if (!(req.settleMonth > req.inceptionMonth)) throw new Error("The settlement month must be after the inception month.");
    if (!(req.strikeOffset >= 0 && req.strikeOffset <= 3)) throw new Error("Strike offset out of range.");
    if (!(req.coveredGallons > 0 && req.coveredGallons <= 50_000 && req.maxCoveredGallons > 0 && req.maxCoveredGallons <= 50_000)) throw new Error("Covered gallons out of range for the demo.");
    const index = INDEXES[region];
    const period = periodOf(req.settleMonth);
    const strike = inception + req.strikeOffset;
    const gallons = Math.min(req.coveredGallons, req.maxCoveredGallons);
    const nSteps = Math.round(STEP_LIMIT / STEP_SIZE);
    const stepAmountBase = toBase(STEP_SIZE * gallons);
    const terms = Array.from({ length: nSteps }, (_, i) => {
      const triggerPrice = strike + (i + 1) * STEP_SIZE;
      return { index: i + 1, triggerPrice, triggerMilli: toMilliCeil(triggerPrice) };
    });
    const sourceHash = seriesHash(series.id);
    const linearPayoutUsd = Math.min(capPayout(mean, strike, gallons), STEP_LIMIT * req.maxCoveredGallons);
    yield step("oracle", L1, "done", { detail: `${series.title.split(",")[0]}: ${req.settleMonth} mean $${mean.toFixed(4)}; strike $${strike.toFixed(4)}; ${nSteps} steps of $${STEP_SIZE.toFixed(2)}/gal; EIA file sha256 ${sourceHash.slice(0, 16)}…` });

    // 2. Wallets, SOL for fees, private tUSD balances (decrypted with each party's own key).
    const L2 = "Check wallets, SOL and private tUSD balances";
    yield step("setup", L2, "running");
    if (!PROGRAM_ID || !MINT || !ASSET_ID) throw new Error("Solana settlement is not configured on this server (run `npm run solana:setup`).");
    if (!rpcUrl()) throw new Error("No Helius devnet RPC is configured on this server (HELIUS_API_KEY).");
    const r = roles();
    if (!r.underwriter || !r.oracle || !r.fleet) throw new Error("This server does not hold the underwriter, oracle and fleet keys.");
    const { underwriter, oracle, fleet } = r as { underwriter: Role; oracle: Role; fleet: Role };
    release = await acquire();
    const [solU, solO, solF] = await Promise.all([ensureSol(underwriter), ensureSol(oracle), ensureSol(fleet)]);
    const [uwBefore, fleetBefore] = await Promise.all([privateBalance(underwriter), privateBalance(fleet)]);
    const totalFund = stepAmountBase * BigInt(nSteps);
    if (uwBefore < totalFund) throw new Error(`Underwriter private balance ${fromBase(uwBefore)} tUSD is below the ${fromBase(totalFund)} tUSD needed; run \`npm run solana:setup\`.`);
    yield step("setup", L2, "done", { private: true, detail: `SOL: underwriter ${solU.toFixed(3)}, oracle ${solO.toFixed(3)}, fleet ${solF.toFixed(3)}. Private tUSD (decrypted by each owner): underwriter ${fromBase(uwBefore).toLocaleString("en-US")}, fleet ${fromBase(fleetBefore).toLocaleString("en-US")}` });

    // 3. Open: one public step account per $0.25 above strike. Terms only, no amounts.
    const L3 = "Open the policy: step accounts with public terms";
    yield step("open", L3, "running");
    const policyBytes = Uint8Array.from(randomBytes(8));
    const policyId = hex(policyBytes);
    const accounts: Address[] = [];
    for (const t of terms) accounts.push(await stepPda(fleet.address, policyBytes, t.index));
    const openIxs = terms.map((t, i) => initStepIx(underwriter.signer, accounts[i], fleet.signer, underwriter.signer, {
      policyId: policyBytes, index: t.index, indexId: index.id, firstPeriod: period, lastPeriod: period, direction: 0, triggerMilli: t.triggerMilli,
    }));
    const open = await send(underwriter.signer, openIxs, { cu: 400_000, label: "open steps" });
    yield step("open", L3, "done", { tx: open.signature, detail: `Policy ${policyId}: ${nSteps} steps, triggers $${terms[0].triggerPrice.toFixed(3)} to $${terms[nSteps - 1].triggerPrice.toFixed(3)}/gal for ${req.settleMonth}; signed by fleet and underwriter` });

    // 4. Fund: underwriter pays each step vault privately (amounts encrypted on chain).
    const L4 = "Underwriter funds each step vault privately";
    yield step("fund", L4, "running", { private: true });
    const vaults = await Promise.all(accounts.map((a) => newVaultKey(a)));
    remember({ at: new Date().toISOString(), programId: PROGRAM_ID, policyId, period, steps: accounts.map((a, i) => ({ index: i + 1, account: a, vault: vaults[i].vault, viewingKey: vaults[i].keyHex })) });
    const fundTxs: string[] = [];
    const outputs = vaults.map((v) => ({ to: v.to, amount: stepAmountBase }));
    try {
      fundTxs.push((await privateSend(underwriter, outputs, "fund steps")).signature);
    } catch (e) {
      // Fall back to two transactions of up to four outputs if one is too large.
      if (!/too large|size|TOO_MANY|exceed/i.test(String((e as Error).message))) throw e;
      for (let i = 0; i < outputs.length; i += 4) fundTxs.push((await privateSend(underwriter, outputs.slice(i, i + 4), `fund steps ${i + 1}-${Math.min(i + 4, outputs.length)}`)).signature);
    }
    yield step("fund", L4, "done", { tx: fundTxs[0], private: true, detail: `${nSteps} vaults funded in ${fundTxs.length} Rings transaction${fundTxs.length > 1 ? "s" : ""}; each holds ${fromBase(stepAmountBase).toFixed(2)} tUSD ($${STEP_SIZE.toFixed(2)} × ${gallons.toFixed(0)} gal), encrypted on chain` });

    // 5. Report: the oracle posts the monthly mean and the sha256 of the EIA file (write-once).
    const L5 = "Oracle posts the monthly mean on chain";
    yield step("report", L5, "running");
    const reportAddr = await reportPda(index.id, period);
    const valueMilli = toMilli(mean);
    let reportTx: string, reportAlreadyOnChain = false, onchainMilli = valueMilli, onchainSha = sourceHash;
    const existing = await fetchProgramAccount(reportAddr);
    if (existing) {
      const rep = decodeReport(existing);
      reportAlreadyOnChain = true;
      onchainMilli = rep.valueMilli;
      onchainSha = rep.sha256;
      reportTx = (await firstSignature(reportAddr)) ?? "";
    } else {
      await ensureSol(oracle);
      reportTx = (await send(oracle.signer, [reportIndexIx(oracle.signer, oracle.signer, reportAddr, index.id, period, valueMilli, Buffer.from(sourceHash, "hex"))], { cu: 100_000, label: "report_index" })).signature;
    }
    const indexMean = fromMilli(onchainMilli);
    yield step("report", L5, "done", { tx: reportTx || undefined, detail: `${index.label} ${period} = $${indexMean.toFixed(3)}/gal${reportAlreadyOnChain ? " (already on chain; reports are write-once)" : ""}; sha256 ${onchainSha.slice(0, 16)}…${onchainMilli !== valueMilli ? ` (server now computes $${fromMilli(valueMilli).toFixed(3)}; the program uses the on-chain value)` : ""}` });

    // 6. A non-oracle key tries to post a made-up price. Simulated, so no fee is spent.
    const L6 = "Unauthorised index report attempt";
    yield step("stranger", L6, "running");
    const fake = await simulate(fleet.signer, [reportIndexIx(fleet.signer, fleet.signer, reportAddr, index.id, period, toMilli(9.999), new Uint8Array(32))], 100_000);
    const stranger = fake.err ? `Refused: only the oracle can post the index (error ${errorName(fake.custom)}, simulated)` : "Not refused";
    yield step("stranger", L6, "rejected", { detail: `The fleet signed a report of $9.999/gal for ${period} as if it were the oracle. ${stranger}` });

    // 7. Release: the fleet claims each triggered step; the program checks the report and signs for the vault.
    const L7 = "Fleet releases each triggered step privately";
    yield step("release", L7, "running", { private: true });
    const triggered = terms.map((t) => onchainMilli >= t.triggerMilli);
    const releases: string[] = [];
    const releaseTx: (string | undefined)[] = terms.map(() => undefined);
    let firstRelease: ReturnType<typeof releaseIx> | undefined;
    for (let i = 0; i < nSteps; i++) {
      if (!triggered[i]) continue;
      const spend = await proveVaultSpend(accounts[i], vaults[i].keyHex, fleet.shielded.shieldedAddress(), fleet.signer);
      if (!spend) throw new Error(`Step ${i + 1} vault balance not found (indexer lag); try again.`);
      const ix = releaseIx(accounts[i], reportAddr, fleet.signer, spend.sppAccounts, spend.transactData);
      firstRelease ??= ix;
      const sent = await send(fleet.signer, [ix], { label: `release step ${i + 1}` });
      releases.push(sent.signature);
      releaseTx[i] = sent.signature;
      yield step("release", L7, "running", { tx: sent.signature, private: true, detail: `Step ${i + 1} (trigger $${terms[i].triggerPrice.toFixed(3)}) released` });
    }
    const received = (await Promise.all(releases.map((s) => receivedIn(s, fleet.shielded)))).reduce((n, x) => n + x, 0n);
    yield step("release", L7, "done", { tx: releases[0], private: true, detail: releases.length ? `${releases.length} of ${nSteps} steps paid; the fleet decrypts ${fromBase(received).toFixed(2)} tUSD received` : `No step triggered: the mean $${indexMean.toFixed(3)} is below the first trigger $${terms[0].triggerPrice.toFixed(3)}` });

    // 8. Replay a release of a paid step. Simulated: the program must refuse.
    const L8 = "Duplicate release attempt";
    yield step("duplicate", L8, "running");
    let duplicate: string;
    if (firstRelease) {
      const dup = await simulate(fleet.signer, [firstRelease]);
      const paidIdx = triggered.indexOf(true) + 1;
      duplicate = dup.err ? `Refused: step ${paidIdx} is already paid (error ${errorName(dup.custom)}, simulated)` : "Not refused";
      yield step("duplicate", L8, "rejected", { detail: `The first release transaction, replayed. ${duplicate}` });
    } else {
      // Nothing was paid: show that an untriggered step cannot be released instead.
      const fakeSpend = { sppAccounts: [] as any[], transactData: new Uint8Array(0) };
      const dup = await simulate(fleet.signer, [releaseIx(accounts[0], reportAddr, fleet.signer, fakeSpend.sppAccounts, fakeSpend.transactData)]);
      duplicate = dup.err ? `Refused: step 1 did not trigger, so it cannot be released (error ${errorName(dup.custom)}, simulated)` : "Not refused";
      yield step("duplicate", L8, "rejected", { detail: `Release of untriggered step 1. ${duplicate}` });
    }

    // 9. Reclaim: untriggered steps return to the underwriter once the term's periods are reported.
    const L9 = "Untriggered steps return to the underwriter";
    yield step("reclaim", L9, "running", { private: true });
    const reclaims: string[] = [];
    for (let i = 0; i < nSteps; i++) {
      if (triggered[i]) continue;
      const spend = await proveVaultSpend(accounts[i], vaults[i].keyHex, underwriter.shielded.shieldedAddress(), underwriter.signer);
      if (!spend) throw new Error(`Step ${i + 1} vault balance not found (indexer lag); try again.`);
      const sent = await send(underwriter.signer, [reclaimIx(accounts[i], underwriter.signer, [reportAddr], spend.sppAccounts, spend.transactData)], { label: `reclaim step ${i + 1}` });
      reclaims.push(sent.signature);
      yield step("reclaim", L9, "running", { tx: sent.signature, private: true, detail: `Step ${i + 1} (trigger $${terms[i].triggerPrice.toFixed(3)}) reclaimed` });
    }
    yield step("reclaim", L9, "done", { tx: reclaims[0], private: true, detail: reclaims.length ? `${reclaims.length} untriggered step${reclaims.length > 1 ? "s" : ""} returned privately to the underwriter (${fromBase(stepAmountBase * BigInt(reclaims.length)).toFixed(2)} tUSD)` : "Every step triggered; nothing to reclaim" });

    const fleetAfter = await privateBalance(fleet);
    const steps: CoverStep[] = terms.map((t, i) => ({
      index: t.index, triggerPrice: fromMilli(t.triggerMilli), amount: fromBase(stepAmountBase), account: accounts[i], vault: vaults[i].vault,
      triggered: triggered[i], paid: !!releaseTx[i], ...(releaseTx[i] ? { releaseTx: releaseTx[i] } : {}),
    }));
    const result: SettlementResult = {
      network: SOLANA_NETWORK, explorer: EXPLORER, programId: PROGRAM_ID, ringsProgramId: RINGS_PROGRAM_ID, mint: MINT,
      policyId, period, indexId: index.id, indexLabel: index.label, indexMean, strike, stepSize: STEP_SIZE, coveredGallons: gallons,
      steps, payoutUsd: fromBase(received), linearPayoutUsd, fleet: fleet.address, underwriter: underwriter.address, oracle: oracle.address,
      txs: { open: open.signature, fund: fundTxs, report: reportTx, reportAlreadyOnChain, releases, ...(reclaims[0] ? { reclaim: reclaims[0] } : {}) },
      rejections: { stranger, duplicate },
      fleetView: { received: fromBase(received), balanceBefore: fromBase(fleetBefore), balanceAfter: fromBase(fleetAfter) },
      publicView: {
        visible: [
          `Program ${PROGRAM_ID} and ${nSteps} step accounts: trigger prices, index id ${index.id}, period ${period}, fleet and underwriter addresses`,
          `The oracle's report: ${index.label} ${period} = $${indexMean.toFixed(3)}/gal and the EIA file's sha256`,
          "Which steps are paid or reclaimed (a status flag per step account)",
          "Transaction signatures, signers and fee payers (SOL fees)",
        ],
        hidden: [
          "How much tUSD each step vault holds",
          "How much the fleet was paid",
          "The fleet's and the underwriter's tUSD balances",
          "Covered gallons (implied by the step amounts)",
        ],
      },
      lenderShare: { policyId, region, period, steps: steps.map((s, i) => ({ index: s.index, account: s.account, vault: s.vault, viewingKey: vaults[i].keyHex })) },
      sourceHash: onchainSha,
    };
    statusCache = undefined;
    yield { type: "result", result };
  } catch (e) {
    yield { type: "error", message: short(e) };
  } finally {
    release?.();
  }
}

