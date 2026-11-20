/** The trailing 24 months, from the first of the month. */
export function windowStart(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 24, 1));
  return d.toISOString().slice(0, 10);
}

export class LedgerError extends Error {}

export async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!res.ok) {
    const msg = body?.error_description || body?.Fault?.Error?.[0]?.Message || body?.message || body?.Detail || (typeof body?.error === "string" ? body.error : "");
    throw new LedgerError(typeof msg === "string" && msg.trim() ? msg.slice(0, 240) : `The books returned HTTP ${res.status}.`);
  }
  return body ?? {};
}

export async function formPost(url: string, body: Record<string, string>, headers: Record<string, string>, fetcher: typeof fetch): Promise<any> {
  const res = await fetcher(url, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", ...headers }, body: new URLSearchParams(body) });
  return readJson(res);
}
