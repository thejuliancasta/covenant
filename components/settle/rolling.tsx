"use client";
import { useEffect, useRef, useState } from "react";
import { animate, motion, useReducedMotion } from "motion/react";
import { cx } from "../ui";
import { UI_SPRING } from "./motion";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

function Digit({ d }: { d: number }) {
  const reduce = useReducedMotion();
  return (
    <span aria-hidden className="relative inline-block h-[1.1em] w-[1ch] overflow-hidden align-bottom leading-[1.1em]">
      <motion.span className="absolute inset-x-0 top-0 flex flex-col items-center" initial={false} animate={{ y: `${-d * 1.1}em` }} transition={reduce ? { duration: 0 } : UI_SPRING}>
        {DIGITS.map((n) => <span key={n} className="block h-[1.1em] leading-[1.1em]">{n}</span>)}
      </motion.span>
    </span>
  );
}

/** A formatted number whose digits roll to their new values. Columns are keyed from the right, so they persist as the number grows. */
export function Rolling({ text, className }: { text: string; className?: string }) {
  const chars = text.split("");
  return (
    <span className={cx("num inline-flex whitespace-nowrap leading-[1.1em]", className)}>
      <span className="sr-only">{text}</span>
      {chars.map((c, i) => {
        const key = chars.length - i;
        return /\d/.test(c) ? <Digit key={`d${key}`} d={Number(c)} /> : <span key={`c${key}${c}`} aria-hidden className="inline-block">{c}</span>;
      })}
    </span>
  );
}

/** Counts from `from` to `to` once `play` is true. Shows the final value under reduced motion. */
export function useCountUp(to: number, play: boolean, { from = 0, duration = 0.9 }: { from?: number; duration?: number } = {}) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(play && reduce ? to : from);
  const last = useRef(from);
  useEffect(() => {
    if (!play) { setV(from); last.current = from; return; }
    if (reduce) { setV(to); last.current = to; return; }
    const ctl = animate(last.current, to, { duration, ease: [0.2, 0.8, 0.2, 1], onUpdate: (x) => { setV(x); last.current = x; } });
    return () => ctl.stop();
  }, [to, play, reduce, from, duration]);
  return v;
}
