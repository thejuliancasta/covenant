"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { DEFAULT_EXPLORER, addressUrl, txUrl } from "@/lib/chain/types";
import { cx } from "../ui";
import { UI_SPRING } from "./motion";

export const short = (s: string, a = 6, b = 6) => (s.length > a + b + 2 ? `${s.slice(0, a)}…${s.slice(-b)}` : s);

export function ArrowOut({ className }: { className?: string }) {
  return <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden className={className}><path d="M3 1.5h5.5V7M8.3 1.7 1.6 8.4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function CopyGlyph() {
  return <svg viewBox="0 0 14 14" width="13" height="13" aria-hidden><rect x="4.5" y="4.5" width="7.5" height="7.5" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M9.5 2.6V2.4A1.4 1.4 0 0 0 8.1 1H3a2 2 0 0 0-2 2v5.1a1.4 1.4 0 0 0 1.4 1.4h.2" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>;
}

/** A check that draws itself. */
export function DrawCheck({ className, size = 13 }: { className?: string; size?: number }) {
  return (
    <svg viewBox="0 0 14 14" width={size} height={size} aria-hidden className={className}>
      <motion.path d="M2.5 7.4 5.6 10.3 11.5 3.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }} />
    </svg>
  );
}

type CopyState = "idle" | "yes" | "no";

export function useCopy(text: string) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setState("yes"); } catch { setState("no"); }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2200);
  };
  return { state, copy };
}

/** Icon-only copy control with a 40px hit area and a drawn check on success. */
export function CopyIcon({ text, label, className }: { text: string; label: string; className?: string }) {
  const { state, copy } = useCopy(text);
  return (
    <button type="button" onClick={copy} aria-label={state === "yes" ? "Copied" : state === "no" ? "Copy failed" : label} title={state === "no" ? "Copy failed: select and copy" : label}
      className={cx("relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-faint transition-[color,background-color,transform] duration-150 before:absolute before:-inset-1.5 before:content-[''] hover:bg-well hover:text-ink active:scale-[0.94]", state === "yes" && "text-jade hover:text-jade", state === "no" && "text-rust", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={state} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={UI_SPRING} className="inline-flex">
          {state === "yes" ? <DrawCheck /> : state === "no" ? <span className="text-[13px] leading-none">!</span> : <CopyGlyph />}
        </motion.span>
      </AnimatePresence>
      <span className="sr-only" aria-live="polite">{state === "yes" ? "Copied" : state === "no" ? "Copy failed" : ""}</span>
    </button>
  );
}

/** Transaction reference: short signature that opens the explorer, plus copy. Plain text, no chip. */
export function TxChip({ sig, explorer, label, className, tone = "neutral" }: { sig: string; explorer?: string; label?: ReactNode; className?: string; tone?: "neutral" | "jade" }) {
  return (
    <span className={cx("inline-flex max-w-full items-center gap-1", className)}>
      {label && <span className="mr-1 whitespace-nowrap text-[12px] text-muted">{label}</span>}
      <a href={txUrl(explorer ?? DEFAULT_EXPLORER, sig)} target="_blank" rel="noreferrer" title={`Open transaction ${sig} on Solana Explorer (devnet)`}
        className={cx("relative inline-flex items-center gap-1 whitespace-nowrap font-mono text-[11.5px] underline-offset-[3px] transition-colors duration-150 before:absolute before:-inset-y-3 before:inset-x-0 before:content-[''] hover:underline", tone === "jade" ? "text-jade hover:text-ink" : "text-ink2 hover:text-jade")}>
        {short(sig)}<ArrowOut className="opacity-70" />
      </a>
      <CopyIcon text={sig} label="Copy transaction signature" />
    </span>
  );
}

/** Address reference: same treatment as a transaction. */
export function AddrChip({ addr, explorer, className }: { addr: string; explorer?: string; className?: string }) {
  return (
    <span className={cx("inline-flex max-w-full items-center gap-1", className)}>
      <a href={addressUrl(explorer ?? DEFAULT_EXPLORER, addr)} target="_blank" rel="noreferrer" title={addr}
        className="relative inline-flex items-center gap-1 whitespace-nowrap font-mono text-[11.5px] text-ink2 underline-offset-[3px] transition-colors duration-150 before:absolute before:-inset-y-3 before:inset-x-0 before:content-[''] hover:text-jade hover:underline">
        {short(addr, 4, 4)}<ArrowOut className="opacity-70" />
      </a>
      <CopyIcon text={addr} label="Copy address" />
    </span>
  );
}

/** The sha256 of the EIA data file the oracle used. */
export function HashChip({ hash, className }: { hash: string; className?: string }) {
  return (
    <span className={cx("inline-flex max-w-full items-center gap-1.5", className)} title={hash}>
      <span className="text-[12px] text-muted">sha256</span>
      <span className="font-mono text-[11.5px] text-ink2">{hash.length > 20 ? `${hash.slice(0, 16)}…` : hash}</span>
      {hash.length >= 32 && <CopyIcon text={hash} label="Copy the full sha256" />}
    </span>
  );
}
