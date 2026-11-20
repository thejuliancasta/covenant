/**
 * Gemini Prediction Markets: public market-data client and hedge evaluation.
 * Endpoints used (no API key): GET /v1/prediction-markets/events and GET /v1/book/:symbol.
 * Nothing here places orders. Evaluation functions are pure so they can be
 * tested against recorded fixtures.
 */
import { normInv, ols } from "./stats";
import { black76Call } from "./pricing";
import type { RiskFactor } from "./types";

export const GEMINI_BASE = "https://api.gemini.com";

export interface GeminiContract { symbol: string; label: string; strike: number | null; strikeType: string | null; bid: number | null; ask: number | null; last: number | null }
export interface GeminiEvent {
  ticker: string; title: string; category: string; series: string | null; expiry: string | null; volume: number;
  index: string | null; template: string | null; contracts: GeminiContract[];
}
export interface BookLevel { price: number; amount: number }
export interface Book { bids: BookLevel[]; asks: BookLevel[] }

const num = (x: unknown) => (x === null || x === undefined || x === "" ? null : Number(x));

export function normalizeEvent(e: any): GeminiEvent {
  return {
    ticker: e.ticker, title: e.title, category: e.category, series: e.series ?? null, expiry: e.expiryDate ?? null,
    volume: Number(e.volume ?? 0), index: e.sourceDetails?.index ?? null, template: e.template ?? null,
    contracts: (e.contracts ?? []).map((c: any) => ({
      symbol: c.instrumentSymbol, label: c.label, strike: num(c.strike?.value), strikeType: c.strike?.type ?? null,
      bid: num(c.prices?.bestBid), ask: num(c.prices?.bestAsk), last: num(c.prices?.lastTradePrice),
    })),
  };
}

export async function fetchEvents(category: string, fetcher: typeof fetch = fetch): Promise<GeminiEvent[]> {
  const url = `${GEMINI_BASE}/v1/prediction-markets/events?status=active&category=${encodeURIComponent(category)}&limit=500`;
  const res = await fetcher(url, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`Gemini events ${category}: HTTP ${res.status}`);
  return ((await res.json()).data ?? []).map(normalizeEvent);
}

export async function fetchBook(symbol: string, fetcher: typeof fetch = fetch): Promise<Book> {
  const res = await fetcher(`${GEMINI_BASE}/v1/book/${symbol}?limit_bids=20&limit_asks=20`, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`Gemini book ${symbol}: HTTP ${res.status}`);
  const j = await res.json();
  const lv = (xs: any[]) => (xs ?? []).map((l) => ({ price: Number(l.price), amount: Number(l.amount) }));
  return { bids: lv(j.bids), asks: lv(j.asks) };
}

export interface MarketMapping { factor: RiskFactor | "none"; relation: "benchmark" | "proxy" | "driver" | "unrelated"; reason: string }

/** Maps a listed event to a business cost driver. Transparent keyword rules, no model. */
export function mapEvent(e: GeminiEvent): MarketMapping {
  const s = `${e.series ?? ""} ${e.ticker} ${e.title}`.toUpperCase();
  if (/\b(DIESEL|ULSD|HEATING OIL)\b/.test(s)) return { factor: "diesel", relation: "benchmark", reason: "Settles on a diesel price." };
  if (/\b(BRENT|WTI|CRUDE)\b/.test(s)) return { factor: "diesel", relation: "proxy", reason: "Crude oil is the main input to diesel, but it is not the diesel price." };
  if (/HORMUZ|OPEC/.test(s)) return { factor: "diesel", relation: "driver", reason: "An event that moves oil prices. The payout is not tied to any price level." };
  if (/\b(NGAS|NATURAL GAS|HENRY HUB)\b/.test(s)) return { factor: "natural_gas", relation: "benchmark", reason: "Settles on a natural gas price." };
  if (/\bFED\b|FOMC|INTEREST RATE/.test(s)) return { factor: "interest_rate", relation: "driver", reason: "Fed decisions move variable loan rates." };
  if (/ELECTRIC|POWER PRICE/.test(s)) return { factor: "electricity", relation: "benchmark", reason: "Settles on a power price." };
  return { factor: "none", relation: "unrelated", reason: "No link to an operating cost in this ledger." };
}

export interface ImpliedDistribution {
  points: { strike: number; bid: number; ask: number; mid: number }[];
  median: number; sigmaPeriod: number; sigmaAnnual: number; days: number; fitR2: number; nUsed: number;
}

/**
 * Reads a ladder of "price above K" binaries as a survival curve P(S > K) and
 * fits a lognormal: ln K = mu + s * z, with z = N^-1(1 - P). The slope s is the
 * standard deviation of the log price at expiry; annualised it is an implied
 * volatility. Only strikes with a two-sided quote and a mid between 5% and 95%
 * are used.
 */
