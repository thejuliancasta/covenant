"use client";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate } from "motion/react";
import { useCalm } from "./motion";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * A number that counts up to its real value when it mounts in view, and rolls
 * from the old value to the new one when it changes. It never shows a value
 * that is not real at rest: if it mounts off screen, it simply shows the value
 * (so a print, a full-page capture or a late scroll reads the true number).
 * Reduced motion: the final value, immediately.
 */
export function CountUp({ value, format = (v) => Math.round(v).toLocaleString("en-US"), from = 0, duration = 0.9, className }: {
  value: number; format?: (v: number) => string; from?: number; duration?: number; className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const calm = useCalm();
  const shown = useRef<number | null>(null);
  const [text, setText] = useState(() => format(value));
  useIsoLayoutEffect(() => {
    const el = ref.current;
    const settle = () => { shown.current = value; setText(format(value)); };
    if (calm || !Number.isFinite(value) || !el) return settle();
    let start: number;
    if (shown.current === null) {
      const r = el.getBoundingClientRect();
      const visible = r.bottom > 0 && r.top < window.innerHeight && document.visibilityState === "visible";
      if (!visible) return settle();
      start = from;
    } else start = shown.current;
    if (start === value) return settle();
    setText(format(start));
    const ctl = animate(start, value, {
      duration, ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => { shown.current = v; setText(format(v)); },
      onComplete: settle,
    });
    return () => ctl.stop();
    // format is usually an inline lambda; the value is what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, calm, duration]);
  return <span ref={ref} className={["num", className].filter(Boolean).join(" ")}>{text}</span>;
}

/**
 * Renders a sentence from the server and counts each standalone number in it up
 * to its real value (counts, percentages, ratios). Dates, identifiers and
 * numbers glued to letters are left as text.
 */
export function TickText({ text, duration = 0.7 }: { text: string; duration?: number }) {
  const parts = text.split(/(\d[\d,]*(?:\.\d+)?)/);
  return (
    <>
      {parts.map((p, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{p}</Fragment>;
        const before = parts[i - 1] ?? "", after = parts[i + 1] ?? "";
        const glued = /[A-Za-z0-9_\-/:]$/.test(before) || /^[A-Za-z0-9_\-/:]/.test(after) || /^\.\d/.test(after);
        const n = Number(p.replace(/,/g, ""));
        if (glued || !Number.isFinite(n)) return <Fragment key={i}>{p}</Fragment>;
        const decimals = p.includes(".") ? p.split(".")[1].length : 0;
        const commas = p.includes(",");
        return <CountUp key={i} value={n} duration={duration} format={(v) => commas ? Math.round(v).toLocaleString("en-US") : v.toFixed(decimals)} />;
      })}
    </>
  );
}
