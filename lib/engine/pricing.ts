import { normCdf } from "./stats";

/** Black-76 price of a European call on a forward. */
export function black76Call(F: number, K: number, T: number, sigma: number, r = 0): number {
  if (T <= 0 || sigma <= 0) return Math.max(0, F - K) * Math.exp(-r * Math.max(T, 0));
  const sd = sigma * Math.sqrt(T);
  const d1 = (Math.log(F / K) + 0.5 * sd * sd) / sd;
  return Math.exp(-r * T) * (F * normCdf(d1) - K * normCdf(d1 - sd));
}

export interface CapPrice {
  forward: number; strike: number; sigma: number; rate: number; load: number;
  perMonth: { m: number; T: number; callPerGallon: number; gallons: number; cost: number }[];
  hedgeCost: number; hedgeCostPerGallon: number; premium: number; premiumPerGallon: number; premiumPerMonth: number;
}

/**
 * Prices a 12-month diesel cap as a strip of monthly calls on wholesale ULSD.
 * Assumptions (all shown in the UI): flat forward curve at the current spot,
 * one volatility for all expiries, each month's average-price payoff valued as
 * a European call expiring mid-month, and a total load on top of hedge cost.
 * The wholesale strike sits the same distance above wholesale spot as the
 * retail strike sits above the retail index (K_w = K_retail - spread).
 */
export function priceCap(p: { forward: number; strikeOffset: number; sigma: number; monthlyGallons: number[]; hedgeRatio: number; rate?: number; load?: number }): CapPrice {
  const rate = p.rate ?? 0, load = p.load ?? 0.3, strike = p.forward + p.strikeOffset;
  const perMonth = p.monthlyGallons.map((g, i) => {
    const T = (i + 0.5) / 12, callPerGallon = black76Call(p.forward, strike, T, p.sigma, rate), gallons = g * p.hedgeRatio;
    return { m: i + 1, T, callPerGallon, gallons, cost: callPerGallon * gallons };
  });
  const hedgeCost = perMonth.reduce((a, b) => a + b.cost, 0), gallons = p.monthlyGallons.reduce((a, b) => a + b, 0);
  const premium = hedgeCost / (1 - load);
  return {
    forward: p.forward, strike, sigma: p.sigma, rate, load, perMonth, hedgeCost, hedgeCostPerGallon: gallons ? hedgeCost / gallons : 0,
    premium, premiumPerGallon: gallons ? premium / gallons : 0, premiumPerMonth: premium / p.monthlyGallons.length,
  };
}
