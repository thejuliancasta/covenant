"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { motion, useSpring, useTransform } from "motion/react";
import padd2 from "@/lib/data/diesel_padd2_weekly.json";
import { Ev } from "@/components/ui";
import { SPRING_FLUID, SPRING_UI, tok, useCalm, useSize } from "./motion";

/*
 * The welcome screen's primary visual: the real EIA Midwest (PADD 2) weekly
 * retail diesel series as a fluid surface, an example strike (the November 2025
 * monthly average plus $0.50, the same rule the sample policy uses), and the cap
 * as a stack of $0.25 plates on the right. Scrubbing reads any week; the plates
 * that week's price pushes through light up.
 */

const STEP = 0.25;
const FROM = "2015-01-01";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const weekLabel = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`;

type Pt = [string, number];

/** A fluid column whose top springs to a target; the height never goes below zero when the spring overshoots. */
function Fluid({ x, width, top, bottom, fill, rx }: { x: number; width: number; top: number; bottom: number; fill: string; rx: number }) {
  const calm = useCalm();
  const t = useSpring(top, { stiffness: SPRING_FLUID.stiffness, damping: SPRING_FLUID.damping });
  useEffect(() => { if (calm) t.jump(top); else t.set(top); }, [top, calm, t]);
  const y = useTransform(t, (v) => Math.min(v, bottom));
  const height = useTransform(t, (v) => Math.max(0, bottom - v));
  return <motion.rect x={x} width={width} rx={rx} fill={fill} style={{ y, height }} />;
}

export function PressureHero() {
  const pts = useMemo(() => (padd2.points as Pt[]).filter(([d]) => d >= FROM), []);
  const strike = useMemo(() => {
    const nov = (padd2.points as Pt[]).filter(([d]) => d.startsWith("2025-11"));
    return nov.reduce((s, [, v]) => s + v, 0) / nov.length + 0.5;
  }, []);
  const box = useRef<HTMLDivElement>(null);
  const { width } = useSize(box, { width: 680, height: 0 });
  const W = Math.max(300, width);
  const H = Math.round(Math.min(380, Math.max(240, W * 0.66)));
  const narrow = W < 520;
  const gauge = narrow ? 30 : 40, gap = narrow ? 10 : 16;
  const L = 0, R = gauge + gap, T = 14, B = 26;
  const yMax = 7.25;
  const plotW = W - L - R, plotH = H - T - B;
  const sx = (i: number) => L + (i / (pts.length - 1)) * plotW;
  const sy = (v: number) => T + (1 - v / yMax) * plotH;
  const base = sy(0), strikeY = sy(strike);

  const line = useMemo(() => pts.map(([, v], i) => `${i ? "L" : "M"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(""), [pts, W, H]); // eslint-disable-line react-hooks/exhaustive-deps
  const area = `${line}L${sx(pts.length - 1).toFixed(1)},${base}L${sx(0)},${base}Z`;

  const years = useMemo(() => {
    const out: { i: number; y: string }[] = [];
    let last = "";
    pts.forEach(([d], i) => { const y = d.slice(0, 4); if (y !== last) { last = y; if (Number(y) % (narrow ? 3 : 2) === 0) out.push({ i, y }); } });
    return out;
  }, [pts, narrow]);

  const [idx, setIdx] = useState<number | null>(null);
  const at = idx ?? pts.length - 1;
  const [date, price] = pts[at];
  const over = price - strike;
  const crossed = over > 0 ? Math.floor(over / STEP) : 0;
  const plates = Math.floor((yMax - strike) / STEP);

  const pick = useCallback((e: PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    setIdx(Math.round(f * (pts.length - 1)));
  }, [pts.length]);
  const key = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 13 : 1;
    const cur = idx ?? pts.length - 1;
    const next = e.key === "ArrowLeft" ? cur - step : e.key === "ArrowRight" ? cur + step : e.key === "Home" ? 0 : e.key === "End" ? pts.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    setIdx(Math.max(0, Math.min(pts.length - 1, next)));
  };

  const id = useId().replace(/:/g, "");
  const live = idx !== null;
  const gx = W - gauge;

  return (
    <figure className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-[13px] leading-5 text-muted">{live ? `Week of ${weekLabel(date)}` : `Latest week, ${weekLabel(date)}`}</p>
          <p className="num mt-1 flex items-baseline gap-2 text-[30px] font-semibold leading-none tracking-[-0.04em] text-ink sm:text-[34px]">
            ${price.toFixed(3)}<span className="text-[13px] font-normal tracking-normal text-faint">per gallon</span>
          </p>
        </div>
        <div className="num text-left text-[13px] leading-5 sm:text-right" aria-live="polite">
          {over > 0
            ? <><p className="text-heat">${over.toFixed(3)} above the strike</p><p className="text-muted">{crossed} of {plates} plates pushed through</p></>
            : <><p className="text-ink2">${(-over).toFixed(3)} below the strike</p><p className="text-muted">No plate reached</p></>}
        </div>
      </div>

      <div ref={box} className="relative mt-4 w-full" style={{ height: H }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block overflow-visible" aria-hidden>
          <defs>
            <linearGradient id={`${id}-fluid`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={tok("ink2", 0.2)} />
              <stop offset="1" stopColor={tok("ink2", 0.03)} />
            </linearGradient>
            <linearGradient id={`${id}-heat`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={tok("heat", 0.62)} />
              <stop offset="1" stopColor={tok("heat", 0.28)} />
            </linearGradient>
            <clipPath id={`${id}-above`}><rect x={0} y={0} width={W} height={Math.max(0, strikeY)} /></clipPath>
          </defs>

          {[2, 4, 6].map((v) => (
            <g key={v}>
              <line x1={L} x2={L + plotW} y1={sy(v)} y2={sy(v)} stroke={tok("line", 0.07)} />
              {Math.abs(sy(v) - strikeY) > 18 && <text x={L + 2} y={sy(v) - 6} fontSize="11" fill={tok("faint")} className="num">${v}</text>}
            </g>
          ))}

          <motion.g initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={SPRING_FLUID} style={{ originY: 1 }}>
            <path d={area} fill={`url(#${id}-fluid)`} />
            <path d={line} fill="none" stroke={tok("ink2", 0.62)} strokeWidth="1.25" strokeLinejoin="round" />
          </motion.g>
          <motion.g clipPath={`url(#${id}-above)`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55, duration: 0.5 }}>
            <path d={area} fill={`url(#${id}-heat)`} />
            <path d={line} fill="none" stroke={tok("heat")} strokeWidth="1.5" strokeLinejoin="round" />
          </motion.g>

          <line x1={L} x2={W} y1={strikeY} y2={strikeY} stroke={tok("ink", 0.55)} strokeDasharray="5 4" />
          <text x={L + 2} y={strikeY - 7} fontSize="11.5" fill={tok("ink2")} className="num">Strike ${strike.toFixed(3)}</text>

          {years.map(({ i, y }) => <text key={y} x={sx(i)} y={H - 6} fontSize="11" fill={tok("faint")} textAnchor="middle" className="num">{y}</text>)}

          {/* The cap: one plate per $0.25 above the strike. The column is the scrubbed week's price. */}
          <g>
            <rect x={gx} y={T} width={gauge} height={plotH} rx="8" fill={tok("well", 0.5)} stroke={tok("line", 0.1)} />
            <Fluid x={gx + 4} width={gauge - 8} rx={5} fill={tok("ink2", 0.22)} top={Math.max(sy(price), strikeY)} bottom={base - 4} />
            <Fluid x={gx + 4} width={gauge - 8} rx={3} fill={tok("heat", 0.75)} top={Math.min(sy(price), strikeY)} bottom={strikeY} />
            {Array.from({ length: plates }, (_, k) => {
              const lo = strike + k * STEP, top = sy(lo + STEP) + 1, h = sy(lo) - sy(lo + STEP) - 2;
              const lit = price >= lo + STEP;
              return (
                <motion.rect key={k} x={gx + 2} y={top} width={gauge - 4} height={h} rx="3"
                  initial={false}
                  animate={{ fill: lit ? tok("heat", 0.3) : tok("panel", 0.9), stroke: lit ? tok("heat", 0.7) : tok("line", 0.14) }}
                  transition={{ ...SPRING_UI, delay: lit ? k * 0.018 : 0 }} strokeWidth="1" />
              );
            })}
            <line x1={gx - 4} x2={W} y1={strikeY} y2={strikeY} stroke={tok("ink", 0.55)} />
          </g>

          {live && (
            <g>
              <line x1={sx(at)} x2={sx(at)} y1={T} y2={base} stroke={tok("ink", 0.28)} />
              {over > 0 && <line x1={sx(at)} x2={sx(at)} y1={strikeY} y2={sy(price)} stroke={tok("heat")} strokeWidth="3" strokeLinecap="round" />}
              <circle cx={sx(at)} cy={sy(price)} r="4.5" fill={tok("bg")} stroke={over > 0 ? tok("heat") : tok("ink2")} strokeWidth="2" />
            </g>
          )}
          <rect
            x={L} y={T} width={plotW} height={plotH + B - 6} fill="transparent" className="cursor-crosshair touch-none outline-none"
            onPointerMove={pick} onPointerDown={pick} onPointerLeave={(e) => { if (e.pointerType === "mouse") setIdx(null); }}
          />
        </svg>
        <div
          tabIndex={0} role="slider" aria-label="Week" aria-valuemin={0} aria-valuemax={pts.length - 1} aria-valuenow={at}
          aria-valuetext={`${weekLabel(date)}: $${price.toFixed(3)} per gallon, ${over > 0 ? `$${over.toFixed(3)} above` : `$${(-over).toFixed(3)} below`} the strike`}
          onKeyDown={key} onBlur={() => setIdx(null)}
          className="absolute inset-0 rounded-control focus-visible:outline-offset-4" style={{ right: R, pointerEvents: "none" }}
        />
      </div>

      <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-[12px] leading-[1.45] text-faint">
        <span>EIA Midwest (PADD 2) retail diesel, weekly, 2015 to {pts[pts.length - 1][0].slice(0, 4)}<Ev e="V" /></span>
        <span>Strike: the November 2025 average plus $0.50. Plates are $0.25 steps.</span>
      </figcaption>
    </figure>
  );
}
