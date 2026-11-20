"use client";
import { useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { ReplayRow } from "@/lib/engine/payout";
import { int, monthLabel, ppg, usd } from "@/lib/format";
import { cx } from "../ui";
import { FLUID_SPRING } from "./motion";

/*
 * The replay as pressure: one fuel column per month whose level is the real EIA monthly mean.
 * The strike crosses every column; the part of the column above it (the overflow) is what the
 * cap pays on. Hover, tap or focus a month to read its numbers. Static: no entrance motion.
 */

const H = 196;

export function ReplayColumns({ rows, settleMonth, indexLabel }: { rows: ReplayRow[]; settleMonth: string; indexLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [active, setActive] = useState(settleMonth);
  if (!rows.length) return null;
  const strike = rows[0].strike;
  const vals = rows.map((r) => r.index);
  const lo = Math.floor((Math.min(...vals, strike) - 0.35) * 2) / 2;
  const hi = Math.ceil((Math.max(...vals, strike) + 0.15) * 2) / 2;
  const y = (v: number) => Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  const ticks: number[] = [];
  for (let t = Math.ceil(lo); t <= hi; t += 1) ticks.push(t);
  const a = rows.find((r) => r.month === active) ?? rows[rows.length - 1];
  const show = true; // static: the replay is read, not performed

  return (
    <div ref={ref}>
      {/* readout: fixed height so the chart never jumps */}
      <div className="flex min-h-[44px] flex-wrap items-baseline gap-x-3 gap-y-1" aria-live="polite">
        <span className="text-[13px] font-medium text-ink">{monthLabel(a.month, true)}</span>
        <span className="num text-[13px] text-muted">official price <span className={a.triggered ? "text-heat" : "text-ink2"}>{ppg(a.index)}</span></span>
        <span className="num text-[13px] text-muted">{a.triggered ? <>+{ppg(a.index - a.strike)} above the line</> : "below the line"}</span>
        <span className="num text-[13px] text-muted">money back <span className={a.triggered ? "text-jade" : "text-ink2"}>{a.triggered ? usd(a.payout) : "$0"}</span> on {int(a.coveredGallons)} gal</span>
        {a.month === settleMonth && <span className="text-[12px] text-ink2">settlement month</span>}
      </div>

      <div className="relative mt-2 flex gap-2 sm:gap-3">
        {/* axis */}
        <div aria-hidden className="relative w-9 shrink-0 text-[11px] text-faint" style={{ height: H, marginTop: 20 }}>
          {ticks.map((t) => <span key={t} className="num absolute right-0 translate-y-1/2" style={{ bottom: y(t) * H }}>${t.toFixed(0)}</span>)}
        </div>
        <ol aria-label="Monthly official price against where protection starts" className="relative flex min-w-0 flex-1 gap-1 sm:gap-1.5">
          {rows.map((r, i) => {
            const on = r.month === active, settle = r.month === settleMonth;
            const level = y(r.index), sk = y(strike);
            return (
              <li key={r.month} tabIndex={0}
                aria-label={`${monthLabel(r.month, true)}: official price ${ppg(r.index)}, ${r.triggered ? `${ppg(r.index - r.strike)} above the line, money back ${usd(r.payout)}` : "below the line, no money back"}`}
                onMouseEnter={() => setActive(r.month)} onFocus={() => setActive(r.month)} onClick={() => setActive(r.month)}
                className="group relative flex min-w-0 flex-1 cursor-default flex-col items-center rounded-[8px] outline-none">
                <span className={cx("num hidden h-5 whitespace-nowrap text-[11px] transition-colors duration-150 lg:block", r.triggered ? (on ? "text-jade" : "text-jade/70") : "text-transparent")}>
                  {r.triggered ? `$${(r.payout / 1000).toFixed(1)}k` : "·"}
                </span>
                <span className="h-5 lg:hidden" aria-hidden />
                <div className={cx("relative w-full overflow-hidden rounded-[8px] border bg-sunken/60 transition-[border-color] duration-150 group-focus-visible:ring-2 group-focus-visible:ring-jade",
                  on ? "border-line/14" : settle ? "border-jade/45" : "border-line/8 group-hover:border-line/[0.12]")} style={{ height: H }}>
                  {/* the fuel column */}
                  <motion.div aria-hidden className="absolute inset-x-0 bottom-0" initial={false}
                    animate={{ height: show ? level * H : 0 }} transition={reduce ? { duration: 0 } : { ...FLUID_SPRING, delay: i * 0.04 }}
                    style={{ background: "linear-gradient(0deg, rgb(var(--heat) / 0.05), rgb(var(--heat) / 0.16))" }}>
                    <div className="absolute inset-x-0 top-0 h-[2px] bg-heat/80" />
                  </motion.div>
                  {/* overflow above the strike: what the cap pays on */}
                  {r.triggered && (
                    <motion.div aria-hidden className="absolute inset-x-0 bg-heat/30" style={{ bottom: sk * H }} initial={false}
                      animate={{ height: show ? Math.max(0, level - sk) * H : 0 }} transition={reduce ? { duration: 0 } : { ...FLUID_SPRING, delay: i * 0.04 + 0.08 }} />
                  )}
                  {/* strike */}
                  <div aria-hidden className="absolute inset-x-0 h-px bg-jade/70" style={{ bottom: sk * H }} />
                </div>
                <span className={cx("num mt-1.5 whitespace-nowrap text-[11px] transition-colors duration-150", on ? "text-ink" : "text-faint")}>
                  <span className="hidden sm:inline">{monthLabel(r.month)}</span>
                  <span className="sm:hidden">{monthLabel(r.month).slice(0, 1)}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-heat/40" />{indexLabel}</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-px w-4 bg-jade" />Protection starts at <span className="num">{ppg(strike)}</span></span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-[3px] bg-heat/30 ring-1 ring-inset ring-heat/50" />Above the line: CostShield pays this back</span>
      </div>
    </div>
  );
}
