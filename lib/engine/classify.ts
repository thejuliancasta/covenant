import type { Category, ClassifiedLine, LedgerLine, RiskFactor } from "./types";
import { valueOnOrBefore } from "./series";

interface Rule {
  id: string;
  category: Category;
  riskFactor: RiskFactor;
  vendor?: RegExp;
  account?: RegExp;
  memo?: RegExp;
}

/**
 * Deterministic rules, evaluated in order. A line is matched on vendor,
 * account and memo independently; confidence rises with the number of fields
 * that agree. There is no LLM in this path: unmatched lines stay
 * "unclassified" and are reported as such.
 */
export const RULES: Rule[] = [
  { id: "fuel", category: "fleet_fuel", riskFactor: "diesel",
    vendor: /\b(PILOT|FLYING J|LOVE'?S|TA PETRO|PETRO STOPPING|CASEY'?S|KWIK TRIP|ROAD RANGER|CIRCLE K|SPEEDWAY|SAPP BROS|WEX|COMDATA|FLEETCOR|FUELMAN)\b/,
    account: /\b(fuel|diesel)\b(?!.*(surcharge|tax))/i, memo: /\b(dsl|diesel|ulsd|\d+(\.\d+)?\s*gal)\b/i },
  { id: "natgas", category: "natural_gas", riskFactor: "natural_gas", vendor: /\b(NICOR|PEOPLES GAS|ATMOS|CENTERPOINT|SOCALGAS|NATIONAL FUEL GAS|SPIRE)\b/, memo: /natural gas|therms?\b/i },
  { id: "electric", category: "electricity", riskFactor: "electricity", vendor: /\b(COMED|COMMONWEALTH EDISON|AMEREN|DUKE ENERGY|PG&E|CON ?ED|XCEL|DTE|ENTERGY|FPL)\b/, memo: /\b(electric|kwh)\b/i },
  { id: "payroll", category: "payroll", riskFactor: "none", vendor: /\b(GUSTO|ADP|PAYCHEX|PAYROLL)\b/, account: /payroll|wages|salar/i },
  { id: "insurance", category: "insurance", riskFactor: "none", vendor: /\b(PROGRESSIVE|GREAT WEST CASUALTY|NORTHLAND|TRAVELERS|STATE FARM|GEICO)\b/, account: /insurance/i },
  { id: "lease", category: "equipment_lease", riskFactor: "none", vendor: /\b(PENSKE|RYDER|PACCAR|DAIMLER TRUCK FINANCIAL)\b/, account: /lease|equipment rental/i },
  { id: "interest", category: "interest", riskFactor: "interest_rate", account: /interest/i, memo: /\binterest\b/i },
  { id: "maintenance", category: "maintenance", riskFactor: "none", vendor: /\b(RUSH TRUCK|TRUCK SERVICE|TIRE|DIESEL REPAIR|SPEEDCO|FLEETPRIDE)\b/, account: /repair|maintenance|tires?/i },
  { id: "tolls", category: "tolls_permits", riskFactor: "none", vendor: /\b(TOLLWAY|I-?PASS|E-?ZPASS|PREPASS|DEPT OF REVENUE|IRS)\b/, account: /toll|permit|licen[cs]e|ifta/i },
  { id: "software", category: "software_telecom", riskFactor: "none", vendor: /\b(SAMSARA|MOTIVE|DAT SOLUTIONS|VERIZON|AT&T|T-MOBILE)\b/, account: /software|subscription|telephone|telecom/i },
  { id: "rent", category: "rent", riskFactor: "none", account: /^rent\b|rent or lease of buildings/i, memo: /\brent\b/i },
  { id: "professional", category: "professional", riskFactor: "none", vendor: /\b(CPA|LAW|ATTORNEY)\b/, account: /professional|legal|accounting/i },
];

export const CATEGORY_LABEL: Record<string, string> = {
  fleet_fuel: "Fleet fuel", natural_gas: "Natural gas", electricity: "Electricity", payroll: "Payroll",
  insurance: "Insurance", equipment_lease: "Equipment leases", maintenance: "Repairs and tires",
  tolls_permits: "Tolls, permits and fuel tax", interest: "Interest", software_telecom: "Software and telecom",
  rent: "Rent", professional: "Professional fees", unclassified: "Unclassified",
  revenue: "Freight revenue", fuel_surcharge_income: "Fuel surcharge income",
};

const GALLONS = /(\d{1,4}(?:\.\d+)?)\s*gal\b/i;

export function classify(lines: LedgerLine[], regionalDiesel: [string, number][]): ClassifiedLine[] {
  return lines.map((l) => {
    if (l.direction === "income") {
      const fsc = /surcharge|\bfsc\b/i.test(`${l.account} ${l.memo}`);
      return { ...l, category: fsc ? "fuel_surcharge_income" : "revenue", riskFactor: "none", confidence: 0.95, rule: fsc ? "income:fuel-surcharge" : "income" };
    }
    for (const r of RULES) {
      const hits = [r.vendor?.test(l.vendorNorm), r.account?.test(l.account), r.memo?.test(l.memo)].filter(Boolean).length;
      if (!hits) continue;
      const out: ClassifiedLine = { ...l, category: r.category, riskFactor: r.riskFactor, confidence: hits >= 3 ? 0.98 : hits === 2 ? 0.92 : 0.75, rule: r.id };
      if (r.category === "fleet_fuel") {
        const m = l.memo.match(GALLONS);
        if (m) { out.quantity = Number(m[1]); out.quantitySource = "ledger"; }
        else {
          // No quantity on the record: estimate from the regional index for that week.
          const px = valueOnOrBefore(regionalDiesel, l.date);
          if (px) { out.quantity = l.amount / px; out.quantitySource = "estimated"; }
        }
      }
      return out;
    }
    return { ...l, category: "unclassified", riskFactor: "none", confidence: 0, rule: "none" };
  });
}
