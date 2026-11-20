import { describe, expect, it } from "vitest";
import { backerEconomics, cohortStress } from "@/lib/engine/backer";

describe("full-term backer exposure", () => {
  it("reserves the smaller of the aggregate cap and the sum of monthly maxima", () => {
    const x = backerEconomics({ months: 12, maxCoveredGallonsPerMonth: 4000, maxPayoutPerGallon: 2,
      aggregateLimit: 75_000, modelPremium: 4_332, replayPayout: 25_952 });
    expect(x.maximumLiability).toBe(75_000);
    expect(x.grossResult).toBe(-21_620);
    expect(x.returnOnReservedCapital).toBeCloseTo(-21_620 / 75_000);
    expect(backerEconomics({ months: 12, maxCoveredGallonsPerMonth: 4000, maxPayoutPerGallon: 2,
      aggregateLimit: 100_000, modelPremium: 4_332, replayPayout: 0 }).maximumLiability).toBe(96_000);
  });

  it("rejects nonsensical terms and does not divide by zero", () => {
    expect(() => backerEconomics({ months: 0, maxCoveredGallonsPerMonth: 1, maxPayoutPerGallon: 2,
      aggregateLimit: 1, modelPremium: 1, replayPayout: 0 })).toThrow();
    const empty = backerEconomics({ months: 1, maxCoveredGallonsPerMonth: 0, maxPayoutPerGallon: 2,
      aggregateLimit: 0, modelPremium: 0, replayPayout: 0 });
    expect(empty.returnOnReservedCapital).toBeNull();
  });
});

it("caps each cohort payout and exposes loss ratios without treating overlapping cohorts as realized years", () => {
  const x = cohortStress({ payoutPerGallon: [0, 0.5, 2], annualGallons: 1000,
    aggregateLimit: 1500, modelPremium: 400, reservedCapital: 1500 });
  expect(x.cohorts).toBe(3);
  expect(x.meanPayout).toBeCloseTo(2000 / 3);
  expect(x.lossRatio).toBeCloseTo(5 / 3);
  expect(x.losingCohorts).toBe(2);
  expect(x.worstPayout).toBe(1500);
  expect(x.meanReturnOnReservedCapital).toBeCloseTo((400 - 2000 / 3) / 1500);
  expect(() => cohortStress({ payoutPerGallon: [NaN], annualGallons: 1, aggregateLimit: 1, modelPremium: 1, reservedCapital: 1 })).toThrow();
});
