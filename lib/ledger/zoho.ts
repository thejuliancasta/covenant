import type { SourceLine } from "./csv";
import { env } from "./providers";
import { formPost, readJson, windowStart } from "./http";

export function zohoAccountsUrl(): string {
  return (process.env.ZOHO_ACCOUNTS_URL || "https://accounts.zoho.com").replace(/\/$/, "");
}

export function zohoAuthorizeUrl(redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: env("ZOHO_CLIENT_ID"),
    response_type: "code",
    scope: "ZohoBooks.expenses.READ,ZohoBooks.bills.READ,ZohoBooks.invoices.READ",
    redirect_uri: redirectUri,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${zohoAccountsUrl()}/oauth/v2/auth?${q}`;
}

export async function zohoToken(code: string, redirectUri: string, fetcher: typeof fetch): Promise<{ token: string; apiDomain: string }> {
  const body = await formPost(`${zohoAccountsUrl()}/oauth/v2/token`, {
    grant_type: "authorization_code",
    client_id: env("ZOHO_CLIENT_ID"),
    client_secret: env("ZOHO_CLIENT_SECRET"),
    redirect_uri: redirectUri,
    code,
  }, {}, fetcher);
  if (!body.access_token) throw new Error("Zoho did not return an access token.");
  return { token: body.access_token as string, apiDomain: (body.api_domain as string) || "https://www.zohoapis.com" };
}

function money(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Expenses, vendor bills and customer invoices. Bank-feed lines are left out so a bill is not counted twice. */
export function zohoLines(expenses: any[], bills: any[], invoices: any[]): SourceLine[] {
  const out: SourceLine[] = [];
  for (const expense of expenses) {
    const amount = money(expense.total ?? expense.bcy_total);
    if (!amount) continue;
    out.push({
      date: String(expense.date ?? "").slice(0, 10), type: "Expense", vendor: expense.vendor_name ?? "",
      memo: expense.description ?? expense.reference_number ?? "", account: expense.account_name ?? "Expense", amount,
    });
  }
  const document = (doc: any, type: "Bill" | "Invoice", vendor: string, fallbackAccount: string) => {
    const date = String(doc.date ?? "").slice(0, 10);
    const items = doc.line_items ?? [];
    if (!items.length) {
      const amount = money(doc.total ?? doc.bcy_total);
      if (!amount) return;
      out.push({ date, type, vendor, memo: doc.bill_number || doc.invoice_number || doc.reference_number || "", account: fallbackAccount, amount });
      return;
    }
    for (const line of items) {
      const amount = money(line.item_total);
      if (!amount) continue;
      out.push({ date, type, vendor, memo: line.description || line.name || "", account: line.account_name ?? fallbackAccount, amount });
    }
  };
  for (const bill of bills) document(bill, "Bill", bill.vendor_name ?? "", "Expense");
  for (const invoice of invoices) document(invoice, "Invoice", invoice.customer_name ?? "", "Income");
  return out.filter((l) => /^\d{4}-\d{2}-\d{2}$/.test(l.date));
}

async function list(url: string, key: string, headers: Record<string, string>, fetcher: typeof fetch): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= 50; page++) {
    const body = await readJson(await fetcher(`${url}${url.includes("?") ? "&" : "?"}page=${page}&per_page=200`, { headers }));
    const rows = body[key] ?? [];
    all.push(...rows);
    if (rows.length < 200) break;
    if (body.page_context?.has_more_page === false) break;
  }
  return all;
}

export async function fetchZoho(token: string, apiDomain: string, fetcher: typeof fetch, now = new Date()): Promise<{ company: string; lines: SourceLine[] }> {
  const headers = { authorization: `Zoho-oauthtoken ${token}` };
  const root = `${apiDomain.replace(/\/$/, "")}/books/v3`;
  const orgs = await readJson(await fetcher(`${root}/organizations`, { headers }));
  const org = (orgs.organizations ?? []).find((o: any) => o.organization_id === process.env.ZOHO_ORGANIZATION_ID) ?? orgs.organizations?.[0];
  if (!org?.organization_id) throw new Error("Zoho Books did not return an organisation to read.");
  const id = encodeURIComponent(org.organization_id);
  const start = windowStart(now);
  const [expenses, bills, invoices] = await Promise.all([
    list(`${root}/expenses?organization_id=${id}&date_start=${start}`, "expenses", headers, fetcher),
    list(`${root}/bills?organization_id=${id}&date_start=${start}`, "bills", headers, fetcher),
    list(`${root}/invoices?organization_id=${id}&date_start=${start}`, "invoices", headers, fetcher),
  ]);
  const lines = zohoLines(expenses, bills, invoices);
  if (!lines.length) throw new Error("Zoho Books returned no transactions for the last 24 months.");
  return { company: org.name || "Zoho Books organisation", lines };
}
