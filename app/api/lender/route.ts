import { lenderView, validShare } from "@/lib/chain/lender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST LenderShare -> LenderView. Decrypts each step vault with ONLY the viewing
 * keys in the request plus the public step accounts. No spending key is used.
 */
export async function POST(req: Request) {
  let b: unknown;
  try { b = await req.json(); } catch { return Response.json({ error: "Body must be JSON." }, { status: 400 }); }
  if (!validShare(b)) return Response.json({ error: "Invalid lender share." }, { status: 400 });
  try {
    return Response.json(await lenderView(b), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message.split("\n")[0] : String(e) }, { status: 502 });
  }
}
