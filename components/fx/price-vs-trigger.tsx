"use client";
import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { motion } from "motion/react";
import { SPRING_FLUID, tok, useSize } from "./motion";

/*
 * "Price vs. where protection starts" (docs/PLAIN_LANGUAGE.md). One bar per month for
 * the diesel price, one dashed line where protection starts, the part of each bar above
 * the line in ember (that is the part CostShield pays back), and "$2.6K back" over each
 * month that paid. Hover, tap or arrow keys pick a month; one plain sentence explains it.
 * Shared by the Protection screen, the simulator, the replay and the landing page.
 */

export interface PriceMonth { label: string; price: number; payout: number } // label e.g. "Apr '26"; price $/gal; payout $

const MONTHS: Record<string, string> = { Jan: "January", Feb: "February", Mar: "March", Apr: "April", May: "May", Jun: "June", Jul: "July", Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December" };
/** "Apr '26" -> "April 2026"; anything else passes through. */
const longLabel = (label: string) => {
  const m = label.match(/^([A-Z][a-z]{2}) '(\d{2})$/);
  return m && MONTHS[m[1]] ? `${MONTHS[m[1]]} 20${m[2]}` : label;
};
const money = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const short = (v: number) => (v >= 10_000 ? `$${Math.round(v / 1000)}K` : v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${Math.round(v)}`);
const gap = (d: number) => (d < 1 ? `${Math.round(d * 100)}¢` : `$${d.toFixed(2)}`);

/** One plain sentence for a month. */
export function monthSentence(m: PriceMonth, trigger: number): string {
  const d = m.price - trigger;
  const head = `${longLabel(m.label)}: diesel averaged $${m.price.toFixed(2)} a gallon, ${gap(Math.abs(d))} ${d > 0 ? "above" : "below"} where protection starts.`;
  return m.payout > 0 ? `${head} CostShield would have paid you ${money(m.payout)}.` : `${head} No money back that month.`;
}

export function PriceVsTrigger({ months, trigger, selected, onSelect, height = 260, compact = false }: {
  months: PriceMonth[];
  trigger: number;
  selected?: number;
  onSelect?: (i: number) => void;
  height?: number;
  compact?: boolean;
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
  const L = 34, R = 4, T = 22, B = 24;
  const plotW = W - L - R, plotH = H - T - B;
  const top = Math.max(trigger, ...months.map((m) => m.price)) * 1.08;
  const niceMax = Math.ceil(top);
  const step = niceMax <= 4 ? 2 : niceMax <= 9 ? 3 : 5;
  const ticks = [step, step * 2].filter((t) => t <= top);
  const sy = (v: number) => T + (1 - v / top) * plotH;
  const slot = plotW / Math.max(1, months.length);
  const bw = Math.min(44, slot * (compact ? 0.56 : 0.62));
  const cx = (i: number) => L + slot * (i + 0.5);
  const ty = sy(trigger);
  const labelEvery = slot < 34 ? Math.ceil(34 / slot) : 1;
  const wide = slot >= 62;

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

          <rect x={cx(sel) - slot / 2} y={T - 18} width={slot} height={plotH + 18} rx="6" fill={tok("line", 0.035)} />

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
          <text x={W - R} y={ty - 7} textAnchor="end" fontSize="12" fill={tok("ink2")} stroke={tok("raised")} strokeWidth="4" paintOrder="stroke" className="num">
            Protection starts at ${trigger.toFixed(2)}
          </text>

          {months.map((mo, i) => mo.payout > 0 && (!compact || i === sel) && (
            <text key={i} x={cx(i)} y={sy(mo.price) - 7} textAnchor="middle" fontSize="11" fontWeight={i === sel ? 600 : 500}
              fill={tok("jade", i === sel ? 1 : 0.85)} stroke={tok("raised")} strokeWidth="3" paintOrder="stroke" className="num">
              {short(mo.payout)}{wide ? " back" : ""}
            </text>
          ))}

          {months.map((mo, i) => (i % labelEvery === 0 || i === sel) && (
            <text key={i} x={cx(i)} y={H - 6} textAnchor="middle" fontSize="11" fill={tok(i === sel ? "ink2" : "faint")} className="num">{mo.label}</text>
          ))}

          <rect x={L} y={0} width={plotW} height={H} fill="transparent" className="cursor-pointer touch-pan-y" onPointerMove={onMove} onPointerDown={onMove} />
        </svg>
      </div>
      <figcaption className="mt-3">
        {!compact && (
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-muted">
            <span className="inline-flex items-center gap-2"><i aria-hidden className="h-2.5 w-2.5 rounded-[2px] bg-ink/25" />Diesel price that month</span>
            <span className="inline-flex items-center gap-2"><i aria-hidden className="h-2.5 w-2.5 rounded-[2px] bg-jade" />The part CostShield pays back</span>
          </p>
        )}
        <p id={`${uid}-say`} aria-live="polite" className="num mt-2 max-w-[72ch] text-[14px] leading-[1.55] text-ink2">{monthSentence(m, trigger)}</p>
      </figcaption>
    </figure>
  );
}
