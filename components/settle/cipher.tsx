"use client";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { cx } from "../ui";
import { hash32, useLive } from "./motion";

/*
 * Cipher glyphs: each encrypted character is drawn as a 3 x 5 bit tile. The bits come
 * from a deterministic hash of (seed, position, tick), so the same amount always shows
 * the same pattern. Tiles morph slowly while on screen; they stop offscreen, when the
 * tab is hidden and under reduced motion.
 */

const COLS = 3, ROWS = 5, CELL = 2.2, GAP = 0.8;
const VW = COLS * CELL + (COLS - 1) * GAP, VH = ROWS * CELL + (ROWS - 1) * GAP;

function Tile({ bits, dim }: { bits: number; dim?: boolean }) {
  const rects = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const on = (bits >> (r * COLS + c)) & 1;
    rects.push(<rect key={r * COLS + c} x={c * (CELL + GAP)} y={r * (CELL + GAP)} width={CELL} height={CELL} rx="0.5" fill="currentColor" style={{ opacity: on ? (dim ? 0.55 : 0.92) : 0.13, transition: "opacity 220ms cubic-bezier(.2,.8,.2,1)" }} />);
  }
  return (
    <span aria-hidden className="inline-flex w-[1ch] items-center justify-center align-[-0.08em]">
      <svg viewBox={`0 0 ${VW} ${VH}`} className="h-[0.8em] w-auto overflow-visible">{rects}</svg>
    </span>
  );
}

/** Never all-on or all-off, so a tile always reads as a glyph. */
const bitsFor = (seed: string, i: number, tick: number) => {
  const b = hash32(seed, i, tick) & 0x7fff;
  return b === 0 || b === 0x7fff ? 0x2a5a : b;
};

/** Slowly morphing glyphs for an encrypted value. The length is fixed by the caller, not by the hidden amount. */
/** Static by default; pass `live` to the one instance per view that may morph (one moving thing at a time). */
export function CipherGlyphs({ length = 8, seed = "costshield", className, label = "Encrypted amount", dim, live: wantLive }: { length?: number; seed?: string; className?: string; label?: string; dim?: boolean; live?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const live = useLive(ref) && !!wantLive;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setTick((x) => x + 1), 420);
    return () => clearInterval(t);
  }, [live]);
  return (
    <span ref={ref} className={cx("num inline-flex items-center text-cipher", className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length }, (_, i) => {
        // Each tile changes on its own slow cadence (every 3 to 5 ticks), so the row never flashes at once.
        const period = 3 + (hash32(seed, i) % 3);
        const phase = hash32(seed, "p", i) % period;
        return <Tile key={i} bits={bitsFor(seed, i, Math.floor((tick + phase) / period))} dim={dim} />;
      })}
    </span>
  );
}

/**
 * A value that decodes left to right when `play` turns true: digits start as cipher tiles and
 * resolve one by one. Punctuation and units stay readable. Under reduced motion it shows the value at once.
 */
export function DecodeText({ text, play, seed = text, className, stepMs = 42, delayMs = 0 }: { text: string; play: boolean; seed?: string; className?: string; stepMs?: number; delayMs?: number }) {
  const reduce = useReducedMotion();
  const chars = text.split("");
  const digits = chars.map((c, i) => (/\d/.test(c) ? i : -1)).filter((i) => i >= 0);
  const [resolved, setResolved] = useState(0); // number of digits resolved
  const [flick, setFlick] = useState(0);
  const done = resolved >= digits.length;
  useEffect(() => {
    if (!play) { setResolved(0); return; }
    if (reduce) { setResolved(digits.length); return; }
    setResolved(0);
    let n = 0;
    let t: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      t = setInterval(() => {
        n += 1; setFlick((f) => f + 1);
        if (n % 2 === 0) setResolved((r) => Math.min(digits.length, r + 1));
        if (n > digits.length * 2 + 1) clearInterval(t);
      }, stepMs / 2);
    }, delayMs);
    return () => { clearTimeout(start); clearInterval(t); };
  }, [play, reduce, text]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = new Set(digits.slice(0, resolved));
  return (
    <span className={cx("num inline-flex items-baseline whitespace-nowrap", className)}>
      <span className="sr-only">{play ? text : "Encrypted amount"}</span>
      <span aria-hidden className="inline-flex items-baseline">
        {done && play ? text : chars.map((c, i) => /\d/.test(c)
          ? (shown.has(i) ? <span key={i}>{c}</span> : <span key={i} className="text-cipher"><Tile bits={bitsFor(seed, i, play ? flick + i : 0)} /></span>)
          : <span key={i} className={play ? undefined : "text-cipher/70"}>{c === " " ? "\u00a0" : c}</span>)}
      </span>
    </span>
  );
}
