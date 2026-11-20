/** Read-only verification of the latest locally recorded policy, without a new settlement. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvLocal } from "./solana-env";

loadEnvLocal();

async function main() {
  const { lenderView, validShare } = await import("../lib/chain/lender");
  const path = resolve(process.cwd(), ".solana-keys/policies.jsonl");
  const rows = readFileSync(path, "utf8").trim().split("\n");
  const last = JSON.parse(rows[rows.length - 1]);
  const share = { policyId: last.policyId, region: "PADD2", period: last.period, steps: last.steps };
  if (!validShare(share)) throw new Error("Last local policy record is invalid");
  const result = await lenderView(share);
  console.log(`Policy ${result.policyId}, ${result.steps.length} steps, funded ${result.totalFunded.toFixed(2)} tUSD, paid ${result.totalPaid.toFixed(2)} tUSD`);
  console.log(`Public paid flags: ${result.steps.filter((s) => s.paid).length}/${result.steps.length}`);
  if (result.steps.some((s) => s.funded <= 0)) throw new Error("A step has no decrypted funding history");
}

main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
