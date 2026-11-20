import { addMonths, monthlyMean } from "./series";
import { mean, variance } from "./stats";

export interface Cohort { inception: string; inceptionPrice: number; strike: number; costChangePerGallon: number; payoutPerGallon: number; paid: boolean }
export interface Backtest {
  cohorts: Cohort[]; n: number; from: string; to: string; strikeOffset: number;
  burnPerGallonYear: number; shareOfCohortsPaid: number; worstPayoutPerGallon: number; worstCohort: string;
  varianceReduction: number; badCohorts: number; badPaidShare: number; recoveryInBad: number;
  lossWithoutPayout: number; payoutWithoutLoss: number; badThresholdPerGallon: number;
}

/**
 * Rolling 12-month cohorts. A cohort that starts in month t fixes its strike at
 * the month-t index mean plus the offset and is covered for months t+1..t+12 on
 * equal monthly gallons. Per-gallon figures are averages over the cover year,
 * so multiplying by annual gallons gives dollars.
 */
export function backtestCap(weekly: [string, number][], opts: { from: string; to: string; strikeOffset: number; badThresholdPerGallon?: number }): Backtest {
  const idx = monthlyMean(weekly);
  const bad = opts.badThresholdPerGallon ?? 0.25;
  const cohorts: Cohort[] = [];
  for (let t = opts.from; t <= opts.to; t = addMonths(t, 1)) {
    const p0 = idx.get(t);
    const months = Array.from({ length: 12 }, (_, i) => idx.get(addMonths(t, i + 1)));
    if (p0 === undefined || months.some((m) => m === undefined)) continue;
    const strike = p0 + opts.strikeOffset;
    const payout = mean(months.map((m) => Math.max(0, m! - strike)));
    cohorts.push({ inception: t, inceptionPrice: p0, strike, costChangePerGallon: mean(months.map((m) => m! - p0)), payoutPerGallon: payout, paid: payout > 0 });
  }
  const dc = cohorts.map((c) => c.costChangePerGallon), pay = cohorts.map((c) => c.payoutPerGallon);
  const worst = cohorts.reduce((a, b) => (b.payoutPerGallon > a.payoutPerGallon ? b : a));
  const badSet = cohorts.filter((c) => c.costChangePerGallon > bad);
  return {
    cohorts, n: cohorts.length, from: cohorts[0].inception, to: cohorts[cohorts.length - 1].inception, strikeOffset: opts.strikeOffset,
    burnPerGallonYear: mean(pay), shareOfCohortsPaid: cohorts.filter((c) => c.paid).length / cohorts.length,
    worstPayoutPerGallon: worst.payoutPerGallon, worstCohort: worst.inception,
    varianceReduction: 1 - variance(dc.map((d, i) => d - pay[i])) / variance(dc),
    badCohorts: badSet.length, badThresholdPerGallon: bad,
    badPaidShare: badSet.length ? badSet.filter((c) => c.paid).length / badSet.length : NaN,
    recoveryInBad: badSet.length ? badSet.reduce((a, c) => a + c.payoutPerGallon, 0) / badSet.reduce((a, c) => a + c.costChangePerGallon, 0) : NaN,
    lossWithoutPayout: badSet.filter((c) => !c.paid).length / cohorts.length,
    payoutWithoutLoss: cohorts.filter((c) => c.paid && c.costChangePerGallon <= 0).length / cohorts.length,
  };
}
