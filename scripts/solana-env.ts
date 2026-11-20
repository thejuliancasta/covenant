/** Load .env.local into process.env for the Solana scripts (Next.js does this itself for the app). */
import { existsSync, readFileSync } from "node:fs";

export function loadEnvLocal() {
  for (const line of existsSync(".env.local") ? readFileSync(".env.local", "utf8").split("\n") : []) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}
