"use client";
import { useId, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import padd2 from "@/lib/data/diesel_padd2_weekly.json";
import usDiesel from "@/lib/data/diesel_us_weekly.json";
import brent from "@/lib/data/brent_monthly.json";
import ulsd from "@/lib/data/ulsd_nyh_monthly.json";
import { useCalm } from "./motion";

/*
 * Pressure strata: the full-bleed background artwork. Dozens of offset copies of a
 * real EIA price series, each one smoothed a little more than the one above it,
 * stack into a terrain of contour lines. Wherever a layer rises above its strike
 * line it burns ember, fading with depth. Static (no continuous motion), so it
 * costs nothing when the tab is hidden; under reduced motion it simply appears.
 */

type Pt = [string, number];
export type StrataVariant = "hero" | "connect" | "analyzing" | "overview" | "protection" | "simulate" | "payout" | "judge";

interface Preset {
  points: Pt[]; from: string; strength: number; layers: number;
  /** Strike as a price, or a quantile of the cropped series. */
  strike: number | { q: number };
  /** Vertical placement in a 1000-unit viewBox: top of the front layer, amplitude, gap between layers. */
  top: number; amp: number; gap: number;
}

const novStrike = (() => {
  const nov = (padd2.points as Pt[]).filter(([d]) => d.startsWith("2025-11"));
  return nov.reduce((s, [, v]) => s + v, 0) / nov.length + 0.5;
})();

const PRESETS: Record<StrataVariant, Preset> = {
  hero: { points: usDiesel.points as Pt[], from: "1994-01", strength: 1, layers: 42, strike: novStrike, top: 470, amp: 360, gap: 10 },
  connect: { points: usDiesel.points as Pt[], from: "1994-01", strength: 0.55, layers: 30, strike: { q: 0.86 }, top: 470, amp: 260, gap: 12 },
  analyzing: { points: brent.points as Pt[], from: "1999-01", strength: 0.55, layers: 30, strike: { q: 0.86 }, top: 440, amp: 280, gap: 12 },
  overview: { points: padd2.points as Pt[], from: "2005-01", strength: 0.5, layers: 30, strike: { q: 0.88 }, top: 470, amp: 260, gap: 12 },
  protection: { points: ulsd.points as Pt[], from: "2006-01", strength: 0.5, layers: 30, strike: { q: 0.86 }, top: 470, amp: 260, gap: 12 },
  simulate: { points: padd2.points as Pt[], from: "2024-06", strength: 0.5, layers: 30, strike: novStrike, top: 430, amp: 300, gap: 12 },
  payout: { points: usDiesel.points as Pt[], from: "2021-01", strength: 0.5, layers: 30, strike: { q: 0.8 }, top: 450, amp: 280, gap: 12 },
  judge: { points: usDiesel.points as Pt[], from: "2008-01", strength: 0.38, layers: 26, strike: { q: 0.9 }, top: 500, amp: 240, gap: 12 },
};

const N = 220;

function buildLayers(p: Preset) {
  const pts = p.points.filter(([d]) => d >= p.from);
  // Bucket into N columns (mean of each bucket) so every variant has the same density.
  const vals = Array.from({ length: N }, (_, i) => {
    const a = Math.floor((i / N) * pts.length), b = Math.max(a + 1, Math.floor(((i + 1) / N) * pts.length));
    let s = 0; for (let j = a; j < b; j++) s += pts[j][1];
    return s / (b - a);
  });
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const sorted = [...vals].sort((x, y) => x - y);
  const strike = typeof p.strike === "number" ? p.strike : sorted[Math.floor(p.strike.q * (sorted.length - 1))];
  const norm = (v: number) => (v - lo) / (hi - lo || 1);
  const smooth = (src: number[], w: number) => {
    if (w < 1) return src;
    return src.map((_, i) => { let s = 0, n = 0; for (let j = Math.max(0, i - w); j <= Math.min(src.length - 1, i + w); j++) { s += src[j]; n++; } return s / n; });
  };
  const layers = Array.from({ length: p.layers }, (_, k) => {
    const series = smooth(vals, Math.round(k * 0.55));
    const amp = p.amp * (1 - k * 0.011);
    const base = p.top + k * p.gap;
    const y = (v: number) => base + (1 - norm(v)) * amp;
    const d = series.map((v, i) => `${i ? "L" : "M"}${((i / (N - 1)) * 1000).toFixed(1)},${y(v).toFixed(1)}`).join("");
    const depth = k / (p.layers - 1);
    return { d, strikeY: y(strike), alpha: p.strength * (0.05 + 0.25 * Math.pow(1 - depth, 1.6)), ember: p.strength * (0.12 + 0.75 * Math.pow(1 - depth, 2.2)) };
  });
  const front = layers[0];
  return { layers, area: `${front.d}L1000,1000L0,1000Z`, strikeY: front.strikeY };
}

function Field({ variant }: { variant: StrataVariant }) {
  const id = useId().replace(/:/g, "");
  const calm = useCalm();
  const { layers, area, strikeY } = useMemo(() => buildLayers(PRESETS[variant]), [variant]);
  const hero = variant === "hero";
  return (
    <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
      <defs>
        {layers.map((l, k) => (
          <linearGradient key={k} id={`${id}-g${k}`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="1000">
            <stop offset={l.strikeY / 1000} stopColor={`rgb(var(--jade) / ${Math.min(1, l.ember)})`} />
            <stop offset={l.strikeY / 1000} stopColor={`rgb(var(--ink) / ${l.alpha})`} />
          </linearGradient>
        ))}
        <linearGradient id={`${id}-burn`} gradientUnits="userSpaceOnUse" x1="0" y1={strikeY - 260} x2="0" y2={strikeY}>
          <stop offset="0" stopColor={`rgb(var(--jade) / ${hero ? 0.2 : 0.1})`} />
          <stop offset="1" stopColor="rgb(var(--jade) / 0)" />
        </linearGradient>
        <clipPath id={`${id}-above`}><rect x="0" y="0" width="1000" height={Math.max(0, strikeY)} /></clipPath>
        <filter id={`${id}-glow`} x="-5%" y="-20%" width="110%" height="140%"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
      <path d={area} fill={`url(#${id}-burn)`} clipPath={`url(#${id}-above)`} />
      <g clipPath={`url(#${id}-above)`} filter={`url(#${id}-glow)`} opacity={hero ? 0.9 : 0.6}>
        {layers.slice(0, 4).map((l, k) => <path key={k} d={l.d} fill="none" stroke={`rgb(var(--jade) / ${0.5 - k * 0.1})`} strokeWidth="3" vectorEffect="non-scaling-stroke" />)}
      </g>
      {layers.map((l, k) => (
        <motion.path
          key={k} d={l.d} fill="none" stroke={`url(#${id}-g${k})`} strokeWidth={k === 0 ? 1.5 : 1} vectorEffect="non-scaling-stroke" strokeLinejoin="round"
          initial={hero && !calm ? { pathLength: 0 } : false} animate={{ pathLength: 1 }}
          transition={{ duration: 1.6, delay: k * 0.025, ease: [0.2, 0.8, 0.2, 1] }}
        />
      ))}
    </svg>
  );
}

/** Full-bleed background artwork. Mount once; change `variant` per screen and it cross-fades. */
export function Strata({ variant }: { variant: StrataVariant }) {
  const hero = variant === "hero";
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{
        maskImage: hero ? "linear-gradient(to bottom, transparent 4%, black 30%, black 100%)" : "linear-gradient(to bottom, transparent 10%, black 42%, black 88%, transparent 100%)",
        WebkitMaskImage: hero ? "linear-gradient(to bottom, transparent 4%, black 30%, black 100%)" : "linear-gradient(to bottom, transparent 10%, black 42%, black 88%, transparent 100%)",
      }}
    >
      <AnimatePresence initial={false}>
        <motion.div key={variant} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}>
          <Field variant={variant} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
