import type { ClassifiedLine, Evidence, RiskFactor } from "./types";
import { CATEGORY_LABEL } from "./classify";
import { REGIONS, SERIES, addMonths, annualChanges, monthRange, monthlyMean } from "./series";
import { mean, ols, quantile, stdev, sum } from "./stats";

export interface CategorySummary {
  category: string; label: string; riskFactor: RiskFactor; ttm: number; shareOfExpenses: number; shareOfRevenue: number;
  /** Coefficient of variation of monthly spend over the trailing 12 months. */
  cv: number;
  /** Largest month-on-month increase in the trailing 12 months, as a fraction. */
  maxMoM: number;
  lines: number; avgConfidence: number;
}

export interface Financials {
  months: string[]; ttm: string[];
  revenueTtm: number; expensesTtm: number; operatingProfitTtm: number; marginTtm: number;
  /** Herfindahl index of expense-category shares (1 = all spend in one category). */
  hhi: number;
  classifiedShare: number;
  monthly: { month: string; revenue: number; expenses: number; byCategory: Record<string, number> }[];
  categories: CategorySummary[];
}

export function financials(lines: ClassifiedLine[]): Financials {
  const all = [...new Set(lines.map((l) => l.month))].sort();
  // Drop a trailing month whose last transaction falls before the 20th: it is incomplete.
  const last = all[all.length - 1];
  const lastDay = Math.max(...lines.filter((l) => l.month === last).map((l) => Number(l.date.slice(8, 10))));
  const months = lastDay < 20 && all.length > 1 ? all.slice(0, -1) : all;
  const ttm = months.slice(-12);
  const monthly = months.map((month) => ({ month, revenue: 0, expenses: 0, byCategory: {} as Record<string, number> }));
  const idx = new Map(monthly.map((m, i) => [m.month, i]));
  for (const l of lines) {
    const i = idx.get(l.month);
    if (i === undefined) continue;
    if (l.direction === "income") monthly[i].revenue += l.amount;
    else { monthly[i].expenses += l.amount; monthly[i].byCategory[l.category] = (monthly[i].byCategory[l.category] ?? 0) + l.amount; }
  }
  const t = monthly.filter((m) => ttm.includes(m.month));
  const revenueTtm = sum(t.map((m) => m.revenue)), expensesTtm = sum(t.map((m) => m.expenses));
  const cats = [...new Set(lines.filter((l) => l.direction === "expense").map((l) => l.category))];
  const categories: CategorySummary[] = cats.map((category) => {
    const series = t.map((m) => m.byCategory[category] ?? 0);
    const total = sum(series);
    const own = lines.filter((l) => l.category === category && ttm.includes(l.month));
    const moms = series.slice(1).map((v, i) => (series[i] > 0 ? v / series[i] - 1 : 0));
    return {
      category, label: CATEGORY_LABEL[category] ?? category, riskFactor: own[0]?.riskFactor ?? "none", ttm: total,
      shareOfExpenses: total / expensesTtm, shareOfRevenue: revenueTtm ? total / revenueTtm : NaN,
      cv: series.length > 1 && mean(series) > 0 ? stdev(series) / mean(series) : 0,
      maxMoM: moms.length ? Math.max(...moms) : 0, lines: own.length,
      avgConfidence: total ? sum(own.map((l) => l.confidence * l.amount)) / total : 0,
    };
  }).sort((a, b) => b.ttm - a.ttm);
  const unclassified = categories.find((c) => c.category === "unclassified")?.ttm ?? 0;
  return {
    months, ttm, revenueTtm, expensesTtm, operatingProfitTtm: revenueTtm - expensesTtm,
    marginTtm: revenueTtm ? (revenueTtm - expensesTtm) / revenueTtm : NaN,
    hhi: sum(categories.map((c) => c.shareOfExpenses ** 2)), classifiedShare: 1 - unclassified / expensesTtm, monthly, categories,
  };
}

export interface Shock { label: string; pct: number; basis: string; grossImpact: number; netImpact: number; pctOfProfit: number | null; evidence: Evidence }

export interface IndexFit {
  method: "ledger-regression" | "default";
  b0: number; b1: number; hedgeRatio: number; r2: number; r2NoLag: number; n: number; residualStd: number;
  /** Mean of (price paid - index) in $/gal over the fitted months. */
  levelBasis: number;
  evidence: Evidence; note: string;
}

export interface DieselExposure {
  factor: "diesel"; region: string; regionLabel: string; indexSeries: string;
  spendTtm: number; gallonsTtm: number; gallonsObservedShare: number; avgPricePaidTtm: number;
  shareOfRevenue: number; shareOfExpenses: number;
  monthly: { month: string; spend: number; gallons: number; pricePaid: number | null; index: number | null }[];
  fit: IndexFit;
  surcharge: { detected: boolean; incomeTtm: number; surchargedRevenueShare: number; suggestedUnsurchargedShare: number; note: string };
  unsurchargedShare: number;
  shockHistory: { year: number; change: number }[];
  shocks: Shock[];
  material: boolean; materiality: { test: string; value: string; pass: boolean }[];
}

