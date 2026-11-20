"use client";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { EVIDENCE_LABEL, type Evidence } from "@/lib/engine/types";

/*
 * Shared primitives (Revision 2 of docs/UI_DIRECTION.md). Text never sits inside a
 * box, pill or circle: status and evidence are plain text carried by color, weight
 * and a small state dot or dash. Surfaces are quiet tonal scrims over the background
 * artwork, without borders. Buttons stay buttons (radius 10 px); secondary actions
 * are text links with an arrow. Every export keeps its original props.
 */

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

/** Heading style shared by every screen: Geist, 560 to 600 weight, tight tracking. */
export const display = "font-semibold tracking-[-0.04em] text-ink";

/** A grouped region: a soft tonal scrim (no border) so text stays readable over the artwork. */
export function Card({ children, className, pad = true, as: El = "section" }: { children: ReactNode; className?: string; pad?: boolean; as?: "section" | "div" | "article" | "li" }) {
  return (
    <El className={cx("min-w-0 rounded-surface bg-bg/60 shadow-[0_0_56px_36px_rgb(var(--bg)/0.6)]", pad && "p-5 sm:p-7", className)}>{children}</El>
  );
}

/** Quiet context line. Sentence case, no tracking: the title leads. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[13px] leading-5 text-faint">{children}</p>;
}

type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "cipher";
const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-muted", info: "text-ink2", good: "text-jade", warn: "text-heat", bad: "text-rust", cipher: "text-cipher",
};
const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-faint", info: "bg-ink2/60", good: "bg-jade", warn: "bg-heat", bad: "bg-rust", cipher: "bg-cipher",
};

/** Status as plain text: a small dot carries the state, the word names it. */
export function Tag({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-medium leading-5", TONE_TEXT[tone], className)}>
      <span aria-hidden className={cx("h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[tone])} />{children}
    </span>
  );
}

const EV_TONE: Record<string, string> = { V: "text-jade", C: "text-ink2", E: "text-heat", A: "text-muted" };

/** Evidence mark: a small raised letter (verified, calculated, estimate, assumption). Hover or focus names it. */
export function Ev({ e }: { e: Evidence | string }) {
  const label = EVIDENCE_LABEL[e as Evidence] ?? e;
  return (
    <abbr
      tabIndex={0} title={label} aria-label={label}
      className={cx("ml-[3px] cursor-help align-super text-[9.5px] font-semibold leading-none no-underline decoration-dotted underline-offset-2 transition-[color] duration-150 hover:underline focus-visible:underline", EV_TONE[e] ?? EV_TONE.A)}
    >{e}</abbr>
  );
}

const BTN_VARIANT = {
  primary: "rounded-control bg-jade px-[18px] text-jade-ink hover:bg-jade/90 disabled:bg-well disabled:text-faint",
  secondary: "px-1 text-ink hover:text-jade disabled:text-faint",
  ghost: "px-1 text-muted hover:text-ink disabled:text-faint",
};
const BTN_SIZE = { sm: "min-h-10 py-2 text-[13px]", md: "min-h-10 py-2.5 text-sm", lg: "min-h-12 py-3 text-[15px]" };

/** Button. Primary is a filled 10 px control; secondary is a text link with an arrow; ghost is plain text. */
export function Button({ children, onClick, variant = "primary", size = "md", disabled, className, type = "button", title, ariaLabel }: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" | "lg";
  disabled?: boolean; className?: string; type?: "button" | "submit"; title?: string; ariaLabel?: string;
}) {
  return (
    <button
      type={type} onClick={onClick} disabled={disabled} title={title} aria-label={ariaLabel}
      className={cx(
        "group/btn relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium",
        "transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100",
        BTN_SIZE[size], BTN_VARIANT[variant], variant === "primary" && size === "lg" && "px-6", className,
      )}
    >{children}{variant === "secondary" && !disabled && <Arrow />}</button>
  );
}

/** Arrow glyph for forward actions; nudges right on button hover. */
export function Arrow({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className={cx("-mr-0.5 shrink-0 transition-transform duration-150 ease-out group-hover/btn:translate-x-0.5", className)}>
      <path d="M3 8h9.2M8.6 4.2 12.4 8l-3.8 3.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Stat({ label, value, sub, ev }: { label: string; value: ReactNode; sub?: ReactNode; ev?: Evidence }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] leading-5 text-muted">{label}{ev && <Ev e={ev} />}</p>
      <p className={cx("num mt-2 text-[30px] leading-none sm:text-[36px]", display)}>{value}</p>
      {sub && <p className="num mt-2 text-[12.5px] leading-[1.45] text-faint">{sub}</p>}
    </div>
  );
}

/** Label and value pair, separated by rhythm alone. */
export function Row({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-2.5">
      <div className="min-w-0 flex-1"><p className="text-[14px] leading-5 text-muted">{label}</p>{hint && <p className="mt-0.5 text-[12px] leading-[1.45] text-faint">{hint}</p>}</div>
      <div className="num max-w-[62%] shrink-0 break-words text-right text-[14px] font-medium leading-5 text-ink">{children}</div>
    </div>
  );
}

const NOTE_TONE = { info: "text-ink2", warn: "text-heat", good: "text-jade" };
const NOTE_DASH = { info: "bg-ink2/60", warn: "bg-heat", good: "bg-jade" };

/** Callout as plain text: a short dash in the tone color leads the title. */
export function Note({ tone = "info", title, children }: { tone?: "info" | "warn" | "good"; title?: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[14px_1fr] gap-x-2.5 text-[13.5px] leading-[1.6]">
      <span aria-hidden className={cx("mt-[10px] h-[2px] w-3.5 rounded-full", NOTE_DASH[tone])} />
      <div className="min-w-0">{title && <p className={cx("font-medium", NOTE_TONE[tone])}>{title}</p>}<div className="text-muted">{children}</div></div>
    </div>
  );
}

/** Pass or fail as a bare glyph in the tone color. */
export function Check({ ok }: { ok: boolean }) {
  return ok
    ? <svg role="img" aria-label="pass" width="16" height="16" viewBox="0 0 16 16" className="mt-0.5 shrink-0 text-jade"><path d="m3 8.4 3.2 3.1L13 4.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
    : <svg role="img" aria-label="fail" width="16" height="16" viewBox="0 0 16 16" className="mt-0.5 shrink-0 text-rust"><path d="m4 4 8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

/**
 * Page title. `eyebrow` is kept for compatibility and renders as a quiet context line
 * under the lede (the title leads).
 */
export function PageHead({ eyebrow, title, lede, aside }: { eyebrow?: ReactNode; title: ReactNode; lede?: ReactNode; aside?: ReactNode }) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
      className={cx("mb-12 sm:mb-16", aside ? "grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end" : "max-w-3xl")}
    >
      <div className="max-w-3xl">
        <h1 className={cx("text-[36px] leading-[1.03] sm:text-[54px] sm:leading-[1.0]", display)}>{title}</h1>
        {lede && <p className="mt-5 max-w-[62ch] text-[16px] leading-[1.6] text-muted sm:text-[17px]">{lede}</p>}
        {eyebrow && <p className="mt-4 text-[13px] leading-5 text-faint">{eyebrow}</p>}
      </div>
      {aside}
    </motion.header>
  );
}

