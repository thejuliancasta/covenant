import { NextResponse } from "next/server";
import { handoffPage, pullLedger } from "@/lib/ledger/pull";
import { isProvider } from "@/lib/ledger/providers";
import { readState, stateSecret } from "@/lib/ledger/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function originOf(req: Request): string {
  if (process.env.CONNECT_REDIRECT_ORIGIN) return process.env.CONNECT_REDIRECT_ORIGIN.replace(/\/$/, "");
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host");
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return host ? `${proto}://${host}` : url.origin;
}

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const url = new URL(req.url);
  const origin = originOf(req);
  const fail = (message: string) => {
    const back = new URL("/app", origin);
    back.searchParams.set("connect_error", message);
    const res = NextResponse.redirect(back);
    res.cookies.set("costshield_oauth", "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
    return res;
  };
  const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (providerError) return fail(providerError.slice(0, 240));
  if (!isProvider(provider)) return fail("That ledger is not supported.");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = req.headers.get("cookie")?.split(";").map((p) => p.trim()).find((p) => p.startsWith("costshield_oauth="))?.slice("costshield_oauth=".length);
  if (!code || !state || !cookie || decodeURIComponent(cookie) !== state) return fail("The connection attempt could not be verified. Start it again.");
  let region = "PADD2";
  try {
    const saved = readState(state, stateSecret());
    if (saved.provider !== provider) return fail("The connection attempt could not be verified. Start it again.");
    region = saved.region;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "The connection attempt expired. Start it again.");
  }
  try {
    const pulled = await pullLedger(provider, code, `${origin}/api/connect/${provider}/callback`, url.searchParams.get("realmId"));
    const res = new NextResponse(handoffPage({ ...pulled, region }), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    res.cookies.set("costshield_oauth", "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
    return res;
  } catch (err) {
    return fail(err instanceof Error ? err.message : "The ledger could not be read.");
  }
}