/** Regression of monthly changes: dY_t = a + b0 dX_t + b1 dX_(t-1). Returns fits with and without the lag. */
export function lagFit(y: number[], x: number[]) {
  const dy = y.slice(1).map((v, i) => v - y[i]), dx = x.slice(1).map((v, i) => v - x[i]);
  const noLag = ols(dx.map((v) => [v]), dy);
  const withLag = ols(dx.slice(1).map((v, i) => [v, dx[i]]), dy.slice(1));
  return { noLag, withLag };
}

export function dieselExposure(lines: ClassifiedLine[], fin: Financials, opts: { region: string; unsurchargedShare?: number }): DieselExposure | null {
  const fuel = lines.filter((l) => l.category === "fleet_fuel" && fin.months.includes(l.month));
  if (!fuel.length) return null;
  const region = REGIONS[opts.region] ?? REGIONS.US;
  const index = SERIES[region.series];
  const idxMonthly = monthlyMean(index.points);
  const monthly = fin.months.map((month) => {
    const ls = fuel.filter((l) => l.month === month);
    const obs = ls.filter((l) => l.quantitySource === "ledger");
    return {
      month, spend: sum(ls.map((l) => l.amount)), gallons: sum(ls.map((l) => l.quantity ?? 0)),
      pricePaid: obs.length ? sum(obs.map((l) => l.amount)) / sum(obs.map((l) => l.quantity!)) : null,
      index: idxMonthly.get(month) ?? null,
    };
  });
  const ttmRows = monthly.filter((m) => fin.ttm.includes(m.month));
  const spendTtm = sum(ttmRows.map((m) => m.spend)), gallonsTtm = sum(ttmRows.map((m) => m.gallons));
  const ttmFuel = fuel.filter((l) => fin.ttm.includes(l.month));
  const gallonsObservedShare = sum(ttmFuel.filter((l) => l.quantitySource === "ledger").map((l) => l.amount)) / spendTtm;

  // Index fit: only when the ledger itself records gallons. Estimated gallons are derived
  // from the index, so regressing them on the index would be circular.
  const usable = monthly.filter((m) => m.pricePaid !== null && m.index !== null);
  let fit: IndexFit;
  if (usable.length >= 14) {
    const { noLag, withLag } = lagFit(usable.map((m) => m.pricePaid!), usable.map((m) => m.index!));
    fit = {
      method: "ledger-regression", b0: withLag.beta[1], b1: withLag.beta[2], hedgeRatio: withLag.beta[1] + withLag.beta[2],
      r2: withLag.r2, r2NoLag: noLag.r2, n: withLag.n, residualStd: withLag.residualStd,
      levelBasis: mean(usable.map((m) => m.pricePaid! - m.index!)), evidence: "C",
      note: `OLS on ${withLag.n} monthly changes of the price this business paid per gallon against the ${region.label} index.`,
    };
  } else {
    fit = {
      method: "default", b0: 1, b1: 0, hedgeRatio: 1, r2: NaN, r2NoLag: NaN, n: usable.length, residualStd: NaN, levelBasis: NaN, evidence: "A",
      note: "Fewer than 14 months with gallons on the record. The fit to the index is assumed, not measured.",
    };
  }

  // Fuel-surcharge detection: customers who pay a surcharge already carry that fuel risk.
  const income = lines.filter((l) => l.direction === "income" && fin.ttm.includes(l.month));
  const fsc = income.filter((l) => l.category === "fuel_surcharge_income");
  const fscCustomers = new Set(fsc.map((l) => l.vendorNorm));
  const surchargedRevenue = sum(income.filter((l) => fscCustomers.has(l.vendorNorm)).map((l) => l.amount));
  const surchargedRevenueShare = fin.revenueTtm ? surchargedRevenue / fin.revenueTtm : 0;
  const suggested = fsc.length ? Math.min(1, Math.max(0, 1 - surchargedRevenueShare)) : 1;
  const unsurchargedShare = opts.unsurchargedShare ?? Math.round(suggested * 100) / 100;

  const lastFullYear = Number(index.points[index.points.length - 1][0].slice(0, 4)) - 1;
  const hist = annualChanges(index.points, 2001, lastFullYear);
  const changes = hist.map((h) => h.change);
  const worst = hist.reduce((a, b) => (b.change > a.change ? b : a));
  const basis = `${region.label} annual average price changes, 2001 to ${lastFullYear}`;
  const profit = fin.operatingProfitTtm;
  const mk = (label: string, pct: number): Shock => {
    const gross = spendTtm * pct, net = gross * unsurchargedShare;
    return { label, pct, basis, grossImpact: gross, netImpact: net, pctOfProfit: profit > 0 ? net / profit : null, evidence: "C" };
  };
  const shocks = [mk("1-in-5 year", quantile(changes, 0.8)), mk("1-in-20 year", quantile(changes, 0.95)), mk(`Worst year (${worst.year})`, worst.change)];
  const share = spendTtm / fin.revenueTtm;
  const s20 = shocks[1];
  const materiality = [
    { test: "Fuel is at least 5% of revenue", value: `${(share * 100).toFixed(1)}%`, pass: share >= 0.05 },
    { test: "A 1-in-20 price year costs at least 25% of operating profit, after surcharges",
      value: profit > 0 ? `${((s20.netImpact / profit) * 100).toFixed(0)}% of profit` : "Operating profit is zero or negative, so any increase is material",
      pass: profit <= 0 || s20.netImpact / profit >= 0.25 },
  ];
  return {
    factor: "diesel", region: opts.region, regionLabel: region.label, indexSeries: region.series, spendTtm, gallonsTtm, gallonsObservedShare,
    avgPricePaidTtm: spendTtm / gallonsTtm, shareOfRevenue: share, shareOfExpenses: spendTtm / fin.expensesTtm, monthly, fit,
    surcharge: {
      detected: fsc.length > 0, incomeTtm: sum(fsc.map((l) => l.amount)), surchargedRevenueShare, suggestedUnsurchargedShare: suggested,
      note: fsc.length
        ? "Estimated from the share of revenue that comes from customers who pay a fuel surcharge. Revenue share is a proxy for gallons, not a measurement."
        : "No fuel-surcharge income found in the ledger, so all gallons are treated as exposed.",
    },
    unsurchargedShare, shockHistory: hist.map(({ year, change }) => ({ year, change })), shocks,
    material: materiality.every((m) => m.pass), materiality,
  };
}

