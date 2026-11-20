/** ARCHIVED: Arc testnet configuration, unused since the Solana port (see lib/chain/config.ts). The vault was not deployed. */
import { defineChain } from "viem";
import deployment from "../../../deployments/arc-testnet.json";

/** Arc testnet. USDC is the native gas token; the same balance is exposed as an ERC-20 with 6 decimals. */
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network"] } },
  blockExplorers: { default: { name: "Arcscan", url: "https://testnet.arcscan.app" } },
  testnet: true,
});

export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as const;
export const EXPLORER = "https://testnet.arcscan.app";
/** Demo scale: testnet faucet funds are limited, so 1 testnet USDC stands for $1,000 of notional. */
export const DEMO_SCALE = 1000;
export const INDEX_LABEL = "EIA:EMD_EPD2D_PTE_R20_DPG:monthly-mean";

export interface Deployment {
  chainId: number; vault: `0x${string}` | null; deployTx: string | null; deployedAt: string | null;
  owner: string | null; oracle: string | null; beneficiary: string | null;
  evidence: { label: string; tx: string; note: string }[];
}
export const DEPLOYMENT = deployment as Deployment;
export const VAULT_ADDRESS = (process.env.VAULT_ADDRESS || DEPLOYMENT.vault || null) as `0x${string}` | null;

export const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "s", type: "address" }, { name: "a", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "a", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;
