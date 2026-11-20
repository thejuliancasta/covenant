"use client";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/** Reveal once on scroll: an 8 px rise and fade, staggered 80 ms by `i`. Reduced motion: static. */
export function Reveal({ children, i = 0, className, immediate }: { children: ReactNode; i?: number; className?: string; immediate?: boolean }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  const to = { opacity: 1, y: 0 };
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      {...(immediate ? { animate: to } : { whileInView: to, viewport: { once: true, margin: "0px 0px -12% 0px" } })}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: i * 0.08 }}
    >{children}</motion.div>
  );
}
