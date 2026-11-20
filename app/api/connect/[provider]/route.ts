import { NextResponse } from "next/server";
import { freshbooksAuthorizeUrl } from "@/lib/ledger/freshbooks";
import { isProvider, providerById, type ProviderId } from "@/lib/ledger/providers";
import { quickbooksAuthorizeUrl } from "@/lib/ledger/quickbooks";
import { issueState, stateSecret } from "@/lib/ledger/state";
import { xeroAuthorizeUrl } from "@/lib/ledger/xero";
import { zohoAuthorizeUrl } from "@/lib/ledger/zoho";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function originOf(req: Request): string {
  if (process.env.CONNECT_REDIRECT_ORIGIN) return process.env.CONNECT_REDIRECT_ORIGIN.replace(/\/$/, "");
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host");
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return host ? `${proto}://${host}` : url.origin;
}

function authorize(provider: ProviderId, redirectUri: string, state: string): string {
  if (provider === "quickbooks") return quickbooksAuthorizeUrl(redirectUri, state);
  if (provider === "xero") return xeroAuthorizeUrl(redirectUri, state);
  if (provider === "zoho") return zohoAuthorizeUrl(redirectUri, state);
  return freshbooksAuthorizeUrl(redirectUri, state);
}

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const back = new URL("/", originOf(req));
  if (!isProvider(provider)) {
    back.searchParams.set("connect_error", "That ledger is not supported.");
    return NextResponse.redirect(back);
  }
  const info = providerById(provider);
  if (!info.configured) {
    back.searchParams.set("connect_error", `${info.name} needs its client id and secret in the server environment before anyone can sign in.`);
    return NextResponse.redirect(back);
  }
  const region = new URL(req.url).searchParams.get("region") === "US" ? "US" : "PADD2";
  let state: string;
  try { state = issueState(provider, region, stateSecret()); }
  catch (err) {
    back.searchParams.set("connect_error", err instanceof Error ? err.message : "Could not start the connection.");
    return NextResponse.redirect(back);
  }
  const redirectUri = `${originOf(req)}/api/connect/${provider}/callback`;
  const res = NextResponse.redirect(authorize(provider, redirectUri, state));
  res.cookies.set("costshield_oauth", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  return res;
}
