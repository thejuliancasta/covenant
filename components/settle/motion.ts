"use client";
import { useEffect, useState, type RefObject } from "react";
import { useReducedMotion } from "motion/react";

/** Springs from docs/UI_DIRECTION.md: controls, and fluid surfaces. */
export const UI_SPRING = { type: "spring", stiffness: 380, damping: 32 } as const;
export const FLUID_SPRING = { type: "spring", stiffness: 140, damping: 18 } as const;
export const STAGGER = 0.08;

/** True while the element is on screen, the tab is visible and motion is allowed. Continuous motion runs only then. */
export function useLive(ref: RefObject<Element | null>) {
  const reduce = useReducedMotion();
  const [inView, setInView] = useState(false);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: "48px" });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  useEffect(() => {
    const on = () => setVisible(document.visibilityState === "visible");
    on();
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return inView && visible && !reduce;
}

/** Deterministic 32-bit hash, so cipher glyphs are the same on every render and every machine. */
export function hash32(...xs: (number | string)[]) {
  let h = 2166136261 >>> 0;
  for (const x of xs) {
    const s = String(x);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= 0x9e3779b9; h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
  }
  h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0; h ^= h >>> 16;
  return h >>> 0;
}

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
