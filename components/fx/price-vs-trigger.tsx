"use client";
import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { motion } from "motion/react";
import { SPRING_FLUID, tok, useSize } from "./motion";

/*
 * "Price vs. where protection starts" (docs/PLAIN_LANGUAGE.md). One bar per month for
 * the diesel price in dollars a gallon, one dashed line where protection starts, and the
 * part of each bar above the line in the accent (that is the part CostShield pays back).
 * No dollar amounts sit on the bars: hover, tap or arrow keys pick a month, and one readout
 * under the chart gives that month's money back. The line is named on the price axis and in
 * the legend, so its label never covers a bar. Month labels are spaced about 84 px apart,
 * counted back from the latest month, and the selected month is always labelled.
 * Shared by the Protection screen, the replay on Payouts and the landing page.
 */

export interface PriceMonth { label: string; price: number; payout: number } // label e.g. "Apr '26"; price $/gal; payout $

const MONTHS: Record<string, string> = { Jan: "January", Feb: "February", Mar: "March", Apr: "April", May: "May", Jun: "June", Jul: "July", Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December" };
/** "Apr '26" -> "April 2026"; anything else passes through. */
const longLabel = (label: string) => {
  const m = label.match(/^([A-Z][a-z]{2}) '(\d{2})$/);
  return m && MONTHS[m[1]] ? `${MONTHS[m[1]]} 20${m[2]}` : label;
};
const money = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const gap = (d: number) => (d < 1 ? `${Math.round(d * 100)}¢` : `$${d.toFixed(2)}`);

/** One plain sentence for a month. */
export function monthSentence(m: PriceMonth, trigger: number): string {
  const d = m.price - trigger;
  const head = `${longLabel(m.label)}: diesel averaged $${m.price.toFixed(2)} a gallon, ${gap(Math.abs(d))} ${d > 0 ? "above" : "below"} where protection starts.`;
  return m.payout > 0 ? `${head} CostShield would have paid you ${money(m.payout)}.` : `${head} No money back that month.`;
}

export function PriceVsTrigger({ months, trigger, selected, onSelect, height = 260, compact = false, readout }: {
  months: PriceMonth[];
  trigger: number;
  selected?: number;
  onSelect?: (i: number) => void;
  height?: number;
  compact?: boolean;
  /** "amount" leads with the month's money back as one large figure; "sentence" is one plain line. Defaults to "sentence" when compact. */
  readout?: "amount" | "sentence";
}) {
  const box = useRef<HTMLDivElement>(null);
  const { width } = useSize(box, { width: 640, height: 0 });
  const uid = useId().replace(/:/g, "");
  const fallback = useMemo(() => {
    let best = months.length - 1, top = 0;
    months.forEach((m, i) => { if (m.payout > top) { top = m.payout; best = i; } });
    return Math.max(0, best);
  }, [months]);
  const [own, setOwn] = useState<number | null>(null);
  const sel = Math.min(months.length - 1, Math.max(0, selected ?? own ?? fallback));
  const pick = (i: number) => { const j = Math.max(0, Math.min(months.length - 1, i)); setOwn(j); onSelect?.(j); };

  const W = Math.max(240, width), H = height;
  const L = 46, R = 4, T = 12, B = 30;
  const plotW = W - L - R, plotH = H - T - B;
  const top = Math.max(trigger, ...months.map((m) => m.price)) * 1.08;
  const niceMax = Math.ceil(top);
  const step = niceMax <= 4 ? 2 : niceMax <= 9 ? 3 : 5;
  const sy = (v: number) => T + (1 - v / top) * plotH;
  const slot = plotW / Math.max(1, months.length);
  const bw = Math.min(44, slot * (compact ? 0.56 : 0.62));
  const cx = (i: number) => L + slot * (i + 0.5);
  const ty = sy(trigger);
  const ticks = [step, step * 2].filter((t) => t <= top && Math.abs(sy(t) - ty) > 16); // a tick too close to the line gives way to the line's own label
  const LABEL_W = 56; // room one "Sep '26" needs at 12.5 px
  const every = Math.max(1, Math.ceil(84 / slot)); // one label about every 84 px: fewer labels, each large enough to read
  const labelled = (i: number) => i === sel || ((months.length - 1 - i) % every === 0 && Math.abs(i - sel) >= every);
  const lx = (i: number) => Math.min(W - LABEL_W / 2 + 6, Math.max(LABEL_W / 2 - 6, cx(i))); // keep the first and last label inside the frame
  const big = (readout ?? (compact ? "sentence" : "amount")) === "amount";

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    pick(Math.floor(((e.clientX - r.left) / r.width) * months.length));
  };
  const onKey = (e: KeyboardEvent) => {
    const next = e.key === "ArrowLeft" ? sel - 1 : e.key === "ArrowRight" ? sel + 1 : e.key === "Home" ? 0 : e.key === "End" ? months.length - 1 : null;
    if (next === null) return;
    e.preventDefault(); pick(next);
  };

  if (!months.length) return null;
  const m = months[sel];
  return (
    <figure className="min-w-0">
      <div
        ref={box} tabIndex={0} role="slider" aria-label="Month" aria-valuemin={0} aria-valuemax={months.length - 1} aria-valuenow={sel}
        aria-valuetext={monthSentence(m, trigger)} onKeyDown={onKey}
        className="relative w-full rounded-[8px] outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-jade"
        style={{ height: H }}
      >
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block select-none" aria-hidden>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={sy(t)} y2={sy(t)} stroke={tok("line", 0.06)} />
              <text x={L - 8} y={sy(t) + 4} textAnchor="end" fontSize="11" fill={tok("faint")} className="num">${t}</text>
            </g>
          ))}
          <line x1={L} x2={W - R} y1={sy(0)} y2={sy(0)} stroke={tok("line", 0.1)} />

          <rect x={cx(sel) - slot / 2} y={T - 8} width={slot} height={plotH + 8} rx="6" fill={tok("line", 0.035)} />

          {months.map((mo, i) => {
            const on = i === sel;
            const y = sy(mo.price), above = mo.price > trigger;
            return (
              <motion.g key={i} initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }}
                transition={{ ...SPRING_FLUID, delay: Math.min(0.5, i * 0.03) }} style={{ originY: 1, transformBox: "fill-box" }}>
                <rect x={cx(i) - bw / 2} y={above ? ty : y} width={bw} height={Math.max(0, sy(0) - (above ? ty : y))} rx="3"
                  fill={tok("ink", on ? 0.24 : 0.13)} />
                {above && <rect x={cx(i) - bw / 2} y={y} width={bw} height={ty - y} rx="3" fill={tok("jade", on ? 1 : 0.78)} />}
              </motion.g>
            );
          })}

          <line x1={L} x2={W - R} y1={ty} y2={ty} stroke={tok("ink", 0.6)} strokeDasharray="4 4" />
          <text x={L - 8} y={ty + 4} textAnchor="end" fontSize="12" fontWeight="600" fill={tok("ink")} className="num">${trigger.toFixed(2)}</text>

          {months.map((mo, i) => labelled(i) && (
            <text key={i} x={lx(i)} y={H - 8} textAnchor="middle" fontSize="12.5" fontWeight={i === sel ? 600 : 400} fill={tok(i === sel ? "ink" : "muted")} className="num">{mo.label}</text>
          ))}

          <rect x={L} y={0} width={plotW} height={H} fill="transparent" className="cursor-pointer touch-pan-y" onPointerMove={onMove} onPointerDown={onMove} />
        </svg>
      </div>
      <figcaption className="mt-3">
        <p className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-muted">
          {!compact && <span className="inline-flex items-center gap-2"><i aria-hidden className="h-2.5 w-2.5 rounded-[2px] bg-ink/25" />Diesel price that month</span>}
          {!compact && <span className="inline-flex items-center gap-2"><i aria-hidden className="h-2.5 w-2.5 rounded-[2px] bg-jade" />The part CostShield would pay back</span>}
          <span className="inline-flex items-center gap-2"><i aria-hidden className="w-4 border-t border-dashed border-ink/60" />Protection starts at <span className="num text-ink2">${trigger.toFixed(2)}</span> a gallon</span>
        </p>
        {big ? (
          <div id={`${uid}-say`} aria-live="polite" className="mt-4">
            <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className={`num text-[30px] font-[560] leading-none tracking-[-0.03em] ${m.payout > 0 ? "text-jade" : "text-ink2"}`}>{money(m.payout)}</span>
              <span className="text-[14px] leading-5 text-ink2">{m.payout > 0 ? "would have been paid back for" : "back for"} {longLabel(m.label)}</span>
            </p>
            <p className="num mt-1.5 text-[13px] leading-[1.5] text-muted">Diesel averaged ${m.price.toFixed(2)} a gallon, {gap(Math.abs(m.price - trigger))} {m.price > trigger ? "above" : "below"} where protection starts.</p>
          </div>
        ) : <p id={`${uid}-say`} aria-live="polite" className="num mt-2 max-w-[72ch] text-[14px] leading-[1.55] text-ink2">{monthSentence(m, trigger)}</p>}
      </figcaption>
    </figure>
  );
}
