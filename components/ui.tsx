"use client";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { EVIDENCE_LABEL, type Evidence } from "@/lib/engine/types";

/*
 * Shared primitives, Revision 3 of docs/UI_DIRECTION.md (Linear-style precision).
 * Surfaces: 1 px hairline at line/8 with a lighter 1 px inner top edge. Hover brightens
 * the border; interactive surfaces lift 1 px. Buttons carry a subtle top highlight.
 * Text is never inside a pill, chip or circle: status and evidence are plain colored text.
 * Every export keeps its original props (Builder B and the landing page import these).
 */

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

/** Heading style shared by every screen. */
export const display = "font-[560] tracking-[-0.025em] text-ink";

/** Surface classes, exported so other components can frame things the same way. */
export const surface = "rounded-[12px] border border-line/[0.08] bg-raised shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]";
/** Interactive surface: brightens its border and lifts 1 px on hover. */
export const surfaceHover = "transition-[border-color,transform,background-color] duration-150 ease-out hover:-translate-y-px hover:border-line/[0.14]";

export function Card({ children, className, pad = true, as: El = "section" }: { children: ReactNode; className?: string; pad?: boolean; as?: "section" | "div" | "article" | "li" }) {
  return (
    <El className={cx("min-w-0", surface, "transition-[border-color] duration-150 ease-out hover:border-line/[0.12]", pad && "p-5 sm:p-6", className)}>{children}</El>
  );
}

/** Quiet context line. Sentence case, no tracking. */
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
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-[510] leading-5", TONE_TEXT[tone], className)}>
      <span aria-hidden className={cx("h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[tone])} />{children}
    </span>
  );
}

const EV_TONE: Record<string, string> = { V: "text-jade", C: "text-ink2", E: "text-heat", A: "text-muted" };
/** Plain-word meaning of each evidence letter. */
const EV_PLAIN: Record<string, string> = {
  V: "Verified: official public data, such as U.S. government prices or a live market",
  C: "Calculated: worked out from your records and public data",
  E: "Estimate: our best reading, and it could be off",
  A: "Assumption: a number we chose, shown so you can weigh it",
};

/** Evidence mark: a small raised letter (verified, calculated, estimate, assumption). Hover or focus names it. */
export function Ev({ e }: { e: Evidence | string }) {
  const label = EV_PLAIN[e] ?? EVIDENCE_LABEL[e as Evidence] ?? e;
  return (
    <abbr
      tabIndex={0} title={label} aria-label={label}
      className={cx("ml-[3px] cursor-help align-super text-[9.5px] font-semibold leading-none no-underline decoration-dotted underline-offset-2 transition-[color] duration-150 hover:underline focus-visible:underline", EV_TONE[e] ?? EV_TONE.A)}
    >{e}</abbr>
  );
}

const BTN_VARIANT = {
  primary: "border border-jade bg-jade text-jade-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.28)] hover:bg-jade/90 disabled:border-line/[0.08] disabled:bg-well disabled:text-faint disabled:shadow-none",
  secondary: "border border-line/[0.1] bg-panel text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] hover:border-line/[0.16] hover:bg-well disabled:text-faint disabled:hover:border-line/[0.1] disabled:hover:bg-panel",
  ghost: "text-muted hover:bg-line/[0.04] hover:text-ink disabled:text-faint",
};
const BTN_SIZE = { sm: "h-8 px-3 text-[13px]", md: "h-9 px-3.5 text-[13px]", lg: "h-10 px-4 text-[14px]" };

/** Button: 8 px radius, a subtle top highlight, presses to 0.98. */
export function Button({ children, onClick, variant = "primary", size = "md", disabled, className, type = "button", title, ariaLabel }: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" | "lg";
  disabled?: boolean; className?: string; type?: "button" | "submit"; title?: string; ariaLabel?: string;
}) {
  return (
    <button
      type={type} onClick={onClick} disabled={disabled} title={title} aria-label={ariaLabel}
      className={cx(
        "group/btn relative inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] font-[510]",
        "transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100",
        BTN_SIZE[size], BTN_VARIANT[variant], className,
      )}
    >{children}</button>
  );
}

