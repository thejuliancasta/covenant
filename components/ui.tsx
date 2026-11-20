"use client";
import type { ReactNode } from "react";
import { EVIDENCE_LABEL, type Evidence } from "@/lib/engine/types";

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

export function Card({ children, className, pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  return <section className={cx("min-w-0 rounded-2xl border border-line bg-surface shadow-card", pad && "p-5 sm:p-6", className)}>{children}</section>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-faint">{children}</p>;
}

export function Tag({ tone = "neutral", children }: { tone?: "neutral" | "good" | "warn" | "bad" | "info"; children: ReactNode }) {
  const tones = {
    neutral: "bg-paper text-muted border-line", good: "bg-shield-soft text-shield-dark border-shield-line",
    warn: "bg-amber-soft text-amber border-amber-line", bad: "bg-rust-soft text-rust border-rust-line", info: "bg-slate-soft text-slate border-slate-line",
  };
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium", tones[tone])}>{children}</span>;
}

/** Evidence chip: shows whether a number is verified, calculated, estimated or assumed. */
export function Ev({ e }: { e: Evidence | string }) {
  const tone = e === "V" ? "text-shield border-shield-line" : e === "C" ? "text-slate border-slate-line" : "text-amber border-amber-line";
  return <abbr title={EVIDENCE_LABEL[e as Evidence] ?? e} className={cx("ml-1 inline-block cursor-help rounded border px-1 align-middle font-mono text-[9px] font-semibold leading-[14px] no-underline", tone)}>{e}</abbr>;
}

export function Button({ children, onClick, variant = "primary", disabled, className, type = "button" }: { children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost"; disabled?: boolean; className?: string; type?: "button" | "submit" }) {
  const v = {
    primary: "bg-ink text-white hover:bg-black disabled:bg-faint",
    secondary: "border border-line bg-surface text-ink hover:border-ink/40 disabled:text-faint",
    ghost: "text-muted hover:text-ink",
  };
  return <button type={type} onClick={onClick} disabled={disabled} className={cx("inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed", v[variant], className)}>{children}</button>;
}

export function Stat({ label, value, sub, ev }: { label: string; value: ReactNode; sub?: ReactNode; ev?: Evidence }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}{ev && <Ev e={ev} />}</p>
      <p className="num mt-1 font-display text-[28px] leading-none tracking-tight text-ink sm:text-[32px]">{value}</p>
      {sub && <p className="mt-1.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function Row({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-line/70 py-2.5 last:border-0">
      <div className="min-w-0"><p className="text-sm text-muted">{label}</p>{hint && <p className="mt-0.5 text-xs text-faint">{hint}</p>}</div>
      <div className="num min-w-0 max-w-[62%] break-words text-right text-sm font-medium text-ink">{children}</div>
    </div>
  );
}

export function Note({ tone = "info", title, children }: { tone?: "info" | "warn" | "good"; title?: string; children: ReactNode }) {
  const t = { info: "border-slate-line bg-slate-soft text-slate", warn: "border-amber-line bg-amber-soft text-amber", good: "border-shield-line bg-shield-soft text-shield-dark" }[tone];
  return <div className={cx("rounded-xl border px-4 py-3 text-[13px] leading-relaxed", t)}>{title && <p className="mb-0.5 font-semibold">{title}</p>}<div className="text-ink/80">{children}</div></div>;
}

export function Check({ ok }: { ok: boolean }) {
  return ok
    ? <span aria-label="pass" className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-shield text-[10px] text-white">✓</span>
    : <span aria-label="fail" className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rust text-[10px] text-white">✕</span>;
}

export function PageHead({ eyebrow, title, lede }: { eyebrow: string; title: ReactNode; lede?: ReactNode }) {
  return (
    <header className="mb-7 max-w-3xl animate-rise">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-2 font-display text-[34px] leading-[1.08] tracking-tight text-ink sm:text-[44px]">{title}</h1>
      {lede && <p className="mt-3 text-[15px] leading-relaxed text-muted">{lede}</p>}
    </header>
  );
}

export function Table({ head, rows, align }: { head: ReactNode[]; rows: ReactNode[][]; align?: ("l" | "r")[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
        <thead><tr>{head.map((h, i) => <th key={i} className={cx("border-b border-line pb-2 pr-4 text-[11px] font-medium uppercase tracking-wider text-faint", align?.[i] === "r" && "text-right")}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-line/60 last:border-0">{r.map((c, j) => <td key={j} className={cx("num py-2 pr-4 align-top", align?.[j] === "r" && "text-right")}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
