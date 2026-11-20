import type { SourceLine } from "./csv";
import { env } from "./providers";
import { formPost, readJson, windowStart } from "./http";

const AUTH = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

export function quickbooksHost(): string {
  return process.env.QUICKBOOKS_ENVIRONMENT === "production" ? "https://quickbooks.api.intuit.com" : "https://sandbox-quickbooks.api.intuit.com";
}

export function quickbooksAuthorizeUrl(redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: env("QUICKBOOKS_CLIENT_ID"),
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: redirectUri,
    state,
  });
  return `${AUTH}?${q}`;
}

export async function quickbooksToken(code: string, redirectUri: string, fetcher: typeof fetch): Promise<string> {
  const basic = Buffer.from(`${env("QUICKBOOKS_CLIENT_ID")}:${env("QUICKBOOKS_CLIENT_SECRET")}`).toString("base64");
  const body = await formPost(TOKEN, { grant_type: "authorization_code", code, redirect_uri: redirectUri }, { authorization: `Basic ${basic}`, accept: "application/json" }, fetcher);
  if (!body.access_token) throw new Error("QuickBooks did not return an access token.");
  return body.access_token as string;
}

interface ReportRow { ColData?: { value?: string }[]; Rows?: { Row?: ReportRow | ReportRow[] }; type?: string }

function columnKeys(report: any): string[] {
  const cols = report?.Columns?.Column ?? [];
  return cols.map((c: any) => String(c.MetaData?.find((m: any) => m.Name === "ColKey")?.Value || c.ColType || c.ColTitle || "").toLowerCase());
}

const COLUMN: Record<string, string[]> = {
  tx_date: ["tx_date", "date"],
  txn_type: ["txn_type", "transaction type"],
  name: ["name"],
  memo: ["memo", "memo/description"],
  account_name: ["account_name", "account"],
  subt_nat_amount: ["subt_nat_amount", "amount", "subt_amount"],
};

function reportAmount(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return NaN;
  const neg = /^\(.*\)$/.test(trimmed) || trimmed.startsWith("-");
  const n = Number(trimmed.replace(/[$,()\s]/g, ""));
  return Number.isFinite(n) ? (neg ? -Math.abs(n) : n) : NaN;
}

/** Flattens a TransactionList report into source lines. Section headers and totals are skipped. */
export function quickbooksLines(report: any): SourceLine[] {
  const keys = columnKeys(report);
  const at = (row: ReportRow, key: string) => {
    const i = keys.findIndex((k) => COLUMN[key].includes(k));
    return i < 0 ? "" : (row.ColData?.[i]?.value ?? "").trim();
  };
  const out: SourceLine[] = [];
  const walk = (rows: ReportRow | ReportRow[] | undefined) => {
    for (const row of rows ? (Array.isArray(rows) ? rows : [rows]) : []) {
      if (row.Rows?.Row) walk(row.Rows.Row);
      if (!row.ColData) continue;
      const date = at(row, "tx_date").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const amount = reportAmount(at(row, "subt_nat_amount"));
      if (!Number.isFinite(amount) || amount === 0) continue;
      out.push({ date, type: at(row, "txn_type"), vendor: at(row, "name"), memo: at(row, "memo"), account: at(row, "account_name"), amount });
    }
  };
  walk(report?.Rows?.Row);
  return out;
}

export async function fetchQuickbooks(token: string, realmId: string, fetcher: typeof fetch, now = new Date()): Promise<{ company: string; lines: SourceLine[] }> {
  if (!realmId) throw new Error("QuickBooks did not say which company to read.");
  const headers = { authorization: `Bearer ${token}`, accept: "application/json" };
  const base = `${quickbooksHost()}/v3/company/${encodeURIComponent(realmId)}`;
  const info = await readJson(await fetcher(`${base}/companyinfo/${encodeURIComponent(realmId)}?minorversion=75`, { headers }));
  const company = info?.CompanyInfo?.CompanyName || "QuickBooks company";
  const q = new URLSearchParams({ start_date: windowStart(now), end_date: now.toISOString().slice(0, 10), minorversion: "75", columns: "tx_date,txn_type,name,memo,account_name,subt_nat_amount" });
  const report = await readJson(await fetcher(`${base}/reports/TransactionList?${q}`, { headers }));
  const lines = quickbooksLines(report);
  if (!lines.length) throw new Error("QuickBooks returned no transactions for the last 24 months.");
  return { company, lines };
}
