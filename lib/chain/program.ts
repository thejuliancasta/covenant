/**
 * Low-level Solana plumbing for the CostShield steps program: the Helius
 * Privacy Rings client, v1 transaction send and simulate (with @solana/kit),
 * PDAs, instruction builders and account decoders.
 * Adapted from Equity Floor, our first idea for this hackathon, written during
 * the event and set aside on Nov 20.
 */
import {
  AccountRole,
  address,
  appendTransactionMessageInstructions,
  assertIsTransactionWithBlockhashLifetime,
  createTransactionMessage,
  getAddressDecoder,
  getAddressEncoder,
  getBase64EncodedWireTransaction,
  getProgramDerivedAddress,
  getSignatureFromTransaction,
  pipe,
  sendTransactionWithoutConfirmingFactory,
  setTransactionMessageConfig,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Instruction,
  type Signature,
  type TransactionSigner,
} from "@solana/kit";
import { createSprClient, initializePoseidon, type SprClientConfig } from "@heliuslabs/spr";
import { SignedTeePolicy } from "@heliuslabs/spr/client";
import { AssetRegistry } from "@heliuslabs/spr/transaction";
import { ASSET_ID, MINT, PROGRAM_ID, RINGS_PROGRAM_ID, rpcUrl } from "./config";

export const SYSTEM_PROGRAM = address("11111111111111111111111111111111");
export const programAddress = () => {
  if (!PROGRAM_ID) throw new Error("No Solana program id is configured (deployments/solana-devnet.json or SOLANA_PROGRAM_ID).");
  return address(PROGRAM_ID);
};

// ------------------------------------------------------------------ bytes
export const u32le = (v: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v, true); return b; };
export const u64le = (v: bigint) => { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, v, true); return b; };
export const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
export const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");
export const unhex = (s: string) => Uint8Array.from(Buffer.from(s, "hex"));
const addrEnc = getAddressEncoder();
const addrDec = getAddressDecoder();
export const addrBytes = (a: Address) => Uint8Array.from(addrEnc.encode(a));

// ----------------------------------------------------------------- client
export type Client = Awaited<ReturnType<typeof createSprClient>>;
let clientPromise: Promise<Client> | undefined;
export function getClient(): Promise<Client> {
  clientPromise ??= (async () => {
    const solanaRpcUrl = rpcUrl();
    if (!solanaRpcUrl) throw new Error("No Helius devnet RPC is configured (set HELIUS_API_KEY).");
    await initializePoseidon();
    const cfg: SprClientConfig = Object.freeze({ solanaRpcUrl, proofDataSource: "prover" as const, proverTee: SignedTeePolicy.forNetwork("devnet") });
    return createSprClient(cfg);
  })();
  clientPromise.catch(() => { clientPromise = undefined; });
  return clientPromise;
}

export function registry(): { mint: Address; registry: AssetRegistry } {
  if (!MINT || !ASSET_ID) throw new Error("No tUSD mint is configured (run `npm run solana:setup`).");
  const r = new AssetRegistry();
  r.insert(BigInt(ASSET_ID), address(MINT));
  return { mint: address(MINT), registry: r };
}

// ------------------------------------------------------------------- send
let lastSlot = 0n;
export const latestSlot = () => lastSlot;

function describeError(e: unknown): string {
  const parts: string[] = [];
  let cur: any = e;
  for (let i = 0; cur && i < 5; i++) {
    if (cur.message) parts.push(String(cur.message));
    const logs = cur.context?.logs ?? cur.logs;
    if (Array.isArray(logs)) parts.push("logs: " + logs.slice(-8).join(" / "));
    cur = cur.cause;
  }
  return parts.join(" | ") || String(e);
}

export class ChainError extends Error {
  constructor(message: string, readonly signature?: string) { super(message); }
}

