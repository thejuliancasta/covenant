import { providers } from "@/lib/ledger/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ providers: providers() }, { headers: { "cache-control": "no-store" } });
}
