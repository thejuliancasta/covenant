"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion } from "motion/react";
import type { CategorySummary } from "@/lib/engine/exposure";
import { int, pct, usdK } from "@/lib/format";
import { Tag, cx } from "@/components/ui";
import { CountUp } from "./count";
import { SPRING_FLUID, SPRING_UI, tok, useActive, useCalm, useSize } from "./motion";

/*
 * Exposure columns (docs/UI_DIRECTION.md, inventory item 4).
 * Each spending category is a fluid column: fill = spend relative to the largest
 * category (the exact share is printed beside it), the surface ripple's amplitude
 * = month-to-month swing (coefficient of variation), heat = follows a market price.
 * The ripple drifts only while on screen, the tab is visible and motion is allowed.
 */

const DESK_H = 174; // interior height of a desktop tube, px (176 minus the border)
const DESK_W = 60; // viewBox width; stretched to the tube, amplitude is vertical so it stays in px
const DESK_TOP = 16; // headroom above a full column so the largest ripple fits
const MOB_H = 26; // interior height of a mobile tube, px
const MOB_RIGHT = 14; // room at the right end for the ripple
const SPEED = 1.35; // ripple drift, radians per second
const CALM_PHASE = 0.9;

const amplitude = (cv: number) => Math.min(12, Math.max(0.6, (Number.isFinite(cv) ? cv : 0) * 26));
const ripple = (t: number, k1: number, k2: number, phase: number, seed: number) =>
  0.72 * Math.sin(k1 * t + phase + seed) + 0.28 * Math.sin(k2 * t - 1.7 * phase + seed * 2.1);

