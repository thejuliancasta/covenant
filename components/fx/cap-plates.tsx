"use client";
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { motion, useInView } from "motion/react";
import { monthLabel, ppg, usd } from "@/lib/format";
import { cx } from "../ui";
import { CountUp } from "./count";
import { SPRING_FLUID, SPRING_UI, tok, useCalm, useSize } from "./motion";

interface CapRow { month: string; index: number; payout: number; triggered: boolean; coveredGallons: number }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const safeId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "");

/**
 * The cap as plates above the strike (docs/UI_DIRECTION.md, item 5). Each plate is one
 * $0.25-per-gallon step. Twelve fluid columns are the real monthly index means of the
 * cover year; the selected month lights every plate its price pushed through. Scrub
 * or use the arrow keys to read each month; the readout shows the replayed payout.
 */
export function CapPlates({ strike, step = 0.25, rows, today, inception }: {
  strike: number; step?: number;
  rows: CapRow[];
  today: { index: number; date: string };
  inception: { month: string; index: number };
}) {
  const uid = safeId(useId());
  const wrap = useRef<HTMLDivElement>(null);
  const { width } = useSize(wrap, { width: 640, height: 320 });
  const inView = useInView(wrap, { once: true, amount: 0.3 });
  const calm = useCalm();
  const show = calm || inView;

  const best = rows.reduce((b, r, i) => (r.payout > rows[b].payout ? i : b), 0);
  const [pinned, setPinned] = useState(best);
  const [hover, setHover] = useState<number | null>(null);
  if (!rows.length) return null;
  const sel = clamp(hover ?? pinned, 0, rows.length - 1);
  const row = rows[sel];

  const narrow = width < 520;
  const W = Math.max(260, width), H = narrow ? 280 : 320;
  const L = narrow ? 46 : 54, R = narrow ? 46 : 56, T = 10, B = 24;
  const plotW = W - L - R, plotH = H - T - B, base = T + plotH;
  const top = Math.max(today.index, ...rows.map((r) => r.index));
  const n = clamp(Math.ceil((top - strike) / step) + 1, 4, 12);
  const hi = strike + n * step + 0.04;
  const low = Math.min(strike, inception.index, ...rows.map((r) => r.index));
  const lo = Math.floor((low - 0.3) / 0.25) * 0.25;
  const sy = (v: number) => T + (1 - (v - lo) / (hi - lo)) * plotH;

  const pitch = sy(strike) - sy(strike + step);
  const gap = pitch < 12 ? 2 : 3;
  const plates = Array.from({ length: n }, (_, k) => {
    const lower = strike + k * step, upper = lower + step;
    return { k, upper, y: sy(upper) + gap / 2, h: Math.max(2, sy(lower) - sy(upper) - gap) };
  });
  const over = (row.index - strike) / step;
  const full = Math.max(0, Math.floor(over));
  const frac = clamp((row.index - strike) / (n * step), 0, 1);

  const slot = plotW / rows.length;
  const colW = clamp(slot * 0.44, 6, 22);
  const labelEvery = Math.max(1, Math.ceil(46 / slot));

  // Markers: strike and inception on the left, today on the right. Labels never collide.
  const strikeY = sy(strike), todayY = sy(today.index);
  const incTickY = sy(inception.index);
  const incLabelY = Math.abs(incTickY - strikeY) < 28 ? strikeY + 28 : incTickY;
  const plateLabelEvery = pitch < 14 ? 2 : 1;

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return clamp(Math.floor((e.clientX - r.left - L) / slot), 0, rows.length - 1);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = e.key === "ArrowRight" || e.key === "ArrowUp" ? sel + 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? sel - 1 : e.key === "Home" ? 0 : e.key === "End" ? rows.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    setHover(null);
    setPinned(clamp(next, 0, rows.length - 1));
  };

  const crossedText = row.index <= strike ? "No plates crossed" : full === 0 ? "Into the first plate" : `${full} ${full === 1 ? "plate" : "plates"} crossed`;
  const valueText = `${monthLabel(row.month, true)}: index ${ppg(row.index)}, ${crossedText.toLowerCase()}, ${row.triggered ? `${usd(row.payout)} would have been paid` : "no payout, below the strike"}`;

  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-end gap-x-8 gap-y-3">
        <div className="min-w-[132px]">
          <p className="text-[13px] leading-5 text-muted">{monthLabel(row.month, true)} index</p>
          <p className="mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.04em] text-ink"><CountUp value={row.index} format={ppg} duration={0.45} /></p>
        </div>
        <div>
          <p className="text-[13px] leading-5 text-muted">Plates</p>
          <p className={cx("num mt-1.5 text-[16px] font-medium leading-6", row.index > strike ? "text-heat" : "text-muted")}>{crossedText}</p>
        </div>
        <div>
          <p className="text-[13px] leading-5 text-muted">Payout that month</p>
          <p className={cx("num mt-1.5 text-[16px] font-medium leading-6", row.triggered ? "text-jade" : "text-muted")}>
            {row.triggered ? <><CountUp value={row.payout} format={(v) => usd(v)} duration={0.45} /> would have been paid</> : "No payout: below the strike"}
          </p>
        </div>
      </div>

      <div
        ref={wrap}
        role="slider" tabIndex={0} aria-label="Cover month" aria-valuemin={1} aria-valuemax={rows.length} aria-valuenow={sel + 1} aria-valuetext={valueText}
        onKeyDown={onKey}
        onPointerMove={(e) => setHover(pick(e))}
        onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => { const i = pick(e); setPinned(i); setHover(null); }}
        className="relative w-full cursor-crosshair touch-pan-y select-none rounded-control"
      >
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block w-full" aria-hidden>
          <defs>
            <clipPath id={`${uid}-p`}>
              {plates.map((p) => <rect key={p.k} x={L} y={p.y} width={plotW} height={p.h} rx={Math.min(6, p.h / 2)} />)}
            </clipPath>
            {rows.map((r, i) => {
              const cx0 = L + (i + 0.5) * slot - colW / 2, y = sy(r.index);
              return <clipPath key={i} id={`${uid}-c${i}`}><rect x={cx0} y={y} width={colW} height={Math.max(0, base - y)} rx={Math.min(5, colW / 2)} /></clipPath>;
            })}
          </defs>

          {/* Plates: one per $0.25 step above the strike. */}
          {plates.map((p) => {
            const crossed = p.k < full, partial = p.k === full && over > 0 && over < n;
            return (
              <rect
                key={p.k} x={L + 0.5} y={p.y} width={plotW - 1} height={p.h} rx={Math.min(6, p.h / 2)}
                style={{
                  fill: tok("well", 0.4),
                  stroke: crossed ? tok("heat", 0.5) : partial ? tok("heat", 0.3) : tok("line", 0.12),
                  transition: "stroke 160ms ease-out",
                }}
              />
            );
          })}
          {/* Lit plates: the selected month's price, pushed up through the stack. */}
          <g clipPath={`url(#${uid}-p)`}>
            <motion.rect
              x={L} y={sy(strike + n * step)} width={plotW} height={Math.max(0, strikeY - sy(strike + n * step))}
              fill={tok("heat", 0.22)} style={{ originY: 1 }}
              initial={calm ? false : { scaleY: 0 }} animate={{ scaleY: show ? frac : 0 }} transition={calm ? { duration: 0 } : SPRING_UI}
            />
          </g>
          {plates.map((p) => {
            if (p.k % plateLabelEvery !== plateLabelEvery - 1 && plateLabelEvery > 1) return null;
            const ly = sy(p.upper) + 3.5;
            if (Math.abs(ly - todayY) < 16) return null;
            return <text key={p.k} x={W - R + 8} y={ly} fontSize="11" fill={tok("faint")} className="num">{ppg(p.upper)}</text>;
          })}

          {/* Selected month slot. */}
          <rect
            x={L + sel * slot + 1} y={T} width={Math.max(0, slot - 2)} height={plotH} rx="6"
            fill={tok("ink", 0.035)} stroke={tok("jade", 0.4)} strokeWidth="1"
            style={{ transition: "x 140ms ease-out" }}
          />

          {/* Cover months as fluid columns. Below the strike neutral, above it heat. */}
          {rows.map((r, i) => {
            const cx0 = L + (i + 0.5) * slot - colW / 2, y = sy(r.index);
            return (
              <motion.g
                key={r.month} style={{ originY: 1 }} opacity={i === sel ? 1 : 0.62} className="transition-opacity duration-150 ease-out"
                initial={calm ? false : { scaleY: 0 }} animate={{ scaleY: show ? 1 : 0 }}
                transition={calm ? { duration: 0 } : { ...SPRING_FLUID, delay: Math.min(0.05, 0.5 / rows.length) * i }}
              >
                <g clipPath={`url(#${uid}-c${i})`}>
                  <rect x={cx0} y={Math.max(y, strikeY)} width={colW} height={Math.max(0, base - Math.max(y, strikeY))} fill={tok("ink2", 0.18)} />
                  {r.index > strike && <rect x={cx0} y={y} width={colW} height={strikeY - y} fill={tok("heat", 0.6)} />}
                </g>
              </motion.g>
            );
          })}

          {/* Strike. */}
          <line x1={L - 4} x2={W - R} y1={strikeY} y2={strikeY} stroke={tok("ink", 0.5)} strokeDasharray="5 4" />
          <text x={L - 8} y={strikeY - 2} textAnchor="end" fontSize="11" fill={tok("ink2")}>Strike</text>
          <text x={L - 8} y={strikeY + 11} textAnchor="end" fontSize="11" fill={tok("ink2")} className="num">{ppg(strike)}</text>

          {/* Inception index. */}
          <line x1={L - 4} x2={L + 6} y1={incTickY} y2={incTickY} stroke={tok("faint")} />
          <text x={L - 8} y={incLabelY - 2} textAnchor="end" fontSize="11" fill={tok("faint")} className="num">{monthLabel(inception.month)}</text>
          <text x={L - 8} y={incLabelY + 11} textAnchor="end" fontSize="11" fill={tok("faint")} className="num">{ppg(inception.index)}</text>

          {/* Today's index. */}
          <line x1={W - R - 8} x2={W - R + 4} y1={todayY} y2={todayY} stroke={tok("heat")} strokeWidth="2" strokeLinecap="round" />
          <text x={W - R + 8} y={todayY - 2} fontSize="11" fill={tok("heat")}>Today</text>
          <text x={W - R + 8} y={todayY + 11} fontSize="11" fill={tok("heat")} className="num">{ppg(today.index)}</text>

          {/* Month labels. */}
          {rows.map((r, i) => {
            if ((rows.length - 1 - i) % labelEvery !== 0 && i !== sel) return null;
            if (i !== sel && Math.abs(i - sel) < labelEvery) return null;
            return (
              <text key={r.month} x={L + (i + 0.5) * slot} y={H - 7} textAnchor="middle" fontSize="11" fill={i === sel ? tok("ink") : tok("faint")} className="num">{monthLabel(r.month)}</text>
            );
          })}
        </svg>
      </div>
      <p className="mt-2 text-[12px] leading-[1.45] text-faint">Each plate is {usd(step, 2)} per gallon above the strike. Columns are the monthly mean of the weekly index for each cover month. Scrub or use the arrow keys to read a month.</p>
    </div>
  );
}
