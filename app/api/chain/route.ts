import { chainStatus } from "@/lib/chain/server";
import { DEPLOYMENT } from "@/lib/chain/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET -> { status: ChainStatus, deployment } for Solana devnet (public addresses only). */
export async function GET() {
  return Response.json({ status: await chainStatus(), deployment: DEPLOYMENT }, { headers: { "cache-control": "no-store" } });
}
