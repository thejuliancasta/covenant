/** Cap payout for one month: (index mean - strike), floored at zero, times covered gallons. */
export const capPayout = (indexMean: number, strike: number, coveredGallons: number) => Math.max(0, indexMean - strike) * coveredGallons;

export interface ScenarioInput {
  gallonsPerMonth: number; coveredShare: number; priceRise: number; strikeOffset: number;
  premiumPerMonth: number; /** $/gal standard deviation of this firm's price around the index. */ basisStd: number;
}
export interface ScenarioResult {
  extraCost: number; passedThrough: number; exposedCost: number; payout: number; unhedged: number;
  premium: number; net: number; netWithoutCover: number; offsetShare: number; basisBand: number;
}

/** One-month scenario. Deterministic: every output is arithmetic on the inputs. */
export function scenario(s: ScenarioInput): ScenarioResult {
  const extraCost = s.gallonsPerMonth * s.priceRise;
  const covered = s.gallonsPerMonth * s.coveredShare;
  const exposedCost = covered * s.priceRise;
  const passedThrough = extraCost - exposedCost;
  const payout = Math.max(0, s.priceRise - s.strikeOffset) * covered;
  return {
    extraCost, passedThrough, exposedCost, payout, unhedged: exposedCost - payout, premium: s.premiumPerMonth,
    net: -(exposedCost - payout) - s.premiumPerMonth, netWithoutCover: -exposedCost,
    offsetShare: exposedCost > 0 ? payout / exposedCost : 0, basisBand: 1.96 * s.basisStd * covered,
  };
}

export interface ReplayRow {
  month: string; index: number; strike: number; gallons: number; coveredGallons: number;
  pricePaid: number | null; extraCost: number; payout: number; cumulativePayout: number; triggered: boolean;
}

/** Replays a purchase-linked cap over real index history and the ledger's own gallons. */
export function replayPolicy(p: {
  inceptionIndex: number; strikeOffset: number; coveredShare: number;
  rows: { month: string; gallons: number; pricePaid: number | null; index: number | null }[];
  maxCoveredGallons?: number; aggregateLimit?: number;
}): ReplayRow[] {
  const strike = p.inceptionIndex + p.strikeOffset;
  let cum = 0;
  return p.rows.filter((r) => r.index !== null).map((r) => {
    const coveredGallons = Math.min(r.gallons * p.coveredShare, p.maxCoveredGallons ?? Infinity);
    let payout = capPayout(r.index!, strike, coveredGallons);
    if (p.aggregateLimit !== undefined) payout = Math.min(payout, Math.max(0, p.aggregateLimit - cum));
    cum += payout;
    return {
      month: r.month, index: r.index!, strike, gallons: r.gallons, coveredGallons, pricePaid: r.pricePaid,
      extraCost: Math.max(0, r.index! - p.inceptionIndex) * coveredGallons, payout, cumulativePayout: cum, triggered: payout > 0,
    };
  });
}
