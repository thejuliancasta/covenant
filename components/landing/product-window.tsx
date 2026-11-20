"use client";
import { motion, useReducedMotion } from "motion/react";
import { LogoMark } from "@/components/brand/logo";
import type { LandingData, MonthRow } from "./data";
import { cx, monYear, pct1, usd0 } from "./kit";

const NAV = ["Books", "Risks", "Protection", "What if", "Payouts"];

function Ev({ e }: { e: "C" | "V" | "A" }) {
  const t = { C: "Calculated from data", V: "Verified public data", A: "Assumption" }[e];
  return <span title={t} className="ml-1.5 font-mono text-[10px] text-faint">{e}</span>;
}

/** Price paid per gallon against the regional index, 24 real months. */
export function PaidVsIndex({ rows, className }: { rows: MonthRow[]; className?: string }) {
  const W = 480, H = 168, P = 6;
  const vals = rows.flatMap((r) => [r.pricePaid, r.index]);
  const lo = Math.min(...vals) - 0.15, hi = Math.max(...vals) + 0.15;
  const x = (i: number) => P + (i / (rows.length - 1)) * (W - 2 * P);
  const y = (v: number) => P + (1 - (v - lo) / (hi - lo)) * (H - 2 * P);
  const path = (k: "pricePaid" | "index") => rows.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(r[k]).toFixed(1)}`).join("");
  const grid = [0.25, 0.5, 0.75].map((f) => P + f * (H - 2 * P));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={cx("block h-[168px] w-full", className)} role="img"
      aria-label={`Price paid per gallon and the index, ${monYear(rows[0].month)} to ${monYear(rows[rows.length - 1].month)}`}>
      {grid.map((g) => <line key={g} x1={0} x2={W} y1={g} y2={g} stroke="rgb(var(--line) / 0.05)" vectorEffect="non-scaling-stroke" />)}
      <path d={path("index")} fill="none" stroke="rgb(var(--ink) / 0.32)" strokeWidth={1.25} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <path d={path("pricePaid")} fill="none" stroke="rgb(var(--jade))" strokeWidth={1.75} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function Window({ d }: { d: LandingData }) {
  const top = d.categoryRows.slice(0, 6);
  const maxShare = Math.max(...top.map((c) => c.share));
  const first = d.monthly[0].month, last = d.monthly[d.monthly.length - 1].month;
  return (
    <div className="overflow-hidden rounded-[14px] border border-line/8 bg-raised text-left shadow-[inset_0_1px_0_rgb(var(--ink)/0.1),0_60px_140px_-48px_rgb(var(--shadow)/0.95)]">
      {/* Title bar */}
      <div className="flex h-11 items-center gap-2.5 border-b border-line/6 px-4 text-[13px]">
        <LogoMark size={16} />
        <span className="font-[550] text-ink2">{d.company}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="text-faint"><path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
        <span className="text-muted">Risks</span>
        <span className="ml-auto hidden text-faint sm:inline">Sample company, test mode</span>
      </div>
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden w-[200px] shrink-0 border-r border-line/6 p-3 md:block">
          <ul className="space-y-0.5 text-[13px]">
            {NAV.map((n) => (
              <li key={n} className={cx("flex h-8 items-center rounded-[7px] px-2.5", n === "Risks" ? "bg-well/70 font-[550] text-ink shadow-[inset_0_1px_0_rgb(var(--ink)/0.05)]" : "text-muted")}>{n}</li>
            ))}
          </ul>
          <p className="mb-1 mt-6 px-2.5 text-[12px] text-faint">Sources</p>
          <ul className="space-y-0.5 text-[13px] text-muted">
            <li className="flex h-8 items-center justify-between px-2.5"><span>Ledger</span><span className="num text-faint">{d.lines.toLocaleString("en-US")}</span></li>
            <li className="flex h-8 items-center px-2.5">Official diesel prices</li>
            <li className="flex h-8 items-center px-2.5">Gemini markets</li>
          </ul>
        </aside>
        {/* Main */}
        <div className="min-w-0 flex-1 p-5 md:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h3 className="text-[20px] font-[560] tracking-[-0.015em] text-ink">Your risk profile</h3>
            <p className="num text-[13px] text-faint">{monYear(d.dateFrom.slice(0, 7))} to {monYear(d.dateTo.slice(0, 7))}, {d.lines.toLocaleString("en-US")} transactions</p>
          </div>
          {/* KPIs */}
          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-line/6 bg-line/6 lg:grid-cols-4">
            {[
              { k: "Revenue, last 12 months", v: usd0(d.revenueTtm), s: "From the ledger", e: "C" as const },
              { k: "Operating profit", v: usd0(d.profitTtm), s: `${(d.marginTtm * 100).toFixed(1)}% margin`, e: "C" as const },
              { k: "Fleet fuel", v: usd0(d.diesel.spendTtm), s: <><span className="text-heat">{pct1(d.diesel.share)}</span> of revenue</>, e: "C" as const },
              { k: "A bad diesel year", v: "+" + usd0(d.diesel.shockNet), s: <><span className="text-heat">{d.diesel.shockTimesProfit.toFixed(1)}×</span> operating profit</>, e: "C" as const },
            ].map((s) => (
              <div key={s.k} className="bg-raised px-4 py-3.5">
                <dt className="flex items-center text-[12px] text-muted">{s.k}<Ev e={s.e} /></dt>
                <dd className="num mt-1.5 text-[20px] font-[560] tracking-[-0.02em] text-ink">{s.v}</dd>
                <dd className="mt-0.5 text-[12px] text-faint">{s.s}</dd>
              </div>
            ))}
          </dl>
          {/* Panels */}
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_1fr]">
            <section className="rounded-[10px] border border-line/6 bg-raised p-4">
              <div className="flex items-baseline justify-between">
                <h4 className="text-[13px] font-[550] text-ink2">Where the money goes</h4>
                <span className="text-[12px] text-faint">Share of revenue</span>
              </div>
              <ul className="mt-3.5 space-y-2.5">
                {top.map((c) => (
                  <li key={c.label} className="grid grid-cols-[112px_1fr_44px] items-center gap-3 text-[12px]">
                    <span className={cx("truncate", c.market ? "text-ink" : "text-muted")}>{c.label}</span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-well">
                      <span className={cx("block h-full rounded-full", c.market ? "bg-jade" : "bg-ink/20")} style={{ width: `${(c.share / maxShare) * 100}%` }} />
                    </span>
                    <span className={cx("num text-right", c.market ? "text-heat" : "text-faint")}>{pct1(c.share)}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-[10px] border border-line/6 bg-raised p-4">
              <div className="flex items-baseline justify-between gap-4">
                <h4 className="text-[13px] font-[550] text-ink2">Their pump price vs. the official Midwest price</h4>
                <span className="shrink-0 text-[12px] text-faint">Moves together</span>
              </div>
              <PaidVsIndex rows={d.monthly} className="mt-3" />
              <div className="num mt-2 flex justify-between text-[11px] text-faint"><span>{monYear(first)}</span><span>{monYear(last)}</span></div>
            </section>
          </div>
          <div className="mt-4 grid gap-4 text-[13px] lg:grid-cols-2">
            <p className="rounded-[10px] border border-line/6 px-4 py-3 text-muted"><span className="font-[550] text-jade">Can be protected.</span> Diesel, with protection starting at {"$"}{d.policy.strike.toFixed(2)} a gallon.</p>
            <p className="rounded-[10px] border border-line/6 px-4 py-3 text-muted"><span className="font-[550] text-ink2">Can&apos;t be protected.</span> Payroll, leases, repairs and insurance.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The hero's product window: a live rendering of the risk profile, tilted a few degrees, fading into the page. */
export function ProductWindow({ d }: { d: LandingData }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative" style={{ perspective: "2400px" }}>
      <motion.div
        initial={reduce ? false : { opacity: 0, rotateX: 18, y: 40 }}
        animate={{ opacity: 1, rotateX: 7, y: 0 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
        style={{ transformOrigin: "50% 0%", transformStyle: "preserve-3d" }}
        className="max-h-[560px] overflow-hidden md:max-h-[620px]"
      >
        <Window d={d} />
      </motion.div>
      <div aria-hidden className="pointer-events-none absolute inset-x-[-4%] bottom-[-2px] h-[48%] bg-gradient-to-b from-bg/0 via-bg/70 to-bg" />
    </div>
  );
}
