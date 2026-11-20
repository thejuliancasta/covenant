"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useSpring, useTransform } from "motion/react";
import { cx } from "../ui";
import { FLUID_SPRING, UI_SPRING, clamp01 } from "./motion";
import { Rolling } from "./rolling";

/*
 * Price-rise control. The track is a fuel column lying on its side: its level is the
 * price increase. Above the strike offset the cap is drawn as $0.25 plates; a plate
 * lights when the column has pushed all the way through it. The thumb is a plate.
 * A native range input sits on top, so keyboard, touch and screen readers work as usual.
 */

const INSET = 10; // half the thumb hit width; the track spans thumb centres exactly
const at = (f: number) => `calc(${INSET}px + (100% - ${2 * INSET}px) * ${f})`;

export const PLATE = 0.25;

export function plateBounds(offset: number, max: number) {
  const out: { lo: number; hi: number }[] = [];
  for (let lo = offset; lo < max - 1e-9; lo += PLATE) out.push({ lo, hi: Math.min(max, lo + PLATE) });
  return out;
}

function Plate({ lo, hi, max, state }: { lo: number; hi: number; max: number; state: "idle" | "partial" | "lit" }) {
  const w = (hi - lo) / max;
  return (
    <div aria-hidden className="absolute bottom-[7px] top-[7px] px-[2px]" style={{ left: `${(lo / max) * 100}%`, width: `${w * 100}%` }}>
      <div className={cx("flex h-full items-center justify-center rounded-[6px] border transition-[border-color,background-color] duration-200",
        state === "lit" ? "border-jade/70 bg-jade/[0.2]" : state === "partial" ? "border-heat/50 bg-transparent" : "border-line/10 bg-raised/40")}>
        {state === "lit" && (
          <svg viewBox="0 0 14 14" width="12" height="12" className="text-jade">
            <path d="M2.5 7.4 5.6 10.3 11.5 3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  );
}

export function PriceRiseControl({ value, onChange, offset, max = 3, step = 0.05, label, valueText, className }: {
  value: number; onChange: (v: number) => void; offset: number; max?: number; step?: number; label: string; valueText: string; className?: string;
}) {
  const reduce = useReducedMotion();
  const plates = plateBounds(offset, max);
  const mv = useSpring(value, FLUID_SPRING);
  useEffect(() => { if (reduce) mv.jump(value); else mv.set(value); }, [value, reduce, mv]);
  const fluidW = useTransform(mv, (v) => `${clamp01(v / max) * 100}%`);
  // Plate states follow the fluid, not the pointer, so a plate lights when the column reaches it.
  const levelOf = (v: number) => {
    const lit = plates.filter((p) => v >= p.hi - 1e-6).length;
    const partial = plates.findIndex((p) => v > p.lo + 1e-6 && v < p.hi - 1e-6);
    return `${lit}:${partial}`;
  };
  const [level, setLevel] = useState(() => levelOf(value));
  const levelRef = useRef(level);
  useMotionValueEvent(mv, "change", (v) => { const l = levelOf(v); if (l !== levelRef.current) { levelRef.current = l; setLevel(l); } });
  useEffect(() => { const l = levelOf(mv.get()); levelRef.current = l; setLevel(l); }, [offset, max]); // eslint-disable-line react-hooks/exhaustive-deps
  const [litN, partialI] = level.split(":").map(Number);
  const [drag, setDrag] = useState(false);
  const f = clamp01(value / max);
  const ticks = Array.from({ length: Math.round(max / 0.5) + 1 }, (_, i) => i * 0.5);
  const absorbW = offset / max;

  return (
    <div className={cx("select-none", className)}>
      {/* Zone labels above the column */}
      <div aria-hidden className="relative h-5 text-[12px]">
        <div className="absolute inset-y-0" style={{ left: `${INSET}px`, right: `${INSET}px` }}>
          {absorbW > 0.11 && <span className="absolute top-0 hidden -translate-x-1/2 whitespace-nowrap text-faint sm:inline" style={{ left: `${(absorbW / 2) * 100}%` }}>You cover this</span>}
          <span className="absolute top-0 whitespace-nowrap pl-1 text-jade" style={{ left: `${absorbW * 100}%` }}>Paid back in {Math.round(PLATE * 100)}-cent steps</span>
        </div>
      </div>
      <div className="relative mt-1.5 h-[72px]">
        <div aria-hidden className="absolute inset-y-[8px]" style={{ left: `${INSET}px`, right: `${INSET}px` }}>
          <div className="absolute inset-0 overflow-hidden rounded-control border border-line/8 bg-sunken/60">
            {/* the fuel column */}
            <motion.div className="absolute inset-y-0 left-0" style={{ width: fluidW, background: "linear-gradient(90deg, rgb(var(--heat) / 0.10), rgb(var(--heat) / 0.36))" }}>
              <div className="absolute inset-y-0 right-0 w-[2px] bg-heat/80" />
            </motion.div>
            {/* strike */}
            <div className="absolute inset-y-0 w-px bg-jade/50" style={{ left: `${absorbW * 100}%` }} />
          </div>
          {plates.map((p, i) => <Plate key={`${offset}-${i}`} lo={p.lo} hi={p.hi} max={max} state={i < litN ? "lit" : i === partialI ? "partial" : "idle"} />)}
        </div>
        <input type="range" min={0} max={max} step={step} value={value} aria-label={label} aria-valuetext={valueText}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerDown={() => setDrag(true)} onPointerUp={() => setDrag(false)} onPointerCancel={() => setDrag(false)} onBlur={() => setDrag(false)}
          className="peer absolute inset-0 z-10 h-full w-full cursor-grab appearance-none bg-transparent opacity-0 active:cursor-grabbing [&::-moz-range-thumb]:h-[72px] [&::-moz-range-thumb]:w-5 [&::-webkit-slider-thumb]:h-[72px] [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none" />
        {/* the thumb: a plate you push */}
        <motion.div aria-hidden className={cx("pointer-events-none absolute top-0 h-[72px] w-[14px] rounded-[6px] border transition-[background-color,border-color,box-shadow] duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-jade peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-raised",
          drag ? "border-jade bg-ink" : "border-line/14 bg-ink2")} style={{ left: at(f), x: "-50%" }}
          animate={{ scaleY: drag ? 1.05 : 1 }} transition={UI_SPRING}>
          <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col gap-[3px]">
            {[0, 1, 2].map((k) => <span key={k} className="block h-px w-[6px] rounded-full bg-bg/50" />)}
          </span>
        </motion.div>
      </div>
      <div aria-hidden className="relative mt-2 h-4 text-[11.5px] text-faint">
        {ticks.map((t, i) => (
          <span key={t} className={cx("num absolute top-0 whitespace-nowrap", i === 0 ? "" : i === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2", t % 1 !== 0 && "hidden sm:inline")} style={{ left: i === 0 ? 0 : i === ticks.length - 1 ? "100%" : at(t / max) }}>
            {t === 0 ? "$0" : `+$${t.toFixed(2)}`}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A quiet range for secondary inputs: native input, custom track, rolling value. */
export function FineRange({ label, value, min, max, step, onChange, fmt, hint }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string; hint?: ReactNode }) {
  const id = useId();
  const f = clamp01((value - min) / (max - min));
  const [drag, setDrag] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <label htmlFor={id} className="text-muted">{label}</label>
        <span className="num font-medium text-ink">{fmt(value)}</span>
      </div>
      <div className="relative mt-1 h-10">
        <div aria-hidden className="absolute top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-well" style={{ left: "9px", right: "9px" }}>
          <div className="h-full rounded-full bg-ink/30" style={{ width: `${f * 100}%` }} />
        </div>
        <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
          onPointerDown={() => setDrag(true)} onPointerUp={() => setDrag(false)} onPointerCancel={() => setDrag(false)} onBlur={() => setDrag(false)}
          className="peer absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0 [&::-moz-range-thumb]:h-10 [&::-moz-range-thumb]:w-[18px] [&::-webkit-slider-thumb]:h-10 [&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:appearance-none" />
        <motion.span aria-hidden className={cx("pointer-events-none absolute top-1/2 -ml-[9px] -mt-[9px] h-[18px] w-[18px] rounded-full border-2 transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-jade peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-raised",
          drag ? "border-jade bg-ink" : "border-raised bg-ink2")} style={{ left: `calc(9px + (100% - 18px) * ${f})` }} animate={{ scale: drag ? 1.15 : 1 }} transition={UI_SPRING} />
      </div>
      {hint && <p className="text-xs text-faint">{hint}</p>}
    </div>
  );
}

/** Segmented choice with a sliding indicator. */
export function Segmented<T extends string | number>({ label, options, value, onChange, fmt }: { label: string; options: T[]; value: T; onChange: (v: T) => void; fmt: (v: T) => string }) {
  const id = useId();
  return (
    <div>
      <p id={id} className="text-[13px] text-muted">{label}</p>
      <div role="radiogroup" aria-labelledby={id} className="-mx-1 mt-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => {
          const on = o === value;
          return (
            <button key={String(o)} type="button" role="radio" aria-checked={on} onClick={() => onChange(o)}
              className={cx("num relative h-10 rounded-control text-[14px] font-medium transition-[color,transform] duration-150 active:scale-[0.98]", on ? "text-ink" : "text-muted hover:text-ink2")}>
              {on && <motion.span layoutId={`${id}-ind`} aria-hidden className="absolute bottom-1 left-1/2 -ml-2 h-[2px] w-4 rounded-full bg-jade" transition={UI_SPRING} />}
              <span className="relative">{fmt(o)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A preset: a text button; the selected one carries the accent mark. Presses to 0.98. */
export function PresetChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={cx("num relative h-10 rounded-control px-3 text-[13.5px] font-medium transition-[color,transform] duration-150 active:scale-[0.98]",
        on ? "text-ink" : "text-muted hover:text-ink2")}>
      {on && <motion.span layoutId="preset-ind" aria-hidden className="absolute bottom-1 left-1/2 -ml-2 h-[2px] w-4 rounded-full bg-jade" transition={UI_SPRING} />}
      {children}
    </button>
  );
}
