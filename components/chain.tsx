"use client";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_EXPLORER, addressUrl, txUrl, type ChainStatus, type LenderShare } from "@/lib/chain/types";
import { cx } from "./ui";

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
  return <a href={txUrl(explorer ?? DEFAULT_EXPLORER, sig)} target="_blank" rel="noreferrer" className={cx("font-mono text-[11px] text-shield underline-offset-2 hover:underline", className)}>{shortSig(sig)} ↗</a>;
}

export function AddrLink({ addr, explorer, className }: { addr: string; explorer?: string; className?: string }) {
  return <a href={addressUrl(explorer ?? DEFAULT_EXPLORER, addr)} target="_blank" rel="noreferrer" title={addr} className={cx("font-mono text-[12px] text-shield underline-offset-2 hover:underline", className)}>{shortSig(addr)} ↗</a>;
}

/** Marks a value that is encrypted on chain. */
export function Encrypted({ label = "encrypted", className }: { label?: string; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-slate-line bg-slate-soft px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-slate", className)}>
      <LockIcon />{label}
    </span>
  );
}

export function LockIcon({ className }: { className?: string }) {
  return <svg width="9" height="10" viewBox="0 0 9 10" aria-hidden className={className}><rect x="0.5" y="4.25" width="8" height="5.25" rx="1.2" fill="currentColor" /><path d="M2.3 4.4V3a2.2 2.2 0 0 1 4.4 0v1.4" stroke="currentColor" strokeWidth="1.1" fill="none" /></svg>;
}

export function ShieldMark() {
  return <svg width="22" height="24" viewBox="0 0 22 24" aria-hidden><path d="M11 1 2 4.5v6.8c0 5.3 3.6 9.6 9 11.7 5.4-2.1 9-6.4 9-11.7V4.5L11 1Z" fill="#0B5D4B" /><path d="M6.5 13.5 9.6 10l2.6 2.2L15.8 8" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
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
