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