/** Arrow glyph for forward actions; nudges right on button hover. */
export function Arrow({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden className={cx("-mr-0.5 shrink-0 transition-transform duration-150 ease-out group-hover/btn:translate-x-0.5", className)}>
      <path d="M3 8h9.2M8.6 4.2 12.4 8l-3.8 3.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Stat({ label, value, sub, ev }: { label: string; value: ReactNode; sub?: ReactNode; ev?: Evidence }) {
  return (
    <div className="min-w-0">
      <p className="flex items-end text-[13px] leading-5 text-muted md:min-h-10"><span>{label}{ev && <Ev e={ev} />}</span></p>
      <p className={cx("num mt-1.5 text-[24px] leading-none sm:text-[28px]", display)}>{value}</p>
      {sub && <p className="num mt-2 text-[12px] leading-[1.45] text-faint">{sub}</p>}
    </div>
  );
}

/** Label and value pair, separated by rhythm. */
export function Row({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-2">
      <div className="min-w-0 flex-1"><p className="text-[13px] leading-5 text-muted">{label}</p>{hint && <p className="mt-0.5 text-[12px] leading-[1.45] text-faint">{hint}</p>}</div>
      <div className="num max-w-[62%] shrink-0 break-words text-right text-[13px] font-[510] leading-5 text-ink">{children}</div>
    </div>
  );
}

const NOTE_TONE = { info: "text-ink2", warn: "text-heat", good: "text-jade" };
const NOTE_DASH = { info: "bg-ink2/50", warn: "bg-heat", good: "bg-jade" };

/** Callout as plain text: a short dash in the tone color leads the title. */
export function Note({ tone = "info", title, children }: { tone?: "info" | "warn" | "good"; title?: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[12px_1fr] gap-x-2.5 text-[13px] leading-[1.6]">
      <span aria-hidden className={cx("mt-[10px] h-px w-3", NOTE_DASH[tone])} />
      <div className="min-w-0">{title && <p className={cx("font-[510]", NOTE_TONE[tone])}>{title}</p>}<div className="text-muted">{children}</div></div>
    </div>
  );
}

/** Pass or fail as a bare glyph in the tone color. */
export function Check({ ok }: { ok: boolean }) {
  return ok
    ? <svg role="img" aria-label="pass" width="14" height="14" viewBox="0 0 16 16" className="mt-[3px] shrink-0 text-jade"><path d="m3 8.4 3.2 3.1L13 4.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
    : <svg role="img" aria-label="fail" width="14" height="14" viewBox="0 0 16 16" className="mt-[3px] shrink-0 text-rust"><path d="m4 4 8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

/** Page title for app screens. `eyebrow` renders as a quiet context line under the lede. */
export function PageHead({ eyebrow, title, lede, aside }: { eyebrow?: ReactNode; title: ReactNode; lede?: ReactNode; aside?: ReactNode }) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
      className={cx("mb-10", aside ? "grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end" : "max-w-3xl")}
    >
      <div className="max-w-3xl">
        <h1 className={cx("text-[28px] leading-[1.1] sm:text-[34px] sm:leading-[1.08]", display)}>{title}</h1>
        {lede && <p className="mt-3 max-w-[60ch] text-[15px] leading-[1.6] text-muted">{lede}</p>}
        {eyebrow && <p className="mt-3 text-[13px] leading-5 text-faint">{eyebrow}</p>}
      </div>
      {aside}
    </motion.header>
  );
}

/** Data table: a quiet header and rows that alternate tone; framed by its surface, not by rules. */
export function Table({ head, rows, align }: { head: ReactNode[]; rows: ReactNode[][]; align?: ("l" | "r")[] }) {
  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
        <thead><tr>{head.map((h, i) => <th key={i} scope="col" className={cx("whitespace-nowrap px-2 pb-2 text-[12px] font-[510] text-faint", align?.[i] === "r" && "text-right")}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="odd:bg-line/[0.025]">{r.map((c, j) => <td key={j} className={cx("num px-2 py-2 align-top text-ink2 first:rounded-l-[6px] last:rounded-r-[6px]", align?.[j] === "r" && "text-right")}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

/** Horizontal meter for a 0..1 value. The fill springs to the value when it first appears. */
export function Meter({ value, tone = "good", label }: { value: number; tone?: "good" | "warn" | "neutral"; label?: string }) {
  const fill = tone === "good" ? "bg-jade" : tone === "warn" ? "bg-heat" : "bg-ink2/70";
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-line/[0.08]" role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={v} aria-label={label}>
      <motion.div className={cx("h-full rounded-full", fill)} initial={{ width: 0 }} whileInView={{ width: `${v * 100}%` }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 140, damping: 22 }} />
    </div>
  );
}

/** Group heading inside a surface: one size everywhere. */
export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cx("text-[15px] font-[560] leading-6 tracking-[-0.01em] text-ink", className)}>{children}</h2>;
}