/** Data table without a frame: a quiet header line and rows that alternate tone. */
export function Table({ head, rows, align }: { head: ReactNode[]; rows: ReactNode[][]; align?: ("l" | "r")[] }) {
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
        <thead><tr>{head.map((h, i) => <th key={i} scope="col" className={cx("whitespace-nowrap px-2 pb-2.5 text-[12px] font-medium text-faint", align?.[i] === "r" && "text-right")}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="odd:bg-line/[0.03]">{r.map((c, j) => <td key={j} className={cx("num px-2 py-2.5 align-top text-ink2 first:rounded-l-md last:rounded-r-md", align?.[j] === "r" && "text-right")}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

/** Horizontal meter for a 0..1 value. The fill springs to the value when it first appears. */
export function Meter({ value, tone = "good", label }: { value: number; tone?: "good" | "warn" | "neutral"; label?: string }) {
  const fill = tone === "good" ? "bg-jade" : tone === "warn" ? "bg-heat" : "bg-ink2/70";
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="h-[3px] w-full overflow-hidden rounded-full bg-line/10" role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={v} aria-label={label}>
      <motion.div className={cx("h-full rounded-full", fill)} initial={{ width: 0 }} whileInView={{ width: `${v * 100}%` }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 140, damping: 22 }} />
    </div>
  );
}

/** Section title: one size for every group heading. */
export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cx("text-[17px] font-medium leading-6 tracking-[-0.015em] text-ink", className)}>{children}</h2>;
}