/** Vertical column: surface at the top of the fill, ripple along x. */
function columnPaths(level: number, amp: number, phase: number, seed: number) {
  const ys = DESK_H - Math.max(0, level) * (DESK_H - DESK_TOP);
  const a = Math.min(amp, Math.max(0.6, (DESK_H - ys) * 0.9));
  const k1 = (2 * Math.PI) / (DESK_W * 0.85), k2 = (2 * Math.PI) / (DESK_W * 0.43);
  let line = "";
  for (let s = 0; s <= 24; s++) {
    const x = (s / 24) * DESK_W;
    const y = ys + a * ripple(x, k1, k2, phase, seed);
    line += `${s ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
  }
  return { line, fill: `${line}L${DESK_W},${DESK_H}L0,${DESK_H}Z` };
}

/** Horizontal tube: surface at the right end of the fill, ripple along y. */
function tubePaths(level: number, amp: number, phase: number, seed: number, width: number) {
  const xs = Math.max(0, level) * Math.max(10, width - MOB_RIGHT);
  const a = Math.min(amp, Math.max(0.6, xs * 0.9));
  const k1 = (2 * Math.PI) / (MOB_H * 1.15), k2 = (2 * Math.PI) / (MOB_H * 0.55);
  let line = "";
  for (let s = 0; s <= 12; s++) {
    const y = (s / 12) * MOB_H;
    const x = xs + a * ripple(y, k1, k2, phase, seed);
    line += `${s ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
  }
  return { line, fill: `M0,0L${line.slice(1)}L0,${MOB_H}Z` };
}

/**
 * Drives fluid levels (spring rise on first view) and the ripple phase (rAF while
 * active). Writes straight to the DOM through `render` so nothing re-renders per frame.
 */
function useFluid(targets: number[], active: boolean, calm: boolean, render: (levels: number[], phase: number) => void) {
  const levels = useRef<number[]>(targets.map(() => 0));
  const phase = useRef(CALM_PHASE);
  const looping = useRef(false);
  const renderRef = useRef(render);
  renderRef.current = render;
  const draw = () => renderRef.current(levels.current, phase.current);
  const [seen, setSeen] = useState(false);
  const key = targets.map((t) => t.toFixed(4)).join(",");

  useEffect(() => { if (active) setSeen(true); }, [active]);

  // Redraw after every React render (first paint, resize, selection changes).
  useEffect(() => { draw(); });

  useEffect(() => {
    levels.current = targets.map((_, i) => levels.current[i] ?? 0);
    if (calm) { levels.current = targets.slice(); draw(); return; }
    if (!seen) return;
    const ctls = targets.map((t, i) => animate(levels.current[i], t, {
      ...SPRING_FLUID, delay: i * 0.06,
      onUpdate: (v) => { levels.current[i] = v; if (!looping.current) draw(); },
    }));
    return () => ctls.forEach((c) => c.stop());
    // targets are tracked through `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, seen, calm]);

  useEffect(() => {
    if (!active || calm) { if (calm) { phase.current = CALM_PHASE; draw(); } return; }
    let raf = 0, last = performance.now();
    looping.current = true;
    const tick = (now: number) => {
      phase.current += ((now - last) / 1000) * SPEED;
      last = now;
      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { looping.current = false; cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, calm]);
}

const fillColor = (m: boolean) => (m ? tok("heat", 0.5) : tok("ink2", 0.2));
const lineColor = (m: boolean) => (m ? tok("heat", 0.95) : tok("ink2", 0.42));

function Detail({ c, market, compact }: { c: CategorySummary; market: boolean; compact?: boolean }) {
  const facts: [string, string][] = [
    ["Spend, last 12 months", usdK(c.ttm)],
    ["Share of expenses", pct(c.shareOfExpenses)],
    ["Month-to-month swing", `±${pct(c.cv)}`],
    ["Largest monthly rise", pct(c.maxMoM)],
    ["Ledger lines, last 12 months", int(c.lines)],
  ];
  return (
    <div className={cx(compact ? "py-3" : "pt-6")}>
      {!compact && (
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="text-[15px] font-medium leading-6 text-ink">{c.label}</p>
          {market ? <Tag tone="warn">market price</Tag> : <span className="text-[12px] text-faint">Does not follow a market price</span>}
        </div>
      )}
      {compact && market && <div className="mb-2.5"><Tag tone="warn">market price</Tag></div>}
      <dl className={cx("grid gap-x-6 gap-y-3", compact ? "grid-cols-2" : "mt-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5")}>
        {facts.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[12px] leading-4 text-faint">{k}</dt>
            <dd className="num mt-1 text-[15px] font-medium leading-5 text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const describe = (c: CategorySummary, market: boolean) =>
  `${c.label}: ${usdK(c.ttm)} in the last 12 months, ${pct(c.shareOfExpenses)} of expenses, month-to-month swing ±${pct(c.cv)}${market ? ", follows a market price" : ""}`;

function DesktopColumns({ categories, market, topTtm }: { categories: CategorySummary[]; market: Set<string>; topTtm: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const active = useActive(ref);
  const calm = useCalm();
  const fills = useRef<(SVGPathElement | null)[]>([]);
  const lines = useRef<(SVGPathElement | null)[]>([]);
  const firstMarket = categories.findIndex((c) => market.has(c.category));
  const [sel, setSel] = useState(firstMarket >= 0 ? firstMarket : 0);
  const targets = categories.map((c) => (topTtm > 0 ? Math.min(1, Math.max(0, c.ttm / topTtm)) : 0));
  const amps = categories.map((c) => amplitude(c.cv));

  useFluid(targets, active, calm, (levels, phase) => {
    for (let i = 0; i < categories.length; i++) {
      const p = columnPaths(levels[i] ?? 0, amps[i], phase, i * 1.37);
      fills.current[i]?.setAttribute("d", p.fill);
      lines.current[i]?.setAttribute("d", p.line);
    }
  });

  const s = categories[Math.min(sel, categories.length - 1)];
  return (
    <div ref={ref} className="hidden md:block">
      <div className="grid gap-2 pt-1" style={{ gridTemplateColumns: `repeat(${categories.length}, minmax(0, 1fr))` }}>
        {categories.map((c, i) => {
          const m = market.has(c.category), on = i === sel;
          return (
            <motion.button
              key={c.category} type="button" aria-pressed={on} aria-label={describe(c, m)}
              onMouseEnter={() => setSel(i)} onFocus={() => setSel(i)} onClick={() => setSel(i)}
              initial={false} animate={{ y: on ? -4 : 0 }} transition={SPRING_UI}
              className="group flex min-w-0 flex-col items-stretch rounded-control pb-1 text-center"
            >
              <span className={cx(
                "relative block h-[176px] overflow-hidden rounded-[10px] border bg-sunken transition-[border-color] duration-150 ease-out",
                on ? "border-line/20" : "border-line/10 group-hover:border-line/[0.16]",
              )}>
                <svg aria-hidden width="100%" height={DESK_H} viewBox={`0 0 ${DESK_W} ${DESK_H}`} preserveAspectRatio="none" className="block">
                  <path ref={(el) => { fills.current[i] = el; }} fill={fillColor(m)} />
                  <path ref={(el) => { lines.current[i] = el; }} fill="none" stroke={lineColor(m)} strokeWidth="1.25" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                </svg>
              </span>
              <CountUp value={c.shareOfExpenses * 100} format={(v) => `${v.toFixed(0)}%`} className={cx("mt-2.5 text-[13px] font-medium leading-5 transition-colors duration-150", on ? "text-ink" : "text-ink2")} />
              <span className={cx("mt-0.5 text-[13px] leading-[1.3] transition-colors duration-150", on ? "text-ink2" : "text-muted")}>{c.label}</span>
            </motion.button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] leading-4 text-faint">
        <span className="inline-flex items-center gap-2"><i aria-hidden className="inline-block h-2.5 w-2.5 rounded-[3px] border border-heat/90 bg-heat/50" />Follows a market price</span>
        <span className="inline-flex items-center gap-2"><i aria-hidden className="inline-block h-2.5 w-2.5 rounded-[3px] border border-ink2/40 bg-ink2/20" />Does not</span>
        <span className="inline-flex items-center gap-2">
          <svg aria-hidden width="18" height="10" viewBox="0 0 18 10"><path d="M1 5c2-3.2 4-3.2 6 0s4 3.2 6 0 3-2.4 4-1.6" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
          Wave height shows the month-to-month swing
        </span>
      </div>
      <motion.div key={s.category} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.14, ease: [0.2, 0.8, 0.2, 1] }} className="mt-4" aria-live="polite">
        <Detail c={s} market={market.has(s.category)} />
      </motion.div>
    </div>
  );
}

function MobileTubes({ categories, market, topTtm }: { categories: CategorySummary[]; market: Set<string>; topTtm: number }) {
  const ref = useRef<HTMLUListElement>(null);
  const tubeRef = useRef<HTMLSpanElement>(null);
  const active = useActive(ref);
  const calm = useCalm();
  const { width } = useSize(tubeRef, { width: 340, height: MOB_H });
  const w = Math.max(40, Math.round(width));
  const fills = useRef<(SVGPathElement | null)[]>([]);
  const lines = useRef<(SVGPathElement | null)[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const targets = categories.map((c) => (topTtm > 0 ? Math.min(1, Math.max(0, c.ttm / topTtm)) : 0));
  const amps = categories.map((c) => amplitude(c.cv));

  useFluid(targets, active, calm, (levels, phase) => {
    for (let i = 0; i < categories.length; i++) {
      const p = tubePaths(levels[i] ?? 0, amps[i], phase, i * 1.37, w);
      fills.current[i]?.setAttribute("d", p.fill);
      lines.current[i]?.setAttribute("d", p.line);
    }
  });

  return (
    <ul ref={ref} className="space-y-1 md:hidden">
      {categories.map((c, i) => {
        const m = market.has(c.category), on = open === i;
        return (
          <li key={c.category}>
            <button
              type="button" aria-expanded={on} aria-label={describe(c, m)} onClick={() => setOpen(on ? null : i)}
              className={cx("-mx-2.5 block min-h-11 w-[calc(100%+20px)] rounded-control px-2.5 py-2 text-left transition-colors duration-150 ease-out active:bg-well/60", on ? "bg-well/40" : "hover:bg-well/30")}
            >
              <span className="flex items-baseline justify-between gap-3 text-[13px] leading-5">
                <span className={cx("min-w-0", on ? "text-ink" : "text-ink2")}>{c.label}</span>
                <span className="num shrink-0 text-muted">{usdK(c.ttm)}, {pct(c.shareOfExpenses)}, ±{pct(c.cv)}</span>
              </span>
              <span ref={i === 0 ? tubeRef : undefined} className={cx("mt-1.5 block h-7 overflow-hidden rounded-[8px] border bg-sunken transition-[border-color] duration-150", on ? "border-line/20" : "border-line/10")}>
                <svg aria-hidden width="100%" height={MOB_H} viewBox={`0 0 ${w} ${MOB_H}`} preserveAspectRatio="none" className="block">
                  <path ref={(el) => { fills.current[i] = el; }} fill={fillColor(m)} />
                  <path ref={(el) => { lines.current[i] = el; }} fill="none" stroke={lineColor(m)} strokeWidth="1.25" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                </svg>
              </span>
            </button>
            <AnimatePresence initial={false}>
              {on && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }} className="overflow-hidden"
                >
                  <div className="pb-2 pt-1.5"><Detail c={c} market={m} compact /></div>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
      <li className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 text-[12px] leading-4 text-faint">
        <span className="inline-flex items-center gap-2"><i aria-hidden className="inline-block h-2.5 w-2.5 rounded-[3px] border border-heat/90 bg-heat/50" />Follows a market price</span>
        <span className="inline-flex items-center gap-2"><i aria-hidden className="inline-block h-2.5 w-2.5 rounded-[3px] border border-ink2/40 bg-ink2/20" />Does not</span>
        <span>Ripple shows the month-to-month swing</span>
      </li>
    </ul>
  );
}

/** "Where the money goes": one fluid column per category. Desktop columns and mobile tubes are separate compositions. */
export function ExposureColumns({ categories, market, topTtm }: { categories: CategorySummary[]; market: Set<string>; topTtm: number }) {
  if (!categories.length) return null;
  return (
    <>
      <DesktopColumns categories={categories} market={market} topTtm={topTtm} />
      <MobileTubes categories={categories} market={market} topTtm={topTtm} />
    </>
  );
}
