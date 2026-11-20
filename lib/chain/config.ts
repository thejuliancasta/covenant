/**
 * Solana devnet configuration for CostShield settlement (Helius Privacy Rings).
 * Public addresses come from deployments/solana-devnet.json, overridable by env.
 * Secrets (Helius API key, wallet keys) are read in lib/chain/keys.ts, never here.
 */
import deployment from "../../deployments/solana-devnet.json";
import { DEFAULT_EXPLORER } from "./types";

export interface SolanaDeployment {
  network: "solana-devnet";
  programId: string | null;
  ringsProgramId: string;
  mint: string | null;
  /** Rings asset id of the tUSD mint. */
  assetId: string | null;
  underwriter: string | null;
  oracle: string | null;
  fleet: string | null;
  deployTx?: string | null;
  updatedAt?: string | null;
}
export const DEPLOYMENT = deployment as SolanaDeployment;

const env = (k: string) => process.env[k]?.trim() || undefined;

export const RINGS_PROGRAM_ID = "ring1GaLCuJnkUMVkX2JeZLTTX17wKsV4fZmPVzXANW";
export const PROGRAM_ID = env("SOLANA_PROGRAM_ID") ?? DEPLOYMENT.programId ?? null;
export const MINT = env("SOLANA_TUSD_MINT") ?? DEPLOYMENT.mint ?? null;
export const ASSET_ID = env("SOLANA_TUSD_ASSET_ID") ?? DEPLOYMENT.assetId ?? null;
export const EXPLORER = (env("SOLANA_EXPLORER") ?? DEFAULT_EXPLORER).replace(/\/+$/, "");
export const TUSD_DECIMALS = 6;
export const TUSD = 10n ** BigInt(TUSD_DECIMALS);

/** Helius devnet RPC (Privacy Rings needs Helius). SOLANA_RPC_URL overrides the full URL. */
export function rpcUrl(): string | null {
  const url = env("SOLANA_RPC_URL");
  if (url) return url;
  const key = env("HELIUS_API_KEY");
  return key ? `https://devnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}` : null;
}

/** Index ids posted on chain: one per EIA regional diesel series (u32). */
export const INDEXES: Record<string, { id: number; label: string }> = {
  US: { id: 1, label: "EIA:EMD_EPD2D_PTE_NUS_DPG:monthly-mean" },
  PADD2: { id: 2, label: "EIA:EMD_EPD2D_PTE_R20_DPG:monthly-mean" },
};

/** Step design: step size in $/gal and the cap's per-gallon limit above strike. */
export const STEP_SIZE = 0.25;
export const STEP_LIMIT = 2.0;

/** Prices on chain are u64 in 1/1000 $/gal. */
export const toMilli = (usdPerGal: number) => BigInt(Math.round(usdPerGal * 1000));
/** Triggers round up so a step never pays below its exact trigger price. */
export const toMilliCeil = (usdPerGal: number) => BigInt(Math.ceil(Math.round(usdPerGal * 1e6) / 1000));
export const fromMilli = (m: bigint | number) => Number(m) / 1000;
export const toBase = (tusd: number) => BigInt(Math.round(tusd * Number(TUSD)));
export const fromBase = (base: bigint) => Number(base) / Number(TUSD);
/** "2026-09" -> 202609 */
export const periodOf = (ym: string) => Number(ym.replace("-", ""));