export interface OtherExposure {
  factor: RiskFactor | "none"; category: string; label: string; spendTtm: number; shareOfRevenue: number;
  benchmark: string; instrument: string; verdict: "viable" | "weak" | "poor fit" | "no instrument" | "not priced";
  shock1in20: number | null; impact1in20: number | null; material: boolean; reason: string; evidence: Evidence;
}

/** Research defaults for non-diesel drivers (annual price changes 2001 to 2025). See docs/MODEL.md. */
const DEFAULTS: Record<string, { benchmark: string; instrument: string; verdict: OtherExposure["verdict"]; s20: number | null }> = {
  natural_gas: { benchmark: "Henry Hub, with 1 to 2 month lag to delivered bills", instrument: "Micro Henry Hub futures and options", verdict: "viable", s20: 0.27 },
  electricity: { benchmark: "State commercial tariff", instrument: "Wholesale hub futures do not track the tariff", verdict: "poor fit", s20: 0.07 },
  interest: { benchmark: "SOFR", instrument: "SOFR futures (a swap, with no insurance framing)", verdict: "not priced", s20: null },
};

export function otherExposures(fin: Financials): OtherExposure[] {
  return fin.categories.filter((c) => c.category !== "fleet_fuel").map((c) => {
    const d = DEFAULTS[c.category];
    const impact = d?.s20 != null ? c.ttm * d.s20 : null;
    const material = !!d && c.shareOfRevenue >= 0.05 && impact !== null && (fin.operatingProfitTtm <= 0 || impact / fin.operatingProfitTtm >= 0.25);
    return {
      factor: c.riskFactor, category: c.category, label: c.label, spendTtm: c.ttm, shareOfRevenue: c.shareOfRevenue,
      benchmark: d?.benchmark ?? "None", instrument: d?.instrument ?? "Nothing usable trades on this cost",
      verdict: d?.verdict ?? "no instrument", shock1in20: d?.s20 ?? null, impact1in20: impact, material,
      reason: !d ? "No index or traded instrument tracks this cost. It cannot be hedged."
        : c.shareOfRevenue < 0.05 ? `Only ${(c.shareOfRevenue * 100).toFixed(1)}% of revenue. Below the 5% materiality screen.`
        : d.verdict === "not priced" ? "A clean index exists, but this prototype does not price rate cover." : "Passes the size screen.",
      evidence: d ? "C" : "V",
    };
  });
}

/** Relationship between two monthly price series, on changes. Used for wholesale and proxy hedges. */
export function monthlyRelation(yMonthly: Map<string, number>, xMonthly: Map<string, number>, from: string, to: string) {
  const months = monthRange(from, to).filter((m) => yMonthly.has(m) && xMonthly.has(m));
  const { noLag, withLag } = lagFit(months.map((m) => yMonthly.get(m)!), months.map((m) => xMonthly.get(m)!));
  // 12-month changes: the horizon that matters for annual cover.
  const y12: number[] = [], x12: number[] = [];
  for (const m of months) {
    const p = addMonths(m, -12);
    if (yMonthly.has(p) && xMonthly.has(p)) { y12.push(yMonthly.get(m)! - yMonthly.get(p)!); x12.push(xMonthly.get(m)! - xMonthly.get(p)!); }
  }
  const annual = y12.length > 3 ? ols(x12.map((v) => [v]), y12) : null;
  return {
    from: months[0], to: months[months.length - 1], n: withLag.n,
    r2NoLag: noLag.r2, slopeNoLag: noLag.beta[1], r2Lag: withLag.r2, b0: withLag.beta[1], b1: withLag.beta[2],
    r2Annual: annual?.r2 ?? NaN, slopeAnnual: annual?.beta[1] ?? NaN, residualStdLag: withLag.residualStd,
  };
}
