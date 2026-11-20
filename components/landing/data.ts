// Server only: runs the real engine on the sample ledger at build time (no live Gemini call).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { analyze } from "@/lib/engine/pipeline";
import { SERIES } from "@/lib/engine/series";

export interface LedgerRow { date: string; vendor: string; memo: string; amount: number; label: string; fuel: boolean; rule: string; confidence: number }
export interface CategoryRow { label: string; share: number; ttm: number; market: boolean; verdict: string }
export interface MonthRow { month: string; pricePaid: number; index: number }
export interface CoverRow { month: string; index: number; payout: number; triggered: boolean }
export interface StepRow { index: number; trigger: number; paid: boolean }

export interface LandingData {
  company: string;
  lines: number; skipped: number; vendors: number; categories: number; unclassified: number; dateFrom: string; dateTo: string; format: string;
  revenueTtm: number; profitTtm: number; marginTtm: number;
  diesel: { spendTtm: number; share: number; gallonsTtm: number; r2: number; fitN: number; regionLabel: string; shockPct: number; shockNet: number; shockTimesProfit: number; unsurcharged: number };
  ledger: LedgerRow[];
  categoryRows: CategoryRow[];
  monthly: MonthRow[];
  backtest: { n: number; from: string; to: string; paidShare: number; bad: number; badPaid: number; badPaidShare: number; varianceReduction: number };
  policy: { inceptionMonth: string; inceptionIndex: number; strike: number; rows: CoverRow[]; totalPayout: number; totalExtraCost: number; paidMonths: number; premiumPerGallon: number; premiumPerMonth: number; sigma: number };
  wholesaleR2: number;
  pool: { id: string; status: string; confidence: number };
  settlement: { month: string; indexMean: number; gallons: number; stepAmount: number; steps: StepRow[]; paidSteps: number; payout: number; funded: number };
  eia: { sha256: string; fetchedAt: string; title: string };
}

const STEP = 0.25, STEP_LIMIT = 2.0; // lib/chain/config.ts: STEP_SIZE and STEP_LIMIT

let cached: Promise<LandingData> | null = null;
export function getLandingData() { return (cached ??= build()); }

async function build(): Promise<LandingData> {
  const csv = readFileSync(resolve(process.cwd(), "public/sample/johns-trucking.csv"), "utf8");
  const a = await analyze(csv, { skipMarkets: true });
  const d = a.diesel!, fin = a.financials, p = a.policy!, bt = a.backtest!;
  const shock = d.shocks.find((s) => s.label.startsWith("1-in-20"))!;

  // A readable slice of the real ledger: the latest fuel lines plus the latest line of other categories.
  const picked: typeof a.sampleLines = [];
  const seen = new Map<string, number>();
  for (const l of a.sampleLines) {
    const n = seen.get(l.category) ?? 0;
    const cap = l.category === "fleet_fuel" ? 3 : 1;
    if (n < cap && picked.length < 7) { picked.push(l); seen.set(l.category, n + 1); }
  }
  picked.sort((x, y) => (x.date < y.date ? 1 : -1));
  const labelOf = new Map<string, string>(fin.categories.map((c) => [c.category, c.label]));

  const verdictOf = new Map(a.others.map((o) => [o.category, o]));
  const categoryRows: CategoryRow[] = fin.categories.slice(0, 7).map((c) => {
    if (c.category === "fleet_fuel") return { label: c.label, share: c.shareOfRevenue, ttm: c.ttm, market: true, verdict: "Follows the official Midwest diesel price" };
    const o = verdictOf.get(c.category);
    const verdict = o?.verdict === "no instrument" ? "Nothing exists to protect this cost" : o?.verdict === "not priced" ? "Too small to matter: under 5% of revenue" : "Too small to matter";
    return { label: c.label, share: c.shareOfRevenue, ttm: c.ttm, market: false, verdict };
  });

  const s = p.settlement;
  const gallons = Math.min(s.coveredGallons, p.maxCoveredGallonsPerMonth);
  const stepAmount = STEP * gallons; // unrounded, as on the payout screen; rounded only where it is shown
  const nSteps = Math.round(STEP_LIMIT / STEP);
  const steps = Array.from({ length: nSteps }, (_, i) => {
    const trigger = Math.ceil(Math.round((p.strike + (i + 1) * STEP) * 1e6) / 1000) / 1000;
    return { index: i + 1, trigger, paid: s.indexMean >= trigger };
  });
  const paidSteps = steps.filter((x) => x.paid).length;

  const seriesId = d.indexSeries;
  const bytes = readFileSync(resolve(process.cwd(), "lib/data", `${seriesId}.json`));
  const series = SERIES[seriesId as keyof typeof SERIES];

  return {
    company: a.company ?? "Sample company",
    lines: a.report.imported, skipped: a.report.skipped.reduce((t, x) => t + x.count, 0), vendors: a.vendors.length,
    categories: new Set(a.vendors.map((v) => v.category)).size, unclassified: a.vendors.filter((v) => v.category === "unclassified").reduce((t, v) => t + v.lines, 0),
    dateFrom: a.report.dateRange![0], dateTo: a.report.dateRange![1], format: a.report.format,
    revenueTtm: fin.revenueTtm, profitTtm: fin.operatingProfitTtm, marginTtm: fin.marginTtm,
    diesel: { spendTtm: d.spendTtm, share: d.shareOfRevenue, gallonsTtm: d.gallonsTtm, r2: d.fit.r2, fitN: d.fit.n, regionLabel: d.regionLabel, shockPct: shock.pct, shockNet: shock.netImpact, shockTimesProfit: shock.pctOfProfit ?? shock.netImpact / Math.max(1, fin.operatingProfitTtm), unsurcharged: d.unsurchargedShare },
    ledger: picked.map((l) => ({ date: l.date, vendor: l.vendor, memo: l.memo, amount: l.amount, label: labelOf.get(l.category) ?? l.category, fuel: l.category === "fleet_fuel", rule: l.rule, confidence: l.confidence })),
    categoryRows,
    monthly: d.monthly.filter((m) => m.pricePaid != null && m.index != null).map((m) => ({ month: m.month, pricePaid: m.pricePaid as number, index: m.index as number })),
    backtest: { n: bt.n, from: bt.from, to: bt.to, paidShare: bt.shareOfCohortsPaid, bad: bt.badCohorts, badPaid: Math.round(bt.badPaidShare * bt.badCohorts), badPaidShare: bt.badPaidShare, varianceReduction: bt.varianceReduction },
    policy: {
      inceptionMonth: p.inceptionMonth, inceptionIndex: p.inceptionIndex, strike: p.strike,
      rows: p.replay.map((r) => ({ month: r.month, index: r.index, payout: r.payout, triggered: r.triggered })),
      totalPayout: p.totalPayout, totalExtraCost: p.totalExtraCost, paidMonths: p.replay.filter((r) => r.payout > 0).length,
      premiumPerGallon: p.priceAtInception.premiumPerGallon, premiumPerMonth: p.priceAtInception.premiumPerMonth, sigma: p.priceAtInception.sigma,
    },
    wholesaleR2: a.wholesale.r2Annual,
    pool: { id: a.pool!.poolId, status: a.pool!.status, confidence: a.pool!.confidence },
    settlement: { month: s.month, indexMean: s.indexMean, gallons, stepAmount, steps, paidSteps, payout: stepAmount * paidSteps, funded: stepAmount * nSteps },
    eia: { sha256: createHash("sha256").update(bytes).digest("hex"), fetchedAt: series.fetchedAt, title: series.title },
  };
}
