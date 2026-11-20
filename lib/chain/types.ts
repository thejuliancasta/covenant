/**
 * Shared contract between the Solana settlement server (lib/chain/*, app/api/*)
 * and the UI (components/*, app/lender). Settlement runs on Solana devnet with
 * Helius Privacy Rings: step amounts, payouts and balances are encrypted on chain.
 * Money is the devnet test dollar "tUSD" (6 decimals) at 1 tUSD = $1 (no demo scaling).
 */

export const SOLANA_NETWORK = "solana-devnet" as const;
export const DEFAULT_EXPLORER = "https://explorer.solana.com";
/** Explorer link for a devnet transaction or address. */
export const txUrl = (explorer: string, sig: string) => `${explorer}/tx/${sig}?cluster=devnet`;
export const addressUrl = (explorer: string, addr: string) => `${explorer}/address/${addr}?cluster=devnet`;

export interface ChainStatus {
  configured: boolean;
  reason?: string;
  network: typeof SOLANA_NETWORK;
  explorer: string;
  programId: string | null;
  ringsProgramId: string;
  /** tUSD mint, registered with Privacy Rings. */
  mint: string | null;
  underwriter?: string;
  oracle?: string;
  /** Demo wallet standing in for the business. */
  fleet?: string;
  /** Decrypted by the server with each party's own key (custodial demo). */
  underwriterPrivateBalance?: number;
  fleetPrivateBalance?: number;
  policies?: number;
}

/** Unchanged from the Arc version: the caller supplies months and gallons, never prices. */
export interface SettlementRequest {
  region: string;
  inceptionMonth: string; // "YYYY-MM"
  settleMonth: string; // "YYYY-MM"
  strikeOffset: number; // $/gal above the inception index
  coveredGallons: number;
  maxCoveredGallons: number;
}

export type StepStatus = "running" | "done" | "rejected" | "error";

export type SettlementEvent =
  | { type: "step"; id: string; label: string; status: StepStatus; tx?: string; detail?: string; private?: boolean }
  | { type: "result"; result: SettlementResult }
  | { type: "error"; message: string };

/** One protection step. The cap pays in steps because the program cannot read encrypted amounts. */
export interface CoverStep {
  index: number; // 1-based
  triggerPrice: number; // $/gal; the step pays when the attested monthly mean is at or above it
  amount: number; // tUSD; encrypted on chain, known to the fleet (and the lender with a viewing key)
  account: string; // public step account (terms only)
  vault: string; // program-derived address that owns the step's private balance
  triggered: boolean;
  paid: boolean;
  releaseTx?: string;
}

export interface LenderShare {
  policyId: string;
  region: string;
  period: number; // YYYYMM
  /** Read-only: a viewing key decrypts a step's private balance but cannot spend it. */
  steps: { index: number; account: string; vault: string; viewingKey: string }[];
}

export interface LenderView {
  policyId: string;
  region: string;
  period: number;
  steps: { index: number; triggerPrice: number; funded: number; paid: boolean }[];
  totalFunded: number;
  totalPaid: number;
  checkedAt: string; // ISO time
  note: string;
}

export interface SettlementResult {
  network: typeof SOLANA_NETWORK;
  explorer: string;
  programId: string;
  ringsProgramId: string;
  mint: string;
  policyId: string;
  period: number; // YYYYMM
  indexId: number;
  indexLabel: string;
  indexMean: number; // $/gal, recomputed by the server from its EIA data
  strike: number; // $/gal
  stepSize: number; // $/gal between step triggers
  coveredGallons: number;
  steps: CoverStep[];
  payoutUsd: number; // sum of paid steps (tUSD), decrypted by the fleet
  linearPayoutUsd: number; // the original cap formula (index - strike) x gallons, for comparison
  fleet: string;
  underwriter: string;
  oracle: string;
  txs: { open: string; fund: string[]; report: string; reportAlreadyOnChain: boolean; releases: string[]; reclaim?: string };
  rejections: { stranger: string; duplicate: string };
  /** What the fleet sees after decrypting with its own keys. */
  fleetView: { received: number; balanceBefore: number; balanceAfter: number };
  /** What anyone can see on the public chain. */
  publicView: { visible: string[]; hidden: string[] };
  lenderShare: LenderShare;
  /** sha256 of the EIA data file the oracle used. */
  sourceHash: string;
}
