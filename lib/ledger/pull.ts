import type { ProviderId } from "./providers";
import { toLedgerCsv } from "./csv";
import { fetchFreshbooks, freshbooksToken } from "./freshbooks";
import { fetchQuickbooks, quickbooksToken } from "./quickbooks";
import { fetchXero, xeroToken } from "./xero";
import { fetchZoho, zohoToken } from "./zoho";
import { providerById } from "./providers";

/** Exchanges the authorization code and reads 24 months of lines. Nothing is written to disk. */
export async function pullLedger(provider: ProviderId, code: string, redirectUri: string, realmId: string | null, fetcher: typeof fetch = fetch): Promise<{ csv: string; label: string }> {
  const info = providerById(provider);
  const pulled = provider === "quickbooks"
    ? await fetchQuickbooks(await quickbooksToken(code, redirectUri, fetcher), realmId ?? "", fetcher)
    : provider === "xero"
      ? await fetchXero(await xeroToken(code, redirectUri, fetcher), fetcher)
      : provider === "zoho"
        ? await (async () => { const t = await zohoToken(code, redirectUri, fetcher); return fetchZoho(t.token, t.apiDomain, fetcher); })()
        : await fetchFreshbooks(await freshbooksToken(code, redirectUri, fetcher), fetcher);
  const csv = toLedgerCsv(pulled.company, info.source, pulled.lines);
  if (csv.length > 4_000_000) throw new Error("That ledger is larger than 4 MB for 24 months. Export a shorter range as CSV instead.");
  return { csv, label: `${pulled.company} (${info.name})` };
}

export function handoffPage(payload: { csv: string; label: string; region: string }): string {
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  return `<!doctype html><meta charset="utf-8"><title>Connecting books</title><p>Reading the ledger…</p><script>sessionStorage.setItem("costshield-import",${json});location.replace("/app");</script>`;
}
