import { runPipeline } from "@/lib/engine/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** POST { csv, region } -> NDJSON stream of pipeline stage events, then the analysis. Nothing is stored. */
export async function POST(req: Request) {
  let body: { csv?: unknown; region?: unknown };
  try { body = await req.json(); } catch { return Response.json({ error: "Body must be JSON." }, { status: 400 }); }
  if (typeof body.csv !== "string" || !body.csv.trim()) return Response.json({ error: "No file content received." }, { status: 400 });
  if (body.csv.length > 4_000_000) return Response.json({ error: "File is larger than 4 MB. Export a shorter date range." }, { status: 413 });
  const csv = body.csv, region = typeof body.region === "string" ? body.region : "PADD2";
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for await (const ev of runPipeline(csv, { region })) controller.enqueue(enc.encode(JSON.stringify(ev) + "\n"));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