export function impliedDistribution(contracts: GeminiContract[], days: number): ImpliedDistribution | null {
  const pts = contracts
    .filter((c) => c.strikeType === "above" && c.strike !== null && c.bid !== null && c.ask !== null)
    .map((c) => ({ strike: c.strike!, bid: c.bid!, ask: c.ask!, mid: (c.bid! + c.ask!) / 2 }))
    .filter((p) => p.mid >= 0.05 && p.mid <= 0.95)
    .sort((a, b) => a.strike - b.strike);
  if (pts.length < 3 || days <= 0) return null;
  const fit = ols(pts.map((p) => [normInv(1 - p.mid)]), pts.map((p) => Math.log(p.strike)));
  const s = fit.beta[1];
  if (!(s > 0)) return null;
  return { points: pts, median: Math.exp(fit.beta[0]), sigmaPeriod: s, sigmaAnnual: s / Math.sqrt(days / 365), days, fitR2: fit.r2, nUsed: pts.length };
}

export interface Replication {
  startStrike: number; dollarsPerUnit: number;
  legs: { symbol: string; strike: number; width: number; contracts: number; ask: number | null; filled: number; cost: number; shortfall: number }[];
  maxPayout: number; cost: number; filledShare: number; modelValue: number | null;
}

/**
 * A linear cap above K0 can be built from the ladder: holding (D x width_i)
 * contracts at each strike K_i >= K0 pays about D dollars per unit the index
 * finishes above K0, up to the top strike. Walks each ask book for the size
 * needed and reports any shortfall as unhedgeable.
 */
export function replicateCap(contracts: GeminiContract[], books: Record<string, Book>, dollarsPerUnit: number, startStrike: number, dist: ImpliedDistribution | null): Replication | null {
  const ladder = contracts.filter((c) => c.strikeType === "above" && c.strike !== null && c.strike >= startStrike).sort((a, b) => a.strike! - b.strike!);
  if (ladder.length < 2) return null;
  const legs = ladder.map((c, i) => {
    const width = i < ladder.length - 1 ? ladder[i + 1].strike! - c.strike! : c.strike! - ladder[i - 1].strike!;
    const need = dollarsPerUnit * width;
    let left = need, cost = 0;
    for (const lvl of books[c.symbol]?.asks ?? []) {
      const take = Math.min(left, lvl.amount);
      cost += take * lvl.price; left -= take;
      if (left <= 0) break;
    }
    return { symbol: c.symbol, strike: c.strike!, width, contracts: need, ask: c.ask, filled: need - left, cost, shortfall: left };
  });
  const need = legs.reduce((a, l) => a + l.contracts, 0), filled = legs.reduce((a, l) => a + l.filled, 0);
  const top = ladder[ladder.length - 1].strike! + legs[legs.length - 1].width;
  const T = dist ? dist.days / 365 : 0;
  const modelValue = dist ? dollarsPerUnit * (black76Call(dist.median, startStrike, T, dist.sigmaAnnual) - black76Call(dist.median, top, T, dist.sigmaAnnual)) : null;
  return { startStrike, dollarsPerUnit, legs, maxPayout: need, cost: legs.reduce((a, l) => a + l.cost, 0), filledShare: need ? filled / need : 0, modelValue };
}

export interface Check { name: string; pass: boolean; detail: string }
export interface HedgeVerdict { verdict: "candidate" | "signal only" | "rejected"; checks: Check[]; summary: string }

/** Explicit pass/fail thresholds. A market must pass every check to be a hedge candidate. */
export function evaluateEventHedge(p: {
  relation: MarketMapping["relation"]; daysToExpiry: number; coverDays: number; r2Annual: number | null;
  nearTouchDepth: number; poolNeed: number; settlesOnCustomerIndex: boolean; hasQuotes: boolean;
}): HedgeVerdict {
  const checks: Check[] = [
    { name: "Index match", pass: p.settlesOnCustomerIndex, detail: p.settlesOnCustomerIndex ? "Settles on the index the business pays." : "Settles on a different index than the one the business pays." },
    { name: "Tracks the cost (12-month R² at least 0.90)", pass: (p.r2Annual ?? 0) >= 0.9, detail: p.r2Annual === null ? "No measurable relationship." : `12-month R² is ${p.r2Annual.toFixed(2)}.` },
    { name: "Tenor covers at least half the cover period", pass: p.daysToExpiry >= p.coverDays / 2, detail: `Expires in ${p.daysToExpiry.toFixed(0)} days against ${p.coverDays} days of cover.` },
    { name: "Displayed depth covers one pool-month", pass: p.nearTouchDepth >= p.poolNeed, detail: `${Math.round(p.nearTouchDepth).toLocaleString("en-US")} contracts at the best ask against ${Math.round(p.poolNeed).toLocaleString("en-US")} needed per strike.` },
    { name: "Two-sided quotes", pass: p.hasQuotes, detail: p.hasQuotes ? "Live bid and ask present." : "No two-sided market right now." },
  ];
  const failed = checks.filter((c) => !c.pass);
  if (!failed.length) return { verdict: "candidate", checks, summary: "Passes every screen." };
  const useful = p.hasQuotes && p.relation !== "unrelated";
  return {
    verdict: useful ? "signal only" : "rejected", checks,
    summary: `${useful ? "Not a hedge. Useful as a live price signal." : "Rejected."} Fails: ${failed.map((f) => f.name).join("; ")}.`,
  };
}
