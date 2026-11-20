import type { IngestReport } from "@/lib/engine/types";

/** One categorized ledger line, before the CSV importer assigns direction. */
export interface SourceLine {
  date: string;
  type: string;
  vendor: string;
  memo: string;
  account: string;
  amount: number;
}

function cell(value: string | number): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** A CSV the existing importer already accepts, with the company and the source named above the header. */
export function toLedgerCsv(company: string, source: string, lines: SourceLine[]): string {
  const header = "Date,Transaction Type,Name,Memo/Description,Account,Amount";
  const body = lines.map((l) => [l.date, l.type, l.vendor, l.memo, l.account, l.amount.toFixed(2)].map(cell).join(","));
  return [cell(company || "Connected company"), cell(`source: ${source}`), header, ...body].join("\n") + "\n";
}

export function connectionNote(report: IngestReport): string | null {
  return /connection$/i.test(report.format) ? "Read from the connected ledger for this request and not stored." : null;
}
