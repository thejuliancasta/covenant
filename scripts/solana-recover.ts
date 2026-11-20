/** Resume an interrupted devnet settlement using locally saved step viewing keys.
 * Dry run by default. Pass a policy id and --execute to send transactions.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { address } from "@solana/kit";
import { loadEnvLocal } from "./solana-env";

loadEnvLocal();

async function main() {
  const policyId = process.argv[2];
  const execute = process.argv.includes("--execute");
  if (!policyId || !/^[0-9a-f]{16}$/.test(policyId) || process.argv.some((x, i) => i > 2 && x !== "--execute")) {
    throw new Error("Usage: npm run solana:recover -- <16-character policy id> [--execute]");
  }
  const { validShare } = await import("../lib/chain/lender");
  const { roles } = await import("../lib/chain/keys");
  const { PROGRAM_ID } = await import("../lib/chain/config");
  const { decodeReport, decodeStep, fetchProgramAccount, reclaimIx, releaseIx, reportPda, send } = await import("../lib/chain/program");
  const { proveVaultSpend, viewVault } = await import("../lib/chain/rings");
  const records = readFileSync(resolve(process.cwd(), ".solana-keys/policies.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
  const record = records.findLast((row) => row.policyId === policyId);
  if (!record || record.programId !== PROGRAM_ID) throw new Error("Policy was not saved locally for this deployed program");
  const share = { policyId, region: "PADD2", period: record.period, steps: record.steps };
  if (!validShare(share)) throw new Error("Saved policy record is invalid");
  const { fleet, underwriter } = roles();
  if (!fleet || !underwriter) throw new Error("Fleet and underwriter signing keys are required locally");

  let pending = 0;
  for (const st of share.steps) {
    const raw = await fetchProgramAccount(address(st.account));
    if (!raw) throw new Error(`Missing step ${st.index}`);
    const step = decodeStep(raw);
    if (step.policyId !== policyId || step.stepIndex !== st.index || step.fleet !== fleet.address || step.underwriter !== underwriter.address || step.firstPeriod !== share.period || step.lastPeriod !== share.period) {
      throw new Error(`Step ${st.index} terms differ from saved policy; stopping`);
    }
    if (step.status !== "open") { console.log(`Step ${st.index}: already ${step.status}`); continue; }
    const reportAddr = await reportPda(step.indexId, share.period);
    const reportRaw = await fetchProgramAccount(reportAddr);
    if (!reportRaw) throw new Error(`No public price report for step ${st.index}; stopping`);
    const report = decodeReport(reportRaw);
    if (report.indexId !== step.indexId || report.period !== share.period) throw new Error("Report terms differ from step");
    const triggered = step.direction === 0 ? report.valueMilli >= step.triggerMilli : report.valueMilli <= step.triggerMilli;
    const { funded, unspent } = await viewVault(address(st.account), st.vault, st.viewingKey);
    if (funded <= 0n || unspent <= 0n) throw new Error(`Open step ${st.index} has no spendable private collateral; stopping`);
    pending++;
    console.log(`Step ${st.index}: ${triggered ? "release to fleet" : "reclaim to underwriter"}, ${(Number(unspent) / 1e6).toFixed(2)} tUSD still in vault`);
    if (!execute) continue;
    const role = triggered ? fleet : underwriter;
    const spend = await proveVaultSpend(address(st.account), st.viewingKey, role.shielded.shieldedAddress(), role.signer);
    if (!spend || spend.amount !== unspent) throw new Error(`Step ${st.index} balance changed during recovery; stopping`);
    const ix = triggered
      ? releaseIx(address(st.account), reportAddr, fleet.signer, spend.sppAccounts, spend.transactData)
      : reclaimIx(address(st.account), underwriter.signer, [reportAddr], spend.sppAccounts, spend.transactData);
    const tx = await send(role.signer, [ix], { label: `recover step ${st.index}` });
    console.log(`Step ${st.index}: confirmed ${tx.signature}`);
  }
  console.log(`${pending} open funded step${pending === 1 ? "" : "s"} ${execute ? "processed" : "eligible; no transactions sent"}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : String(e)); process.exit(1); });
