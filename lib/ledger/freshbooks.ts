import type { SourceLine } from "./csv";
import { env } from "./providers";
import { readJson, windowStart } from "./http";

const AUTH = "https://auth.freshbooks.com/oauth/authorize";
const TOKEN = "https://api.freshbooks.com/auth/oauth/token";

export function freshbooksAuthorizeUrl(redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: env("FRESHBOOKS_CLIENT_ID"),
    response_type: "code",
    redirect_uri: redirectUri,
    state,
  });
  return `${AUTH}?${q}`;
}

export async function freshbooksToken(code: string, redirectUri: string, fetcher: typeof fetch): Promise<string> {
  const body = await readJson(await fetcher(TOKEN, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: env("FRESHBOOKS_CLIENT_ID"),
      client_secret: env("FRESHBOOKS_CLIENT_SECRET"),
      code,
      redirect_uri: redirectUri,
    }),
  }));
  if (!body.access_token) throw new Error("FreshBooks did not return an access token.");
  return body.access_token as string;
}

function money(value: unknown): number {
  const raw = value && typeof value === "object" && "amount" in (value as any) ? (value as any).amount : value;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Expenses and invoices. Category names come from the category list when FreshBooks sends only an id. */
export function freshbooksLines(expenses: any[], invoices: any[], categories: Map<string, string>, start: string): SourceLine[] {
  const out: SourceLine[] = [];
  for (const expense of expenses) {
    const date = String(expense.date ?? "").slice(0, 10);
    const amount = money(expense.amount);
    if (date < start || !amount) continue;
    const category = categories.get(String(expense.categoryid ?? "")) || expense.account_name || "Expense";
    out.push({ date, type: "Expense", vendor: expense.vendor ?? "", memo: expense.notes ?? "", account: category, amount });
  }
  for (const invoice of invoices) {
    const date = String(invoice.create_date ?? invoice.date ?? "").slice(0, 10);
    const amount = money(invoice.amount);
    if (date < start || !amount) continue;
    const customer = invoice.current_organization ?? invoice.organization ?? [invoice.fname, invoice.lname].filter(Boolean).join(" ");
    out.push({ date, type: "Invoice", vendor: customer, memo: invoice.description ?? invoice.invoice_number ?? "", account: "Income", amount });
  }
  return out.filter((l) => /^\d{4}-\d{2}-\d{2}$/.test(l.date));
}

async function list(url: string, key: string, headers: Record<string, string>, fetcher: typeof fetch): Promise<any[]> {
  const all: any[] = [];
  for (let page = 1; page <= 50; page++) {
    const body = await readJson(await fetcher(`${url}${url.includes("?") ? "&" : "?"}page=${page}&per_page=100`, { headers }));
    const rows = body?.response?.result?.[key] ?? body?.response?.[key] ?? [];
    all.push(...rows);
    const pages = Number(body?.response?.result?.pages ?? body?.response?.pages ?? page);
    if (page >= pages || rows.length === 0) break;
  }
  return all;
}

export async function fetchFreshbooks(token: string, fetcher: typeof fetch, now = new Date()): Promise<{ company: string; lines: SourceLine[] }> {
  const headers = { authorization: `Bearer ${token}`, accept: "application/json" };
  const me = await readJson(await fetcher("https://api.freshbooks.com/auth/api/v1/users/me", { headers }));
  const memberships = me?.response?.business_memberships ?? me?.business_memberships ?? [];
  const business = memberships[0]?.business ?? memberships[0];
  const accountId = business?.account_id ?? business?.accountid;
  if (!accountId) throw new Error("FreshBooks did not return a business to read.");
  const root = `https://api.freshbooks.com/accounting/account/${encodeURIComponent(accountId)}`;
  const [expenses, invoices, categoryRows] = await Promise.all([
    list(`${root}/expenses/expenses`, "expenses", headers, fetcher),
    list(`${root}/invoices/invoices`, "invoices", headers, fetcher),
    list(`${root}/expenses/categories`, "categories", headers, fetcher).catch(() => []),
  ]);
  const categories = new Map<string, string>(categoryRows.map((c: any) => [String(c.categoryid ?? c.id), c.category ?? c.name]));
  const lines = freshbooksLines(expenses, invoices, categories, windowStart(now));
  if (!lines.length) throw new Error("FreshBooks returned no transactions for the last 24 months.");
  return { company: business.name || business.business_name || "FreshBooks business", lines };
}
