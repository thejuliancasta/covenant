"use client";
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { motion, useInView } from "motion/react";
import { SPRING_FLUID, tok, useCalm, useSize } from "./fx/motion";
import { cx } from "./ui";

/*
 * Charts in the pressure grammar: a price is a fluid surface, a reference level is a
 * dashed line, and what pushes above it tints heat. Drawn in real pixels from the
 * measured container width, so labels never scale. Pointer and keyboard scrub on
 * every chart; reduced motion shows the final state.
 */

/** Callers written for the old light theme pass these hex values; map them onto dark tokens. */
const LEGACY: Record<string, string> = {
  "#15181b": tok("ink2"), "#0b5d4b": tok("jade"), "#9a5b06": tok("heat"),
  "#8b9197": tok("faint"), "#cfcbc2": tok("line", 0.28), "#a8321f": tok("rust"),
};
export const chartColor = (c: string) => LEGACY[c.toLowerCase()] ?? c;

const safeId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "");
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Rounded tick values covering [lo, hi], about `count` of them. */
function niceTicks(lo: number, hi: number, count = 4) {
  const span = hi - lo || 1, raw = span / count, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count + 0.5) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

/** Scrub state shared by the charts: pointer (mouse, pen, touch) and keyboard move one index. */
function useScrub(n: number, toIndex: (px: number) => number) {
  const [idx, setIdx] = useState<number | null>(null);
  const focused = useRef(false);
  const fromPointer = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setIdx(clamp(toIndex(e.clientX - r.left), 0, n - 1));
  };
  return {
    idx,
    handlers: {
      onPointerMove: fromPointer, onPointerDown: fromPointer,
      onPointerLeave: () => { if (!focused.current) setIdx(null); },
      onFocus: () => { focused.current = true; setIdx((i) => i ?? n - 1); },
      onBlur: () => { focused.current = false; setIdx(null); },
      onKeyDown: (e: KeyboardEvent<SVGSVGElement>) => {
        const step = e.shiftKey ? 5 : 1;
        const next = e.key === "ArrowRight" ? (idx ?? -1) + step : e.key === "ArrowLeft" ? (idx ?? n) - step : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
        if (next === null) return;
        e.preventDefault();
        setIdx(clamp(next, 0, n - 1));
      },
    },
  };
}

/** Readout panel that follows the scrub guide and flips side near the right edge. */
function Readout({ x, width, children }: { x: number; width: number; children: React.ReactNode }) {
  const flip = x > width * 0.62;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute left-0 top-1 z-10 min-w-[128px] max-w-[280px] px-1 py-0.5 text-[12px] leading-[1.45] [text-shadow:0_0_8px_rgb(var(--bg)),0_0_3px_rgb(var(--bg)),0_0_1px_rgb(var(--bg))] transition-transform duration-100 ease-out"
      style={{ transform: `translateX(${flip ? x - 10 : x + 10}px) translateX(${flip ? "-100%" : "0"})` }}
    >{children}</div>
  );
}

/** Series name for the scrub readout: drop parenthetical detail (the legend keeps it), cap the length. */
const short = (label: string) => { const t = label.replace(/\s*\([^)]*\)/g, "").trim() || label; return t.length > 34 ? `${t.slice(0, 33)}…` : t; };

interface Line { label: string; color: string; values: (number | null)[]; dashed?: boolean; width?: number }

