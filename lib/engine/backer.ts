/** Hypothetical full-term backer economics. The devnet demo funds one month
 * and collects no premium; these figures must never be labelled as realized.
 */
export function backerEconomics(input: {
  months: number;
  maxCoveredGallonsPerMonth: number;
  maxPayoutPerGallon: number;
  aggregateLimit: number;
  modelPremium: number;
  replayPayout: number;
}) {
  const { months, maxCoveredGallonsPerMonth, maxPayoutPerGallon, aggregateLimit, modelPremium, replayPayout } = input;
  if (![months, maxCoveredGallonsPerMonth, maxPayoutPerGallon, aggregateLimit, modelPremium, replayPayout].every(Number.isFinite)
    || !Number.isInteger(months) || months < 1 || maxCoveredGallonsPerMonth < 0 || maxPayoutPerGallon < 0
    || aggregateLimit < 0 || modelPremium < 0 || replayPayout < 0) throw new Error("Invalid backer economics inputs");
  const maximumLiability = Math.min(aggregateLimit, months * maxCoveredGallonsPerMonth * maxPayoutPerGallon);
  const grossResult = modelPremium - replayPayout;
  return {
    maximumLiability,
    modelPremium,
    replayPayout,
    grossResult,
    returnOnReservedCapital: maximumLiability > 0 ? grossResult / maximumLiability : null,
    premiumToMaximumLiability: maximumLiability > 0 ? modelPremium / maximumLiability : null,
  };
}

/** Stress the same illustrative contract against each rolling historical cohort.
 * Holds the quoted premium and covered annual gallons fixed; this is not a
 * historical underwriting track record or a forecast.
 */
export function cohortStress(input: {
  payoutPerGallon: number[];
  annualGallons: number;
  aggregateLimit: number;
  modelPremium: number;
  reservedCapital: number;
}) {
  const { payoutPerGallon, annualGallons, aggregateLimit, modelPremium, reservedCapital } = input;
  if (!payoutPerGallon.length || !payoutPerGallon.every((x) => Number.isFinite(x) && x >= 0)
    || ![annualGallons, aggregateLimit, modelPremium, reservedCapital].every((x) => Number.isFinite(x) && x >= 0)) {
    throw new Error("Invalid cohort stress inputs");
  }
  const payouts = payoutPerGallon.map((x) => Math.min(aggregateLimit, x * annualGallons));
  const meanPayout = payouts.reduce((a, b) => a + b, 0) / payouts.length;
  const worstPayout = Math.max(...payouts);
  const losingCohorts = payouts.filter((x) => x > modelPremium).length;
  return {
    cohorts: payouts.length,
    meanPayout,
    worstPayout,
    lossRatio: modelPremium > 0 ? meanPayout / modelPremium : null,
    meanGrossResult: modelPremium - meanPayout,
    meanReturnOnReservedCapital: reservedCapital > 0 ? (modelPremium - meanPayout) / reservedCapital : null,
    losingCohorts,
  };
}
