"use client";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_EXPLORER, addressUrl, txUrl, type ChainStatus, type LenderShare } from "@/lib/chain/types";
import { cx } from "./ui";
import { LogoMark } from "./brand/logo";

/** Short form for Solana signatures and addresses (base58, 32 to 88 characters). */
export const shortSig = (s: string) => (s.length > 16 ? `${s.slice(0, 6)}…${s.slice(-6)}` : s);
export const tusd = (x: number, digits = 2) => `${x.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })} tUSD`;
/** 202609 -> "2026-09". */
export const periodYm = (p: number) => `${Math.floor(p / 100)}-${String(p % 100).padStart(2, "0")}`;
export const REGION_LABEL: Record<string, string> = { PADD2: "Midwest (PADD 2)", US: "U.S. average" };

/**
 * Reads /api/chain. Accepts either a bare ChainStatus or `{ status: ChainStatus, ... }`,
 * so the UI keeps working whichever wrapper the route returns.
 */
export function useChainStatus() {
  const [status, setStatus] = useState<ChainStatus | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/chain", { cache: "no-store" });
      const j = await res.json().catch(() => null);
      const st = (j && typeof j === "object" && "status" in j && j.status && typeof j.status === "object" ? j.status : j) as ChainStatus | null;
      if (!st || typeof st.configured !== "boolean") throw new Error(`The chain status endpoint returned no status (HTTP ${res.status}).`);
      setStatus(st); setFailed(null);
    } catch (e) {
      setStatus(null); setFailed(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  return { status, failed, reload: load };
}

export function TxLink({ sig, explorer, className }: { sig: string; explorer?: string; className?: string }) {
  return (
    <a href={txUrl(explorer ?? DEFAULT_EXPLORER, sig)} target="_blank" rel="noreferrer" title={`Open transaction ${sig} on Solana Explorer (devnet)`}
      className={cx("relative inline-flex items-center gap-1 whitespace-nowrap rounded-[6px] font-mono text-[11.5px] text-ink2 underline-offset-2 transition-colors duration-150 before:absolute before:-inset-y-3 before:inset-x-0 before:content-[''] hover:text-jade", className)}>
      {shortSig(sig)}<Arrow />
    </a>
  );
}

export function AddrLink({ addr, explorer, className }: { addr: string; explorer?: string; className?: string }) {
  return (
    <a href={addressUrl(explorer ?? DEFAULT_EXPLORER, addr)} target="_blank" rel="noreferrer" title={addr}
      className={cx("relative inline-flex items-center gap-1 whitespace-nowrap rounded-[6px] font-mono text-[12px] text-ink2 transition-colors duration-150 before:absolute before:-inset-y-3 before:inset-x-0 before:content-[''] hover:text-jade", className)}>
      {shortSig(addr)}<Arrow />
    </a>
  );
}

function Arrow() {
  return <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden className="opacity-70"><path d="M3 1.5h5.5V7M8.3 1.7 1.6 8.4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/** Marks a value that is encrypted on chain. Plain text with a lock, never a pill. */
export function Encrypted({ label = "encrypted", className }: { label?: string; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium text-cipher", className)}>
      <LockIcon />{label.charAt(0).toUpperCase() + label.slice(1)}
    </span>
  );
}

export function LockIcon({ className }: { className?: string }) {
  return <svg width="9" height="10" viewBox="0 0 9 10" aria-hidden className={className}><rect x="0.5" y="4.25" width="8" height="5.25" rx="1.2" fill="currentColor" /><path d="M2.3 4.4V3a2.2 2.2 0 0 1 4.4 0v1.4" stroke="currentColor" strokeWidth="1.1" fill="none" /></svg>;
}

/** Kept for compatibility: renders the CostShield mark (components/brand/logo.tsx). */
export function ShieldMark() {
  return <LogoMark size={22} />;
}

/* Lender share links: /lender#<base64url(JSON.stringify(LenderShare))>. The fragment is not sent with the page request. */

function toB64Url(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export const encodeShare = (share: LenderShare) => toB64Url(JSON.stringify(share));

/** Returns the share, or throws with a reason a person can act on. */
export function decodeShare(fragment: string): LenderShare {
  let j: unknown;
  try { j = JSON.parse(fromB64Url(fragment)); } catch { throw new Error("The link is incomplete or was changed after it was shared, so it cannot be read."); }
  const s = j as Partial<LenderShare>;
  const ok = !!s && typeof s.policyId === "string" && typeof s.region === "string" && typeof s.period === "number" && Array.isArray(s.steps) && s.steps.length > 0
    && s.steps.every((x) => x && typeof x.index === "number" && typeof x.account === "string" && typeof x.vault === "string" && typeof x.viewingKey === "string");
  if (!ok) throw new Error("The link opened, but it does not contain a CostShield coverage share.");
  return s as LenderShare;
}

export const shareFragment = (share: LenderShare) => `/lender#${encodeShare(share)}`;