/** Responsive line chart with optional fluid columns on a second axis and a horizontal reference line. */
export function LineChart({ x, lines, bars, refLine, height = 220, yFmt = (v: number) => v.toFixed(2), barFmt }: {
  x: string[]; lines: Line[]; bars?: { label: string; color: string; values: number[] }; refLine?: { value: number; label: string }; height?: number; yFmt?: (v: number) => string; barFmt?: (v: number) => string;
}) {
  const uid = safeId(useId());
  const wrap = useRef<HTMLDivElement>(null);
  const { width } = useSize(wrap, { width: 720, height });
  const inView = useInView(wrap, { once: true, amount: 0.25 });
  const calm = useCalm();
  const show = calm || inView;

  const W = Math.max(240, width), H = height, L = 48, R = 14, T = 14, B = 26;
  const n = x.length, plotW = W - L - R, plotH = H - T - B;
  const all = lines.flatMap((l) => l.values.filter((v): v is number => v !== null && Number.isFinite(v))).concat(refLine ? [refLine.value] : []);
  let lo = all.length ? Math.min(...all) : 0, hi = all.length ? Math.max(...all) : 1;
  const padY = (hi - lo) * 0.1 || 1; lo -= padY; hi += padY;
  const sx = (i: number) => L + (n <= 1 ? 0.5 : i / (n - 1)) * plotW;
  const sy = (v: number) => T + (1 - (v - lo) / (hi - lo)) * plotH;
  const ticks = niceTicks(lo, hi, H < 200 ? 3 : 4).filter((t) => t > lo && t < hi);
  const maxLabels = Math.max(2, Math.floor(plotW / 64));
  const every = Math.max(1, Math.ceil(n / maxLabels));
  const bmax = bars ? Math.max(...bars.values, 1e-9) : 1;
  const bw = Math.max(3, Math.min(18, (plotW / Math.max(1, n)) * 0.5));
  const { idx, handlers } = useScrub(n, (px) => Math.round(((px - L) / plotW) * (n - 1)));

  // The primary line carries the fluid surface: the widest one, else the first.
  const primary = lines.reduce((best, l, i) => ((l.width ?? 2) > (lines[best].width ?? 2) ? i : best), 0);
  const segments = (vals: (number | null)[]) => {
    const segs: [number, number][][] = [];
    let cur: [number, number][] = [];
    vals.forEach((v, i) => { if (v === null || !Number.isFinite(v)) { if (cur.length) segs.push(cur); cur = []; } else cur.push([sx(i), sy(v)]); });
    if (cur.length) segs.push(cur);
    return segs;
  };
  const linePath = (vals: (number | null)[]) => segments(vals).map((s) => s.map(([px, py], j) => `${j ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join("")).join("");
  const areaPath = (vals: (number | null)[]) => segments(vals).map((s) => `M${s[0][0].toFixed(1)},${(T + plotH).toFixed(1)}` + s.map(([px, py]) => `L${px.toFixed(1)},${py.toFixed(1)}`).join("") + `L${s[s.length - 1][0].toFixed(1)},${(T + plotH).toFixed(1)}Z`).join("");
  const pLine = lines[primary];
  const pColor = pLine ? chartColor(pLine.color) : tok("ink2");
  const refY = refLine ? sy(refLine.value) : null;

  return (
    <figure className="min-w-0">
      <div ref={wrap} className="relative w-full">
        <svg
          width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block w-full touch-pan-y select-none overflow-visible" role="img" aria-labelledby={`${uid}-t`}
          tabIndex={0} {...handlers}
        >
          <title id={`${uid}-t`}>{lines.map((l) => l.label).join(", ")}{bars ? `, ${bars.label}` : ""}. Use the arrow keys to read values.</title>
          <defs>
            <linearGradient id={`${uid}-a`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={pColor} stopOpacity="0.22" />
              <stop offset="1" stopColor={pColor} stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${uid}-h`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={tok("heat")} stopOpacity="0.42" />
              <stop offset="1" stopColor={tok("heat")} stopOpacity="0.12" />
            </linearGradient>
            <clipPath id={`${uid}-r`}>
              <motion.rect x={L - 2} y={0} height={H} initial={{ width: calm ? plotW + 4 : 0 }} animate={{ width: show ? plotW + 4 : 0 }} transition={{ duration: calm ? 0 : 0.9, ease: [0.4, 0, 0.2, 1] }} />
            </clipPath>
            {refY !== null && <clipPath id={`${uid}-o`}><rect x={L} y={T - 4} width={plotW} height={Math.max(0, refY - T + 4)} /></clipPath>}
          </defs>

          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={sy(t)} y2={sy(t)} stroke={tok("line", 0.07)} />
              <text x={L - 8} y={sy(t) + 3.5} textAnchor="end" fontSize="11" fill={tok("faint")} className="num">{yFmt(t)}</text>
            </g>
          ))}

          {bars && bars.values.map((v, i) => {
            if (!(v > 0)) return null;
            const h = (v / bmax) * plotH * 0.55;
            return (
              <motion.rect
                key={i} x={sx(i) - bw / 2} width={bw} y={T + plotH - h} height={h} rx={Math.min(4, bw / 2)}
                fill={chartColor(bars.color)} opacity={idx === null || idx === i ? 0.85 : 0.4}
                style={{ originY: 1 }} initial={calm ? false : { scaleY: 0 }} animate={{ scaleY: show ? 1 : 0 }}
                transition={{ ...SPRING_FLUID, delay: calm ? 0 : 0.35 + Math.min(0.5, (i / Math.max(1, n)) * 0.5) }}
              />
            );
          })}

          <g clipPath={`url(#${uid}-r)`}>
            {pLine && <path d={areaPath(pLine.values)} fill={`url(#${uid}-a)`} />}
            {pLine && refY !== null && <path d={areaPath(pLine.values)} fill={`url(#${uid}-h)`} clipPath={`url(#${uid}-o)`} />}
            {lines.map((l, i) => (
              <path key={l.label} d={linePath(l.values)} fill="none" stroke={chartColor(l.color)} strokeWidth={l.width ?? 2} strokeDasharray={l.dashed ? "4 4" : undefined} strokeLinejoin="round" strokeLinecap="round" opacity={i === primary || !l.dashed ? 1 : 0.85} />
            ))}
            {pLine && refY !== null && <path d={linePath(pLine.values)} fill="none" stroke={tok("heat")} strokeWidth={pLine.width ?? 2} strokeLinejoin="round" strokeLinecap="round" clipPath={`url(#${uid}-o)`} />}
          </g>

          {refLine && refY !== null && (
            <g>
              <line x1={L} x2={W - R} y1={refY} y2={refY} stroke={tok("ink", 0.5)} strokeWidth="1" strokeDasharray="5 4" />
              <text x={L + 6} y={refY - 7} textAnchor="start" fontSize="11" fill={tok("ink2")} className="num">{refLine.label}</text>
            </g>
          )}

          {x.map((label, i) => {
            if (i % every !== 0) return null;
            const px = sx(i);
            return <text key={i} x={px} y={H - 8} textAnchor={px > W - R - 24 ? "end" : px < L + 16 ? "start" : "middle"} fontSize="11" fill={tok("faint")} className="num">{label}</text>;
          })}

          {idx !== null && (
            <g pointerEvents="none">
              <line x1={sx(idx)} x2={sx(idx)} y1={T} y2={T + plotH} stroke={tok("ink", 0.28)} strokeWidth="1" />
              {lines.map((l) => {
                const v = l.values[idx];
                return v === null || v === undefined || !Number.isFinite(v) ? null : <circle key={l.label} cx={sx(idx)} cy={sy(v)} r="3.5" fill={tok("raised")} stroke={chartColor(l.color)} strokeWidth="2" />;
              })}
            </g>
          )}
        </svg>
        {idx !== null && (
          <Readout x={sx(idx)} width={W}>
            <p className="num font-medium text-ink">{x[idx]}</p>
            {lines.map((l) => {
              const v = l.values[idx];
              return (
                <p key={l.label} className="mt-0.5 flex items-baseline justify-between gap-3">
                  <span className="truncate text-muted">{short(l.label)}</span>
                  <span className="num shrink-0 text-ink2" style={{ color: chartColor(l.color) }}>{v === null || v === undefined || !Number.isFinite(v) ? "n/a" : yFmt(v)}</span>
                </p>
              );
            })}
            {bars && (
              <p className="mt-0.5 flex items-baseline justify-between gap-3">
                <span className="text-muted">{bars.label}</span>
                <span className="num shrink-0" style={{ color: chartColor(bars.color) }}>{(barFmt ?? yFmt)(bars.values[idx] ?? 0)}</span>
              </p>
            )}
          </Readout>
        )}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] leading-4 text-muted">
        {lines.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-2">
            <svg width="18" height="6" aria-hidden><line x1="1" x2="17" y1="3" y2="3" stroke={chartColor(l.color)} strokeWidth={Math.min(2.4, l.width ?? 2)} strokeDasharray={l.dashed ? "3 3" : undefined} strokeLinecap="round" /></svg>
            {l.label}
          </span>
        ))}
        {refLine && (
          <span className="inline-flex items-center gap-2">
            <svg width="18" height="6" aria-hidden><line x1="1" x2="17" y1="3" y2="3" stroke={tok("ink", 0.5)} strokeDasharray="4 3" /></svg>
            {refLine.label}
          </span>
        )}
        {bars && <span className="inline-flex items-center gap-2"><i className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: chartColor(bars.color) }} />{bars.label}</span>}
      </figcaption>
    </figure>
  );
}

