import type { DieselExposure, Financials } from "./exposure";

export interface PoolCriterion { name: string; weight: number; score: number; pass: boolean; hard: boolean; detail: string }
export interface PoolAssignment {
  poolId: string; factor: string; region: string; tenor: string; status: "member" | "watch list" | "not poolable";
  confidence: number; criteria: PoolCriterion[]; reasoning: string;
  sizing: { coveredGallonsPerMonth: number; hedgeRatio: number; contractGallons: number; contractsPerMonth: number; fleetsPerContractMonth: number };
}

export const ULSD_CONTRACT_GALLONS = 42_000;

/**
 * Risk-pool classification. A pool is (cost driver x region x cover period):
 * every member's payout moves on the same index, so the pool can be hedged with
 * one position. Membership needs four hard criteria; confidence is the
 * weighted score of all six. Joining a pool does NOT mean protection is
 * available: that also needs a liquid hedge and a licensed risk carrier.
 */
export function assignDieselPool(d: DieselExposure, fin: Financials, coverStart: string, wholesaleHedgeRatio: number): PoolAssignment {
  const fuelCat = fin.categories.find((c) => c.category === "fleet_fuel");
  const conf = fuelCat?.avgConfidence ?? 0, months = fin.months.length;
  const r2 = d.fit.method === "ledger-regression" ? d.fit.r2 : 0;
  const criteria: PoolCriterion[] = [
    { name: "Cost driver identified", weight: 0.2, hard: true, score: conf, pass: conf >= 0.8, detail: `Spend-weighted classification confidence ${(conf * 100).toFixed(0)}% across ${fuelCat?.lines ?? 0} fuel lines.` },
    { name: "At least 12 months of history", weight: 0.15, hard: true, score: Math.min(1, months / 12), pass: months >= 12, detail: `${months} months in the ledger.` },
    { name: "Exposure is material", weight: 0.2, hard: true, score: d.material ? 1 : 0, pass: d.material, detail: d.materiality.map((m) => `${m.test}: ${m.value}`).join(". ") + "." },
    { name: "Cost tracks the regional index (R² at least 0.60)", weight: 0.2, hard: true, score: r2, pass: r2 >= 0.6,
      detail: d.fit.method === "ledger-regression" ? `R² ${r2.toFixed(2)} on ${d.fit.n} monthly changes against ${d.regionLabel}.` : "Not measurable: too few months with gallons on the record." },
    { name: "Quantities are on the record", weight: 0.1, hard: false, score: d.gallonsObservedShare, pass: d.gallonsObservedShare >= 0.8, detail: `${(d.gallonsObservedShare * 100).toFixed(0)}% of fuel spend has gallons in the ledger. The rest is estimated from the index.` },
    { name: "Some gallons are not already surcharged", weight: 0.15, hard: false, score: Math.min(1, d.unsurchargedShare / 0.2), pass: d.unsurchargedShare > 0.05, detail: `${(d.unsurchargedShare * 100).toFixed(0)}% of gallons treated as exposed.` },
  ];
  const confidence = criteria.reduce((a, c) => a + c.weight * Math.max(0, Math.min(1, c.score)), 0);
  const hardOk = criteria.filter((c) => c.hard).every((c) => c.pass);
  const status = hardOk && confidence >= 0.7 ? "member" : criteria[0].pass && criteria[1].pass ? "watch list" : "not poolable";
  const coveredGallonsPerMonth = (d.gallonsTtm / 12) * d.unsurchargedShare;
  const hedged = coveredGallonsPerMonth * wholesaleHedgeRatio;
  const failed = criteria.filter((c) => !c.pass).map((c) => c.name.toLowerCase());
  return {
    poolId: `DIESEL-${d.region}-${coverStart}-12M`, factor: "Diesel", region: d.regionLabel, tenor: `12 months from ${coverStart}`, status, confidence, criteria,
    reasoning: status === "member"
      ? `Fuel is a quoted market price for this business, it is large against profit, and the price paid follows the ${d.regionLabel} index.`
      : `Not a full member because: ${failed.join("; ")}.`,
    sizing: { coveredGallonsPerMonth, hedgeRatio: wholesaleHedgeRatio, contractGallons: ULSD_CONTRACT_GALLONS, contractsPerMonth: hedged / ULSD_CONTRACT_GALLONS, fleetsPerContractMonth: Math.ceil(ULSD_CONTRACT_GALLONS / hedged) },
  };
}
