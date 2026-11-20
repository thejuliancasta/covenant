/**
 * Server-only wallet keys. Each role is a Solana ed25519 key whose 32-byte seed
 * also derives the role's Helius Privacy Rings shielded keypair.
 *
 * Sources, in order: an env var holding the secret (JSON byte array as written by
 * `solana-keygen`, or base58 of the 64-byte secret), then `<SOLANA_KEYS_DIR>/<role>.json`
 * (default `.solana-keys/`, gitignored). Keys never leave the server.
 *   underwriter  SOLANA_UNDERWRITER_KEY  funds steps privately, reclaims untriggered steps
 *   oracle       SOLANA_ORACLE_KEY       posts the monthly index (cannot move funds)
 *   fleet        SOLANA_FLEET_KEY        demo wallet standing in for the business
 *   payer        SOLANA_PAYER_KEY        setup only: tops up SOL, mints tUSD
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { getAddressEncoder, getBase58Encoder, type Address, type TransactionSigner } from "@solana/kit";
import { ShieldedKeypair, SigningKey, type Bytes32 } from "@heliuslabs/spr";

export type RoleName = "underwriter" | "oracle" | "fleet" | "payer";
const ENV: Record<RoleName, string> = {
  underwriter: "SOLANA_UNDERWRITER_KEY",
  oracle: "SOLANA_ORACLE_KEY",
  fleet: "SOLANA_FLEET_KEY",
  payer: "SOLANA_PAYER_KEY",
};

export interface Role {
  readonly name: RoleName;
  readonly shielded: ShieldedKeypair;
  readonly signer: TransactionSigner;
  readonly address: Address;
}

export const keysDir = () => resolve(process.cwd(), process.env.SOLANA_KEYS_DIR?.trim() || ".solana-keys");

function parseSecret(raw: string): Uint8Array {
  const s = raw.trim();
  const bytes = s.startsWith("[") ? Uint8Array.from(JSON.parse(s) as number[]) : Uint8Array.from(getBase58Encoder().encode(s));
  if (bytes.length !== 64 && bytes.length !== 32) throw new Error("invalid key length");
  return bytes;
}

function roleFromSecret(name: RoleName, secret: Uint8Array): Role {
  const seed = secret.slice(0, 32) as Bytes32;
  const shielded = ShieldedKeypair.fromKeypair(SigningKey.fromEd25519Bytes(seed));
  const signer = shielded.toSolanaSigner();
  return { name, shielded, signer, address: signer.address };
}

const cache = new Map<RoleName, Role | null>();

/** The role's key, or null if it is not configured. */
export function loadRole(name: RoleName): Role | null {
  if (cache.has(name)) return cache.get(name)!;
  let role: Role | null = null;
  const fromEnv = process.env[ENV[name]];
  if (fromEnv?.trim()) role = roleFromSecret(name, parseSecret(fromEnv));
  else {
    const path = resolve(keysDir(), `${name}.json`);
    if (existsSync(path)) role = roleFromSecret(name, parseSecret(readFileSync(path, "utf8")));
  }
  cache.set(name, role);
  return role;
}

/** Setup only: load the role's key file, generating a new solana-keygen format key if missing. */
export function loadOrCreateRole(name: RoleName): Role {
  const existing = loadRole(name);
  if (existing) return existing;
  const dir = keysDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const seed = Uint8Array.from(randomBytes(32));
  const kp = ShieldedKeypair.fromKeypair(SigningKey.fromEd25519Bytes(seed as Bytes32));
  const pub = getAddressEncoder().encode(kp.toSolanaSigner().address);
  writeFileSync(resolve(dir, `${name}.json`), JSON.stringify([...seed, ...pub]), { mode: 0o600 });
  cache.delete(name);
  return loadRole(name)!;
}

export const roles = () => ({ underwriter: loadRole("underwriter"), oracle: loadRole("oracle"), fleet: loadRole("fleet") });
