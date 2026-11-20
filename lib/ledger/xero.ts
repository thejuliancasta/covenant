import type { SourceLine } from "./csv";
import { env } from "./providers";
import { formPost, readJson, windowStart } from "./http";

const AUTH = "https://login.xero.com/identity/connect/authorize";
const TOKEN = "https://identity.xero.com/connect/token";
const API = "https://api.xero.com/api.xro/2.0";
const SCOPE = "offline_access accounting.invoices.read accounting.banktransactions.read accounting.manualjournals.read accounting.settings";

export function xeroAuthorizeUrl(redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: env("XERO_CLIENT_ID"),
    response_type: "code",
    scope: SCOPE,
    redirect_uri: redirectUri,
    state,
  });
  return `${AUTH}?${q}`;
}

export async function xeroToken(code: string, redirectUri: string, fetcher: typeof fetch): Promise<string> {
  const basic = Buffer.from(`${env("XERO_CLIENT_ID")}:${env("XERO_CLIENT_SECRET")}`).toString("base64");
  const body = await formPost(TOKEN, { grant_type: "authorization_code", code, redirect_uri: redirectUri }, { authorization: `Basic ${basic}` }, fetcher);
  if (!body.access_token) throw new Error("Xero did not return an access token.");
  return body.access_token as string;
}

export function xeroDate(value: unknown): string {
  const s = String(value ?? "");
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const ms = s.match(/\/Date\((-?\d+)/);
  if (ms) return new Date(Number(ms[1])).toISOString().slice(0, 10);
  return "";
}

function accountName(accounts: Map<string, string>, code: unknown, id: unknown): string {
  return accounts.get(String(code ?? "")) || accounts.get(String(id ?? "")) || String(code ?? "");
}

const BALANCE_SHEET = /^(BANK|CURRENT|CURRLIAB|LIABILITY|EQUITY|FIXED|INVENTORY|NONCURRENT|TERMLIAB|PREPAYMENT)$/;
const INCOME_ACCOUNT = /^(REVENUE|SALES|OTHERINCOME)$/;

/** Bills and invoices, bank spends and receipts, and manual journals. Voided documents are left out. */
export function xeroLines(accounts: { Code?: string; AccountID?: string; Name?: string; Type?: string }[], invoices: any[], bank: any[], journals: any[]): SourceLine[] {
  const names = new Map<string, string>();
  const types = new Map<string, string>();
  for (const a of accounts) {
    if (a.Code) names.set(a.Code, a.Name ?? a.Code);
    if (a.AccountID) names.set(a.AccountID, a.Name ?? a.AccountID);
    if (a.Type && a.Code) types.set(a.Code, a.Type);
    if (a.Type && a.AccountID) types.set(a.AccountID, a.Type);
  }
  const out: SourceLine[] = [];
  for (const doc of invoices) {
    if (/VOIDED|DELETED/i.test(doc.Status ?? "")) continue;
    const incomeDoc = doc.Type === "ACCREC" || doc.Type === "ACCRECCREDIT";
    const type = incomeDoc ? "Invoice" : "Bill";
    const sign = doc.Type === "ACCPAYCREDIT" || doc.Type === "ACCRECCREDIT" ? -1 : 1;
    for (const line of doc.LineItems ?? []) {
      const amount = sign * Number(line.LineAmount);
      if (!Number.isFinite(amount) || amount === 0) continue;
      out.push({
        date: xeroDate(doc.Date), type, vendor: doc.Contact?.Name ?? "", memo: line.Description ?? "",
        account: accountName(names, line.AccountCode, line.AccountID), amount,
      });
    }
  }
  for (const txn of bank) {
    if (/DELETED/i.test(txn.Status ?? "")) continue;
    const type = String(txn.Type ?? "").startsWith("RECEIVE") ? "Deposit" : "Expense";
    for (const line of txn.LineItems ?? []) {
      const amount = Number(line.LineAmount);
      if (!Number.isFinite(amount) || amount === 0) continue;
      out.push({
        date: xeroDate(txn.Date), type, vendor: txn.Contact?.Name ?? "", memo: line.Description ?? txn.Reference ?? "",
        account: accountName(names, line.AccountCode, line.AccountID), amount,
      });
    }
  }
  for (const journal of journals) {
    if (journal.Status && journal.Status !== "POSTED") continue;
    for (const line of journal.JournalLines ?? []) {
      const raw = Number(line.LineAmount);
      if (!Number.isFinite(raw) || raw === 0) continue;
      const accountType = types.get(String(line.AccountCode ?? "")) || types.get(String(line.AccountID ?? "")) || "";
      if (accountType && BALANCE_SHEET.test(accountType)) continue;
      const income = INCOME_ACCOUNT.test(accountType);
      out.push({
        date: xeroDate(journal.Date), type: income ? "Invoice" : "Journal Entry", vendor: "",
        memo: line.Description ?? journal.Narration ?? "", account: accountName(names, line.AccountCode, line.AccountID),
        amount: income ? -raw : raw,
      });
    }
  }
  return out.filter((l) => l.date);
}

async function pages(url: string, key: string, headers: Record<string, string>, fetcher: typeof fetch): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= 50; page++) {
    const body = await readJson(await fetcher(`${url}${url.includes("?") ? "&" : "?"}page=${page}`, { headers }));
    const rows = body[key] ?? [];
    all.push(...rows);
    if (rows.length < 100) break;
  }
  return all;
}

export async function fetchXero(token: string, fetcher: typeof fetch, now = new Date()): Promise<{ company: string; lines: SourceLine[] }> {
  const headers = { authorization: `Bearer ${token}`, accept: "application/json" };
  const connections = await readJson(await fetcher("https://api.xero.com/connections", { headers }));
  const tenant = connections?.[0];
  if (!tenant?.tenantId) throw new Error("Xero did not return an organisation to read.");
  const h = { ...headers, "xero-tenant-id": tenant.tenantId as string };
  const where = encodeURIComponent(`Date>=DateTime(${windowStart(now).replace(/-/g, ",")})`);
  const [accountsBody, invoices, bank, journals] = await Promise.all([
    readJson(await fetcher(`${API}/Accounts`, { headers: h })),
    pages(`${API}/Invoices?where=${where}&Statuses=AUTHORISED,PAID`, "Invoices", h, fetcher),
    pages(`${API}/BankTransactions?where=${where}`, "BankTransactions", h, fetcher),
    pages(`${API}/ManualJournals?where=${where}`, "ManualJournals", h, fetcher),
  ]);
  const lines = xeroLines(accountsBody.Accounts ?? [], invoices, bank, journals);
  if (!lines.length) throw new Error("Xero returned no transactions for the last 24 months.");
  return { company: tenant.tenantName || "Xero organisation", lines };
}
