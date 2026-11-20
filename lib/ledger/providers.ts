export type ProviderId = "quickbooks" | "xero" | "zoho" | "freshbooks";

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  source: string;
  reads: string;
  configured: boolean;
  /** Env vars still empty. Names only, never values. */
  missing: string[];
}

const KEYS: Record<ProviderId, string[]> = {
  quickbooks: ["QUICKBOOKS_CLIENT_ID", "QUICKBOOKS_CLIENT_SECRET"],
  xero: ["XERO_CLIENT_ID", "XERO_CLIENT_SECRET"],
  zoho: ["ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET"],
  freshbooks: ["FRESHBOOKS_CLIENT_ID", "FRESHBOOKS_CLIENT_SECRET"],
};

const ALL: Omit<ProviderInfo, "configured" | "missing">[] = [
  { id: "quickbooks", name: "QuickBooks Online", source: "QuickBooks Online connection", reads: "Transaction list: date, type, name, memo, account and amount." },
  { id: "xero", name: "Xero", source: "Xero connection", reads: "Bills, invoices, bank transactions and manual journals." },
  { id: "zoho", name: "Zoho Books", source: "Zoho Books connection", reads: "Expenses, bills and invoices." },
  { id: "freshbooks", name: "FreshBooks", source: "FreshBooks connection", reads: "Expenses and invoices." },
];

export function isProvider(id: string): id is ProviderId {
  return ALL.some((p) => p.id === id);
}

export function providerConfigured(id: ProviderId): boolean {
  return KEYS[id].every((k) => !!process.env[k]);
}

export function providers(): ProviderInfo[] {
  return ALL.map((p) => ({ ...p, configured: providerConfigured(p.id), missing: KEYS[p.id].filter((k) => !process.env[k]) }));
}

export function providerById(id: ProviderId): ProviderInfo {
  const found = providers().find((p) => p.id === id);
  if (!found) throw new Error("Unknown ledger.");
  return found;
}

export function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}
