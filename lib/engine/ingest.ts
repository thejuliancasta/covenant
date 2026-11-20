import type { IngestReport, LedgerLine } from "./types";

/** RFC 4180 CSV parser: quoted fields, escaped quotes, CRLF, embedded newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const HEADER_ALIASES: Record<string, RegExp> = {
  date: /^(date|txn date|transaction date|posting date)$/i,
  type: /^(transaction type|type|txn type)$/i,
  vendor: /^(name|vendor|payee|customer|supplier|merchant)$/i,
  memo: /^(memo\/description|memo|description|details|line description)$/i,
  account: /^(account|category|split|account name|distribution account)$/i,
  amount: /^(amount|total|amount \(usd\))$/i,
  debit: /^debit$/i,
  credit: /^credit$/i,
};

export function parseAmount(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s) || /-$/.test(s);
  const n = Number(s.replace(/[$,()\s-]/g, ""));
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); // US order, as QuickBooks exports for US companies
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    const mo = Number(m[1]), d = Number(m[2]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return null;
}

/** Collapses store numbers and punctuation so "Pilot Travel Centers #4521" groups with its siblings. */
export function normalizeVendor(v: string): string {
  return v.toUpperCase().replace(/#\s*\d+/g, "").replace(/\b(LLC|INC|CO|CORP|LTD)\b\.?/g, "").replace(/[^A-Z0-9&' ]+/g, " ").replace(/\s+/g, " ").trim();
}

const INCOME_TYPES = /^(invoice|deposit|sales receipt|payment|credit memo)$/i;
const INCOME_ACCOUNTS = /(income|revenue|sales)/i;

export class IngestError extends Error {}

/**
 * Parses an accounting export into ledger lines. Accepts QuickBooks Online
 * "Transaction Detail" style CSVs (including the report title rows above the
 * header) and generic exports with Date, Name/Vendor, Account/Category and
 * Amount or Debit/Credit columns. Rows that cannot be read are counted, never
 * silently dropped.
 */
export function ingestCsv(text: string): { lines: LedgerLine[]; report: IngestReport } {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new IngestError("The file is empty or is not a CSV.");
  let headerRow = -1;
  let cols: Record<string, number> = {};
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const found: Record<string, number> = {};
    rows[i].forEach((cell, j) => {
      for (const [key, re] of Object.entries(HEADER_ALIASES)) if (found[key] === undefined && re.test(cell.trim())) found[key] = j;
    });
    if (found.date !== undefined && (found.amount !== undefined || found.debit !== undefined)) { headerRow = i; cols = found; break; }
  }
  if (headerRow < 0) throw new IngestError("Could not find a header row with a Date column and an Amount (or Debit/Credit) column.");
  if (cols.vendor === undefined && cols.account === undefined && cols.memo === undefined)
    throw new IngestError("The file needs at least one of Name/Vendor, Account/Category or Memo/Description to classify expenses.");

  const skipped = new Map<string, number>();
  const skip = (r: string) => skipped.set(r, (skipped.get(r) ?? 0) + 1);
  const lines: LedgerLine[] = [];
  const get = (r: string[], k: string) => (cols[k] === undefined ? "" : (r[cols[k]] ?? "").trim());
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.every((c) => !c.trim())) continue;
    const date = parseDate(get(r, "date"));
    if (!date) { skip(r.filter((c) => c.trim()).length <= 1 ? "Report footer or note row" : "Unreadable date"); continue; }
    let amount = cols.amount !== undefined ? parseAmount(get(r, "amount")) : null;
    let viaCredit = false;
    if (amount === null && cols.debit !== undefined) {
      const debit = parseAmount(get(r, "debit")), credit = cols.credit !== undefined ? parseAmount(get(r, "credit")) : null;
      if (debit) amount = debit; else if (credit) { amount = credit; viaCredit = true; }
    }
    if (amount === null) { skip("Missing or unreadable amount"); continue; }
    if (amount === 0) { skip("Zero amount"); continue; }
    const type = get(r, "type"), account = get(r, "account"), vendor = get(r, "vendor");
    const income = INCOME_TYPES.test(type) || INCOME_ACCOUNTS.test(account) || (!type && viaCredit);
    lines.push({
      id: lines.length + 1, date, month: date.slice(0, 7), type, vendor, vendorNorm: normalizeVendor(vendor),
      account, memo: get(r, "memo"), amount, direction: income ? "income" : "expense",
    });
  }
  if (!lines.length) throw new IngestError("No transactions could be read from the file.");
  const dates = lines.map((l) => l.date).sort();
  const preamble = rows.slice(0, headerRow).map((r) => r.join(" ").trim()).filter(Boolean);
  const sourceLine = preamble.find((p) => /^source:/i.test(p));
  const report: IngestReport = {
    format: sourceLine ? sourceLine.replace(/^source:\s*/i, "") : preamble.some((p) => /transaction (detail|list)/i.test(p)) ? "QuickBooks Online report export (CSV)" : "Generic transaction CSV",
    headerRow: headerRow + 1,
    columns: Object.fromEntries(Object.keys(HEADER_ALIASES).map((k) => [k, cols[k] === undefined ? null : rows[headerRow][cols[k]].trim()])),
    rowsRead: rows.length - headerRow - 1,
    imported: lines.length,
    skipped: [...skipped].map(([reason, count]) => ({ reason, count })),
    dateRange: [dates[0], dates[dates.length - 1]],
    company: preamble[0] ?? null,
  };
  return { lines, report };
}
