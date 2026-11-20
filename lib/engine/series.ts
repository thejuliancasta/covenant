import dieselUs from "../data/diesel_us_weekly.json";
import dieselPadd2 from "../data/diesel_padd2_weekly.json";
import ulsd from "../data/ulsd_nyh_monthly.json";
import brent from "../data/brent_monthly.json";

export interface Series {
  id: string;
  title: string;
  unit: string;
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  evidence: string;
  points: [string, number][];
}

export const SERIES = {
  diesel_us_weekly: dieselUs as unknown as Series,
  diesel_padd2_weekly: dieselPadd2 as unknown as Series,
  ulsd_nyh_monthly: ulsd as unknown as Series,
  brent_monthly: brent as unknown as Series,
};
export type SeriesId = keyof typeof SERIES;

export const REGIONS: Record<string, { label: string; series: SeriesId }> = {
  US: { label: "U.S. average", series: "diesel_us_weekly" },
  PADD2: { label: "Midwest (PADD 2)", series: "diesel_padd2_weekly" },
};

/** Mean of all observations in each calendar month, keyed YYYY-MM. */
export function monthlyMean(points: [string, number][]): Map<string, number> {
  const acc = new Map<string, { s: number; n: number }>();
  for (const [d, v] of points) {
    const k = d.slice(0, 7);
    const a = acc.get(k) ?? { s: 0, n: 0 };
    a.s += v; a.n += 1;
    acc.set(k, a);
  }
  return new Map([...acc].map(([k, a]) => [k, a.s / a.n]));
}

/** Last observation on or before the given ISO date. */
export function valueOnOrBefore(points: [string, number][], date: string): number | undefined {
  let lo = 0, hi = points.length - 1, ans: number | undefined;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid][0] <= date) { ans = points[mid][1]; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

export function addMonths(ym: string, n: number): string {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1 + n;
  return `${y + Math.floor(m / 12)}-${String((((m % 12) + 12) % 12) + 1).padStart(2, "0")}`;
}

export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
}

/** Calendar-year average and year-on-year percentage change. */
export function annualChanges(points: [string, number][], fromYear: number, toYear: number) {
  const byYear = new Map<number, { s: number; n: number }>();
  for (const [d, v] of points) {
    const y = Number(d.slice(0, 4));
    const a = byYear.get(y) ?? { s: 0, n: 0 };
    a.s += v; a.n += 1;
    byYear.set(y, a);
  }
  const avg = (y: number) => { const a = byYear.get(y); return a ? a.s / a.n : NaN; };
  const out: { year: number; avg: number; change: number }[] = [];
  for (let y = fromYear; y <= toYear; y++) out.push({ year: y, avg: avg(y), change: avg(y) / avg(y - 1) - 1 });
  return out;
}
