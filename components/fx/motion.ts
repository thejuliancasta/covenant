"use client";
import { useEffect, useState, type RefObject } from "react";
import { useReducedMotion } from "motion/react";

/** Springs from docs/UI_DIRECTION.md. UI controls settle fast; fluid surfaces are slower and softer. */
export const SPRING_UI = { type: "spring", stiffness: 380, damping: 32 } as const;
export const SPRING_FLUID = { type: "spring", stiffness: 140, damping: 18 } as const;
/** Stagger between semantic chunks, in seconds. */
export const STAGGER = 0.09;
/** Ease for short control transitions (matches the `ease-out` token in tailwind.config.ts). */
export const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;

/** True when the user asked the OS for reduced motion. Safe on the server (false). */
export function useCalm(): boolean {
  return !!useReducedMotion();
}

/**
 * True while the element is on screen and the document is visible. Continuous
 * motion (ripples, morphing glyphs) must stop when this is false.
 */
export function useActive(ref: RefObject<Element | null>, margin = "0px"): boolean {
  const [onScreen, setOnScreen] = useState(false);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin]);
  useEffect(() => {
    const on = () => setVisible(document.visibilityState === "visible");
    on();
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return onScreen && visible;
}

/** Content-box size of an element, updated on resize. Starts at the fallback so SSR markup has geometry. */
export function useSize<T extends Element>(ref: RefObject<T | null>, fallback = { width: 720, height: 360 }) {
  const [size, setSize] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setSize((s) => (Math.abs(s.width - width) < 0.5 && Math.abs(s.height - height) < 0.5 ? s : { width, height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** CSS color from a theme token, with optional alpha: tok("jade", .3) -> rgb(var(--jade) / 0.3). */
export const tok = (name: string, alpha = 1) => `rgb(var(--${name}) / ${alpha})`;