async function signed(feePayer: TransactionSigner, instructions: readonly Instruction[], cu: number) {
  const client = await getClient();
  const { value: lifetime } = await client.solanaRpc.getLatestBlockhash().send();
  const tx = await signTransactionMessageWithSigners(
    pipe(
      createTransactionMessage({ version: 1 }),
      (m) => setTransactionMessageFeePayerSigner(feePayer, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(lifetime, m),
      (m) => setTransactionMessageConfig({ computeUnitLimit: cu, loadedAccountsDataSizeLimit: 64 * 1024 * 1024 }, m),
      (m) => appendTransactionMessageInstructions(instructions, m),
    ),
  );
  assertIsTransactionWithBlockhashLifetime(tx);
  return tx;
}

/** Sign (v1 message), send, confirm. Throws ChainError with program logs on failure. */
export async function send(
  feePayer: TransactionSigner,
  instructions: readonly Instruction[],
  opts: { cu?: number; label?: string; skipPreflight?: boolean } = {},
): Promise<{ signature: Signature; slot: bigint }> {
  const client = await getClient();
  const tx = await signed(feePayer, instructions, opts.cu ?? 1_400_000);
  const signature = getSignatureFromTransaction(tx);
  try {
    await sendTransactionWithoutConfirmingFactory({ rpc: client.solanaRpc })(tx, { commitment: "confirmed", skipPreflight: opts.skipPreflight ?? false });
  } catch (e) {
    throw new ChainError(`${opts.label ?? "transaction"} failed: ${describeError(e)}`, signature);
  }
  let slot: bigint;
  try {
    slot = await client.confirmTransaction(signature);
  } catch (e) {
    throw new ChainError(`${opts.label ?? "transaction"} did not confirm: ${describeError(e)}`, signature);
  }
  if (slot > lastSlot) lastSlot = slot;
  return { signature, slot };
}

/** Simulate without landing. Returns the custom program error code, if any, and the logs. */
export async function simulate(feePayer: TransactionSigner, instructions: readonly Instruction[], cu = 1_400_000) {
  const client = await getClient();
  const tx = await signed(feePayer, instructions, cu);
  const { value } = await (client.solanaRpc as any)
    .simulateTransaction(getBase64EncodedWireTransaction(tx), { encoding: "base64", sigVerify: false, replaceRecentBlockhash: true, commitment: "confirmed" })
    .send();
  const err = value.err as any;
  const custom = err?.InstructionError?.[1]?.Custom;
  return { err, custom: custom === undefined ? undefined : Number(custom), logs: (value.logs ?? []) as string[] };
}

export const ERRORS: Record<number, string> = {
  6001: "NotTriggered", 6002: "BadOracle", 6003: "BadReportAccount", 6004: "BadRingsProgram", 6005: "MissingVaultPda",
  6006: "BadStepAccount", 6007: "AlreadySettled", 6008: "WrongFleet", 6009: "ReportOutOfWindow", 6010: "IndexMismatch",
  6011: "AlreadyReported", 6012: "BadTerms", 6013: "WrongUnderwriter", 6014: "TriggeredInTerm", 6015: "IncompleteReports",
};
export const errorName = (code?: number) => (code === undefined ? "without a program code" : `${code} ${ERRORS[code] ?? "Custom"}`);

// ---------------------------------------------------------- program PDAs
export async function stepPda(fleet: Address, policyId: Uint8Array, index: number): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({ programAddress: programAddress(), seeds: ["step", addrBytes(fleet), policyId, Uint8Array.of(index)] });
  return pda;
}
export async function reportPda(indexId: number, period: number): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({ programAddress: programAddress(), seeds: ["report", u32le(indexId), u32le(period)] });
  return pda;
}

// -------------------------------------------------- instruction builders
const signerMeta = (s: TransactionSigner, writable = false) =>
  ({ address: s.address, role: writable ? AccountRole.WRITABLE_SIGNER : AccountRole.READONLY_SIGNER, signer: s }) as never;

export interface StepTermsInput {
  policyId: Uint8Array; // 8 bytes
  index: number;
  indexId: number;
  firstPeriod: number;
  lastPeriod: number;
  direction: 0 | 1; // 0 = pays at or above the trigger (cap)
  triggerMilli: bigint;
}

export function initStepIx(payer: TransactionSigner, step: Address, fleet: TransactionSigner, underwriter: TransactionSigner, t: StepTermsInput): Instruction {
  return {
    programAddress: programAddress(),
    accounts: [signerMeta(payer, true), { address: step, role: AccountRole.WRITABLE }, signerMeta(fleet), signerMeta(underwriter), { address: SYSTEM_PROGRAM, role: AccountRole.READONLY }],
    data: concat(Uint8Array.of(0), t.policyId, Uint8Array.of(t.index), u32le(t.indexId), u32le(t.firstPeriod), u32le(t.lastPeriod), Uint8Array.of(t.direction), u64le(t.triggerMilli)),
  };
}