/** Thin horizontal level: a well track with a fill that springs to the value. */
export function HBar({ value, max, color = "#15181B" }: { value: number; max: number; color?: string }) {
  const pct = Math.max(1.5, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-well">
      <motion.div
        className="h-full rounded-full" style={{ background: chartColor(color) }}
        initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 140, damping: 22 }}
      />
    </div>
  );
}

/**
 * Vertical fluid columns with a zero floor. Used for the cohort backtest: months that
 * paid nothing show as a faint floor tick. `readLabels` (optional) gives the scrub
 * readout a fuller label than the axis label.
 */
export function Bars({ values, labels, color = tok("jade"), height = 150, fmt, readLabels }: { values: number[]; labels: string[]; color?: string; height?: number; fmt: (v: number) => string; readLabels?: string[] }) {
  const uid = safeId(useId());
  const wrap = useRef<HTMLDivElement>(null);
  const { width } = useSize(wrap, { width: 720, height });
  const inView = useInView(wrap, { once: true, amount: 0.25 });
  const calm = useCalm();
  const show = calm || inView;

  const W = Math.max(240, width), H = height, L = 48, R = 8, B = 22, T = 10;
  const n = values.length, plotW = W - L - R, plotH = H - T - B;
  const max = Math.max(...values, 1e-9);
  const slot = plotW / Math.max(1, n);
  const colW = Math.max(1, slot - (slot > 4 ? Math.min(2, slot * 0.25) : 0.5));
  const base = T + plotH;
  const { idx, handlers } = useScrub(n, (px) => Math.floor((px - L) / slot));
  const fill = chartColor(color);

  // Axis labels: show a label where it changes (years), at least 40 px apart.
  const shown: number[] = [];
  labels.forEach((l, i) => { if ((i === 0 || l !== labels[i - 1]) && (!shown.length || (i - shown[shown.length - 1]) * slot >= 40)) shown.push(i); });
  const stagger = Math.min(0.012, 0.6 / Math.max(1, n));

  return (
    <div ref={wrap} className="relative w-full min-w-0">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block w-full touch-pan-y select-none" role="img" aria-labelledby={`${uid}-t`} tabIndex={0} {...handlers}>
        <title id={`${uid}-t`}>Historical payouts by cohort. Use the arrow keys to read each period.</title>
        {[0.5, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={T + (1 - f) * plotH} y2={T + (1 - f) * plotH} stroke={tok("line", 0.07)} />
            <text x={L - 8} y={T + (1 - f) * plotH + 3.5} textAnchor="end" fontSize="11" fill={tok("faint")} className="num">{fmt(max * f)}</text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={base} y2={base} stroke={tok("line", 0.14)} />
        {values.map((v, i) => {
          const x0 = L + i * slot + (slot - colW) / 2;
          const on = idx === null || idx === i;
          if (!(v > 0)) return <line key={i} x1={x0} x2={x0 + colW} y1={base - 0.5} y2={base - 0.5} stroke={idx === i ? tok("ink", 0.6) : tok("line", 0.22)} />;
          const h = Math.max(1, (v / max) * plotH);
          return (
            <motion.rect
              key={i} x={x0} width={colW} y={base - h} height={h} rx={Math.min(3, colW / 2)}
              fill={fill} opacity={on ? 1 : 0.38} className="transition-opacity duration-100 ease-out"
              style={{ originY: 1 }}
              initial={calm ? false : { scaleY: 0 }} animate={{ scaleY: show ? 1 : 0 }}
              transition={{ ...SPRING_FLUID, delay: calm ? 0 : i * stagger }}
            />
          );
        })}
        {idx !== null && <rect x={L + idx * slot} y={T} width={slot} height={plotH} fill={tok("ink", 0.05)} pointerEvents="none" />}
        {shown.map((i) => <text key={i} x={L + i * slot} y={H - 6} fontSize="11" fill={tok("faint")} className="num">{labels[i]}</text>)}
      </svg>
      {idx !== null && (
        <Readout x={L + (idx + 0.5) * slot} width={W}>
          <p className="num font-medium text-ink">{readLabels?.[idx] ?? labels[idx]}</p>
          <p className={cx("num mt-0.5", values[idx] > 0 ? "text-jade" : "text-muted")} style={values[idx] > 0 ? { color: fill } : undefined}>{fmt(values[idx])}</p>
        </Readout>
      )}
    </div>
  );
}
