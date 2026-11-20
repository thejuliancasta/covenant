export const usd = (x: number, digits = 0) => (x < 0 ? "-" : "") + "$" + Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const usdK = (x: number) => (Math.abs(x) >= 1e6 ? `$${(x / 1e6).toFixed(2)}M` : Math.abs(x) >= 1e4 ? `$${(x / 1e3).toFixed(0)}K` : usd(x));
export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;
export const int = (x: number) => Math.round(x).toLocaleString("en-US");
export const ppg = (x: number) => `$${x.toFixed(3)}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthLabel = (ym: string, long = false) => `${long ? ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(ym.slice(5, 7)) - 1] : MONTHS[Number(ym.slice(5, 7)) - 1]} ${long ? ym.slice(0, 4) : "'" + ym.slice(2, 4)}`;
export const shortHash = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;

/** Reads an NDJSON response body, calling onEvent for each line. */
export async function readNdjson<T>(res: Response, onEvent: (ev: T) => void | Promise<void>) {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) await onEvent(JSON.parse(line) as T);
    }
    if (done) break;
  }
  if (buf.trim()) await onEvent(JSON.parse(buf) as T);
}