export function reportIndexIx(payer: TransactionSigner, oracle: TransactionSigner, report: Address, indexId: number, period: number, valueMilli: bigint, sha256: Uint8Array): Instruction {
  return {
    programAddress: programAddress(),
    accounts: [signerMeta(payer, true), signerMeta(oracle), { address: report, role: AccountRole.WRITABLE }, { address: SYSTEM_PROGRAM, role: AccountRole.READONLY }],
    data: concat(Uint8Array.of(1), u32le(indexId), u32le(period), u64le(valueMilli), sha256),
  };
}

export function releaseIx(step: Address, report: Address, fleet: TransactionSigner, sppAccounts: readonly any[], transactData: Uint8Array): Instruction {
  return {
    programAddress: programAddress(),
    accounts: [{ address: step, role: AccountRole.WRITABLE }, { address: report, role: AccountRole.READONLY }, signerMeta(fleet), ...sppAccounts],
    data: concat(Uint8Array.of(2), transactData),
  };
}

export function reclaimIx(step: Address, underwriter: TransactionSigner, reports: readonly Address[], sppAccounts: readonly any[], transactData: Uint8Array): Instruction {
  return {
    programAddress: programAddress(),
    accounts: [{ address: step, role: AccountRole.WRITABLE }, signerMeta(underwriter), ...reports.map((r) => ({ address: r, role: AccountRole.READONLY })), ...sppAccounts],
    data: concat(Uint8Array.of(3, reports.length), transactData),
  };
}

// ------------------------------------------------------- account decoders
export async function fetchProgramAccount(addr: Address): Promise<Uint8Array | null> {
  const client = await getClient();
  const { value } = await client.solanaRpc.getAccountInfo(addr, { encoding: "base64", commitment: "confirmed" }).send();
  if (!value || value.owner !== programAddress()) return null;
  return Uint8Array.from(Buffer.from((value.data as unknown as [string, string])[0], "base64"));
}

export interface OnchainStep {
  status: "open" | "paid" | "reclaimed";
  stepIndex: number;
  direction: number;
  indexId: number;
  firstPeriod: number;
  lastPeriod: number;
  settledPeriod: number;
  triggerMilli: bigint;
  policyId: string;
  fleet: Address;
  underwriter: Address;
}
export function decodeStep(d: Uint8Array): OnchainStep {
  if (d[0] !== 1) throw new Error("not a step account");
  const v = new DataView(d.buffer, d.byteOffset, d.byteLength);
  const dec = (b: Uint8Array) => addrDec.decode(b);
  return {
    status: (["open", "paid", "reclaimed"] as const)[d[4]] ?? "open",
    stepIndex: d[3],
    direction: d[5],
    indexId: v.getUint32(8, true),
    firstPeriod: v.getUint32(12, true),
    lastPeriod: v.getUint32(16, true),
    settledPeriod: v.getUint32(20, true),
    triggerMilli: v.getBigUint64(24, true),
    policyId: hex(d.slice(32, 40)),
    fleet: dec(d.slice(40, 72)),
    underwriter: dec(d.slice(72, 104)),
  };
}

export interface OnchainReport { indexId: number; period: number; valueMilli: bigint; reportedAt: bigint; sha256: string; oracle: Address }
export function decodeReport(d: Uint8Array): OnchainReport {
  if (d[0] !== 2) throw new Error("not a report account");
  const v = new DataView(d.buffer, d.byteOffset, d.byteLength);
  return {
    indexId: v.getUint32(4, true),
    period: v.getUint32(8, true),
    valueMilli: v.getBigUint64(16, true),
    reportedAt: v.getBigInt64(24, true),
    sha256: hex(d.slice(32, 64)),
    oracle: addrDec.decode(d.slice(64, 96)),
  };
}

export async function solBalance(a: Address): Promise<number> {
  const client = await getClient();
  const { value } = await client.solanaRpc.getBalance(a, { commitment: "confirmed" }).send();
  return Number(value) / 1e9;
}

/** The oldest signature that touched an account (the tx that created a write-once report). */
export async function firstSignature(a: Address): Promise<string | null> {
  const client = await getClient();
  const sigs = await client.solanaRpc.getSignaturesForAddress(a, { limit: 1000, commitment: "confirmed" }).send();
  return sigs.length ? String(sigs[sigs.length - 1].signature) : null;
}
