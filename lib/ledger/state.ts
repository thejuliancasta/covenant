import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export interface ConnectState { provider: string; region: string; nonce: string; exp: number }

export function stateSecret(): string {
  if (process.env.CONNECT_STATE_SECRET) return process.env.CONNECT_STATE_SECRET;
  const fallback = ["QUICKBOOKS_CLIENT_SECRET", "XERO_CLIENT_SECRET", "ZOHO_CLIENT_SECRET", "FRESHBOOKS_CLIENT_SECRET"]
    .map((k) => process.env[k]).filter(Boolean).join("|");
  if (!fallback) throw new Error("Set CONNECT_STATE_SECRET before connecting a ledger.");
  return fallback;
}

export function signState(payload: ConnectState, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function issueState(provider: string, region: string, secret: string, now = Date.now()): string {
  return signState({ provider, region, nonce: randomBytes(16).toString("hex"), exp: now + 10 * 60 * 1000 }, secret);
}

export function readState(token: string, secret: string, now = Date.now()): ConnectState {
  const [body, sig] = token.split(".");
  if (!body || !sig) throw new Error("The connection attempt expired. Start it again.");
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("The connection attempt could not be verified. Start it again.");
  const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as ConnectState;
  if (!payload.exp || payload.exp < now) throw new Error("The connection attempt expired. Start it again.");
  return payload;
}
