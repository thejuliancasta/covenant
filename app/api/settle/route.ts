import { runSettlement } from "@/lib/chain/server";
import type { SettlementRequest } from "@/lib/chain/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** A full private settlement is about ten Solana transactions with Rings proofs (30 to 60 s). */
export const maxDuration = 300;

/** POST settlement request -> NDJSON stream of steps on Solana devnet. Prices come from the server's EIA data, not the caller. */
export async function POST(req: Request) {
  let b: Partial<SettlementRequest>;
  try { b = await req.json(); } catch { return Response.json({ error: "Body must be JSON." }, { status: 400 }); }
  const ok = typeof b.region === "string" && /^\d{4}-\d{2}$/.test(b.inceptionMonth ?? "") && /^\d{4}-\d{2}$/.test(b.settleMonth ?? "")
    && typeof b.strikeOffset === "number" && typeof b.coveredGallons === "number" && typeof b.maxCoveredGallons === "number";
  if (!ok) return Response.json({ error: "Invalid settlement request." }, { status: 400 });
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const ev of runSettlement(b as SettlementRequest)) controller.enqueue(enc.encode(JSON.stringify(ev) + "\n"));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
