/** Evidence labels shown next to every number in the product. */
export type Evidence = "V" | "C" | "E" | "A";
export const EVIDENCE_LABEL: Record<Evidence, string> = {
  V: "Verified public data",
  C: "Calculated from data",
  E: "Estimate",
  A: "Assumption",
};

export type Category =
  | "fleet_fuel" | "natural_gas" | "electricity" | "payroll" | "insurance" | "equipment_lease"
  | "maintenance" | "tolls_permits" | "interest" | "software_telecom" | "rent" | "professional" | "unclassified";

export type RiskFactor = "diesel" | "natural_gas" | "electricity" | "interest_rate" | "none";

export interface LedgerLine {
  id: number;
  date: string; // ISO
  month: string; // YYYY-MM
  type: string;
  vendor: string;
  vendorNorm: string;
  account: string;
  memo: string;
  amount: number;
  direction: "expense" | "income";
}

export interface ClassifiedLine extends LedgerLine {
  category: Category | "revenue" | "fuel_surcharge_income";
  riskFactor: RiskFactor;
  confidence: number;
  rule: string;
  /** Physical quantity when known or estimated (gallons for diesel). */
  quantity?: number;
  quantitySource?: "ledger" | "estimated";
}

export interface IngestReport {
  format: string;
  headerRow: number;
  columns: Record<string, string | null>;
  rowsRead: number;
  imported: number;
  skipped: { reason: string; count: number }[];
  dateRange: [string, string] | null;
  company: string | null;
}
