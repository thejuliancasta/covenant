/**
 * npm run solana:e2e -- one full private settlement on Solana devnet for the
 * sample company (public/sample/johns-trucking.csv), using the same request the
 * app's simulator sends to /api/settle. Prints every step, the payout, the
 * linear payout and Explorer links. Exits non-zero on failure.
 */
import { readFileSync } from "node:fs";
import { loadEnvLocal } from "./solana-env";

loadEnvLocal();

async function main() {
  const { analyze } = await import("../lib/engine/pipeline");
  const { runSettlement, chainStatus } = await import("../lib/chain/server");
  const { lenderView } = await import("../lib/chain/lender");
  const { txUrl, addressUrl } = await import("../lib/chain/types");
  type Result = import("../lib/chain/types").SettlementResult;
  const t0 = Date.now();
  const lap = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

  // The same body components/simulate.tsx posts to /api/settle, from the engine's analysis of the sample ledger.
  const csv = readFileSync("public/sample/johns-trucking.csv", "utf8");
  const a = await analyze(csv, { skipMarkets: true, fetcher: (async () => new Response("offline", { status: 503 })) as unknown as typeof fetch });
  const p = a.policy!;
  const req = { region: a.region, inceptionMonth: p.inceptionMonth, settleMonth: p.settlement.month, strikeOffset: p.strikeOffset, coveredGallons: p.settlement.coveredGallons, maxCoveredGallons: p.maxCoveredGallonsPerMonth };
  console.log("request", JSON.stringify(req));
  console.log(`engine expects: index $${p.settlement.indexMean.toFixed(4)}, strike $${p.strike.toFixed(4)}, linear payout $${p.settlement.payout.toFixed(2)}\n`);

  const st = await chainStatus();
  if (!st.configured) throw new Error(`not configured: ${st.reason}`);
  console.log(`program ${st.programId}  mint ${st.mint}\nunderwriter ${st.underwriter} (${st.underwriterPrivateBalance} tUSD private)\nfleet ${st.fleet} (${st.fleetPrivateBalance} tUSD private)\noracle ${st.oracle}  policies so far ${st.policies}\n`);

  let r: Result | undefined;
  for await (const ev of runSettlement(req)) {
    if (ev.type === "step") {
      if (ev.status === "running" && !ev.tx) continue;
      console.log(`[${lap()}] ${ev.id.padEnd(9)} ${ev.status.padEnd(8)} ${ev.private ? "(private) " : ""}${ev.label}${ev.detail ? ` :: ${ev.detail}` : ""}${ev.tx ? `\n           ${txUrl(st.explorer, ev.tx)}` : ""}`);
    }
    if (ev.type === "error") throw new Error(ev.message);
    if (ev.type === "result") r = ev.result;
  }
  if (!r) throw new Error("no result");
  console.log("\nsteps:");
  for (const s of r.steps) console.log(`  ${String(s.index).padStart(2)} trigger $${s.triggerPrice.toFixed(3)}  ${s.amount.toFixed(2)} tUSD  ${s.triggered ? "triggered    " : "not triggered"}  ${s.paid ? "PAID" : "    "}  ${addressUrl(r.explorer, s.account)}`);
  console.log(`\nindex mean $${r.indexMean.toFixed(3)} vs strike $${r.strike.toFixed(4)}, ${r.coveredGallons.toFixed(1)} covered gallons, step $${r.stepSize.toFixed(2)}`);
  console.log(`payout (fleet decrypts): ${r.payoutUsd.toFixed(2)} tUSD; linear cap payout: $${r.linearPayoutUsd.toFixed(2)}`);
  console.log(`fleet private balance: ${r.fleetView.balanceBefore} -> ${r.fleetView.balanceAfter} (received ${r.fleetView.received})`);
  console.log(`rejections: stranger ${r.rejections.stranger}; duplicate ${r.rejections.duplicate}`);
  console.log(`source sha256 ${r.sourceHash}`);
  console.log(`public sees: ${r.publicView.visible.join("; ")}\nhidden: ${r.publicView.hidden.join("; ")}`);
  console.log("\nExplorer links:");
  const links: [string, string | undefined][] = [
    ["open", r.txs.open],
    ...r.txs.fund.map((t, i): [string, string] => [`fund ${i + 1}`, t]),
    [`report${r.txs.reportAlreadyOnChain ? " (existing)" : ""}`, r.txs.report],
    ...r.txs.releases.map((t, i): [string, string] => [`release ${i + 1}`, t]),
    ["reclaim", r.txs.reclaim],
  ];
  for (const [label, sig] of links) if (sig) console.log(`  ${label.padEnd(18)} ${txUrl(r.explorer, sig)}`);
  console.log(`  ${"program".padEnd(18)} ${addressUrl(r.explorer, r.programId)}`);

  // Lender check: decrypt with the viewing keys only.
  const lv = await lenderView(r.lenderShare);
  console.log(`\nlender view (viewing keys only): funded ${lv.totalFunded.toFixed(2)} tUSD, paid ${lv.totalPaid.toFixed(2)} tUSD`);
  for (const s of lv.steps) console.log(`  step ${s.index}: trigger $${s.triggerPrice.toFixed(3)} funded ${s.funded.toFixed(2)}${s.paid ? " paid" : ""}`);

  const expectPaid = r.steps.filter((s) => s.triggered).length;
  const checks: [string, boolean][] = [
    ["every triggered step released", r.txs.releases.length === expectPaid && r.steps.every((s) => s.paid === s.triggered)],
    ["fleet decrypts the step sum", Math.abs(r.payoutUsd - expectPaid * r.steps[0].amount) < 0.01],
    ["stranger report rejected with 6002", /6002/.test(r.rejections.stranger)],
    ["duplicate release rejected with 6007", /6007/.test(r.rejections.duplicate)],
    ["untriggered steps reclaimed", expectPaid === r.steps.length || !!r.txs.reclaim],
    ["lender sees the same payout", Math.abs(lv.totalPaid - r.payoutUsd) < 0.01],
    ["lender sees every step funded", lv.steps.every((s) => Math.abs(s.funded - r!.steps[0].amount) < 0.01)],
  ];
  for (const [c, ok] of checks) console.log(`  ${ok ? "OK  " : "FAIL"} ${c}`);
  const ok = checks.every(([, x]) => x);
  console.log(`\n${ok ? "PASS" : "FAIL"} in ${lap()}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error("\nFAILED:", e instanceof Error ? e.message : e); process.exit(1); });
