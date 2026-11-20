"use client";
import { useRef, useState, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { DecodeText } from "@/components/settle/cipher";
import type { LandingData } from "./data";
import { cx, lift, mon, monYear, pct1, surface, usd0, usd2 } from "./kit";

const EASE = [0.16, 1, 0.3, 1] as const;

function Frame({ title, meta, children, className }: { title: ReactNode; meta?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx(surface, lift, "overflow-hidden", className)}>
      <div className="flex h-11 items-center justify-between gap-4 border-b border-line/6 px-4 text-[13px]">
        <span className="truncate font-[550] text-ink2">{title}</span>
        {meta && <span className="shrink-0 text-faint">{meta}</span>}
      </div>
      {children}
    </div>
  );
}

/** Plays once when at least `amount` of the element is in view; immediately under reduced motion. */
function useOnce(amount = 0.45) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, amount });
  const reduce = !!useReducedMotion();
  return { ref, on: seen || reduce, reduce };
}

/* 1. Ledger lines sorting into categories */
function Memo({ text }: { text: string }) {
  const parts = text.split(/(\d+(?:\.\d+)? gal @ \$\d+\.\d+)/);
  return <>{parts.map((p, i) => (i % 2 ? <span key={i} className="text-ink2">{p}</span> : <span key={i}>{p}</span>))}</>;
}

export function LedgerSort({ d }: { d: LandingData }) {
  const { ref, on, reduce } = useOnce();
  return (
    <Frame title="Ledger import" meta={d.format.replace(/ \(CSV\)$/, "")}>
      <div ref={ref} role="table" aria-label="Ledger lines and their categories" className="text-[13px]">
        <div role="row" className="hidden grid-cols-[56px_1fr_84px_148px] gap-4 border-b border-line/6 px-4 py-2.5 text-[12px] text-faint sm:grid">
          <span role="columnheader">Date</span><span role="columnheader">Vendor and memo</span><span role="columnheader" className="text-right">Amount</span><span role="columnheader">Category</span>
        </div>
        {d.ledger.map((l, i) => (
          <div role="row" key={i} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-b border-line/[0.04] px-4 py-3 last:border-0 sm:grid-cols-[56px_1fr_84px_148px] sm:items-center">
            <span role="cell" className="num hidden text-faint sm:block">{mon(l.date.slice(0, 7))} {Number(l.date.slice(8, 10))}</span>
            <span role="cell" className="min-w-0">
              <span className="block truncate text-ink">{l.vendor}</span>
              <span className="num block truncate text-[12px] text-faint"><Memo text={l.memo} /></span>
            </span>
            <span role="cell" className="num text-right text-ink2">{usd2(l.amount)}</span>
            <span role="cell" className="relative col-span-2 h-[18px] sm:col-span-1">
              <motion.span aria-hidden className="absolute inset-0 text-faint" initial={false} animate={{ opacity: on ? 0 : 1 }} transition={{ duration: 0.2, delay: reduce ? 0 : 0.3 + i * 0.08 }}>Reading</motion.span>
              <motion.span className="absolute inset-0 flex items-baseline gap-2 whitespace-nowrap" initial={reduce ? false : { opacity: 0, x: -6 }} animate={on ? { opacity: 1, x: 0 } : { opacity: 0, x: -6 }} transition={{ duration: 0.45, ease: EASE, delay: reduce ? 0 : 0.35 + i * 0.08 }}>
                <span className={l.fuel ? "text-heat" : "text-ink2"}>{l.label}</span>
                <span className="num font-mono text-[11px] text-faint">{l.confidence.toFixed(2)}</span>
              </motion.span>
            </span>
          </div>
        ))}
      </div>
      <div className="num flex flex-wrap gap-x-6 gap-y-1 border-t border-line/6 bg-panel/40 px-4 py-3 text-[12px] text-muted">
        <span><span className="text-ink2">{d.lines.toLocaleString("en-US")}</span> lines imported</span>
        <span><span className="text-ink2">{d.skipped}</span> footer row skipped and counted</span>
        <span><span className="text-ink2">{d.unclassified}</span> unclassified</span>
      </div>
    </Frame>
  );
}

/* 2. Exposure bars: what a market controls */
export function ExposureBars({ d }: { d: LandingData }) {
  const { ref, on, reduce } = useOnce();
  const max = Math.max(...d.categoryRows.map((c) => c.share));
  return (
    <Frame title="Exposure by category" meta="Share of revenue, last 12 months">
      <div ref={ref}><ul className="px-4 py-2">
        {d.categoryRows.map((c, i) => (
          <li key={c.label} className="grid grid-cols-[1fr_52px] gap-x-4 gap-y-1.5 py-2.5 sm:grid-cols-[148px_1fr_52px] sm:items-center">
            <span className={cx("text-[13px]", c.market ? "font-[550] text-ink" : "text-muted")}>{c.label}</span>
            <span className="num text-right text-[13px] sm:order-3"><span className={c.market ? "text-heat" : "text-faint"}>{pct1(c.share)}</span></span>
            <span className="col-span-2 sm:order-2 sm:col-span-1">
              <span className="block h-2 overflow-hidden rounded-full bg-well">
                <motion.span
                  className={cx("block h-full origin-left rounded-full", c.market ? "bg-jade" : "bg-ink/[0.16]")}
                  style={{ width: `${(c.share / max) * 100}%` }}
                  initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: on ? 1 : 0 }}
                  transition={{ duration: 0.9, ease: EASE, delay: reduce ? 0 : i * 0.06 }}
                />
              </span>
              <span className={cx("mt-1.5 block text-[12px]", c.market ? "text-ink2" : "text-faint")}>{c.verdict}</span>
            </span>
          </li>
        ))}
      </ul></div>
      <div className="num border-t border-line/6 bg-panel/40 px-4 py-3 text-[12px] text-muted">
        A 1-in-20 diesel year (<span className="text-ink2">+{(d.diesel.shockPct * 100).toFixed(0)}%</span>) costs <span className="text-ink2">{usd0(d.diesel.shockNet)}</span> after surcharges, <span className="text-heat">{d.diesel.shockTimesProfit.toFixed(1)}×</span> operating profit.
      </div>
    </Frame>
  );
}

/* 3. The cap as plates above the strike, with the real cover-year index */
export function CapLadder({ d }: { d: LandingData }) {
  const { ref, on, reduce } = useOnce(0.4);
  const rows = d.policy.rows, strike = d.policy.strike, STEP = 0.25, N = 8;
  const W = 560, H = 268, L = 8, R = 72, T = 12, B = 28;
  const lo = Math.floor((Math.min(...rows.map((r) => r.index)) - 0.4) * 4) / 4;
  const hi = strike + N * STEP + 0.12;
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const base = H - B, pitch = (W - L - R) / rows.length, bw = Math.min(22, pitch * 0.5);
  const peak = rows.reduce((a, b) => (b.index > a.index ? b : a), rows[0]);
  const peakSteps = Math.floor((peak.index - strike) / STEP + 1e-9);
  return (
    <Frame title="Diesel cap, replayed" meta={`Strike ${"$"}${strike.toFixed(3)} a gallon`}>
      <div ref={ref} className="px-4 pb-2 pt-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img"
          aria-label={`Monthly ${d.diesel.regionLabel} diesel index for the cover year against a cap of eight $0.25 steps above the strike`}>
          {Array.from({ length: N }, (_, k) => {
            const top = y(strike + (k + 1) * STEP), bot = y(strike + k * STEP);
            const lit = k < peakSteps;
            return (
              <g key={k}>
                <rect x={L} y={top + 1.5} width={W - L - R} height={Math.max(1, bot - top - 3)} rx={3}
                  fill={lit ? "rgb(var(--jade) / 0.07)" : "rgb(var(--ink) / 0.025)"} stroke={lit ? "rgb(var(--jade) / 0.22)" : "rgb(var(--line) / 0.07)"} />
                <text x={W - R + 10} y={(top + bot) / 2 + 3.5} fontSize="10.5" fill={lit ? "rgb(var(--heat))" : "rgb(var(--faint))"} className="num">{"$"}{(strike + (k + 1) * STEP).toFixed(3)}</text>
              </g>
            );
          })}
          {rows.map((r, i) => {
            const cx0 = L + pitch * (i + 0.5) - bw / 2;
            const yTop = y(r.index), yS = y(strike);
            return (
              <g key={r.month}>
                <motion.g style={{ transformOrigin: `${cx0 + bw / 2}px ${base}px` }} initial={reduce ? false : { scaleY: 0 }} animate={{ scaleY: on ? 1 : 0 }} transition={{ duration: 0.8, ease: EASE, delay: reduce ? 0 : 0.1 + i * 0.05 }}>
                  <rect x={cx0} y={Math.max(yTop, yS)} width={bw} height={base - Math.max(yTop, yS)} rx={2} fill="rgb(var(--ink) / 0.13)" />
                  {r.index > strike && <rect x={cx0} y={yTop} width={bw} height={yS - yTop} rx={2} fill="rgb(var(--jade))" />}
                </motion.g>
                <text x={cx0 + bw / 2} y={H - 9} fontSize="10.5" textAnchor="middle" fill="rgb(var(--faint))">{mon(r.month)}</text>
              </g>
            );
          })}
          <line x1={L} x2={W - R + 4} y1={y(strike)} y2={y(strike)} stroke="rgb(var(--jade))" strokeWidth={1} />
          <text x={W - R + 10} y={y(strike) + 3.5} fontSize="10.5" fill="rgb(var(--ink2))" className="num">Strike</text>
        </svg>
      </div>
      <div className="num border-t border-line/6 bg-panel/40 px-4 py-3 text-[12px] text-muted">
        {monYear(rows[0].month)} to {monYear(rows[rows.length - 1].month)}: paid in <span className="text-ink2">{d.policy.paidMonths} of {rows.length}</span> months, <span className="text-heat">{usd0(d.policy.totalPayout)}</span> against <span className="text-ink2">{usd0(d.policy.totalExtraCost)}</span> of extra fuel cost.
      </div>
    </Frame>
  );
}

/* 4. Pays privately: the public chain next to the fleet's own view */
export function PrivatePayout({ d }: { d: LandingData }) {
  const { ref, on } = useOnce(0.55);
  const [replay, setReplay] = useState(0);
  const s = d.settlement;
  const play = on;
  const rows: { k: string; pub: ReactNode; own: ReactNode }[] = [
    { k: "Oracle report", pub: <span className="num text-ink2">{"$"}{s.indexMean.toFixed(3)}/gal</span>, own: <span className="num text-ink2">{"$"}{s.indexMean.toFixed(3)}/gal</span> },
    { k: "Steps released", pub: <span className="num text-ink2">{s.paidSteps} of {s.steps.length}</span>, own: <span className="num text-ink2">{s.paidSteps} of {s.steps.length}</span> },
    { k: "Each step holds", pub: <DecodeText text={usd2(s.stepAmount)} play={false} seed="pub-step" />, own: <DecodeText key={replay} text={usd2(s.stepAmount)} play={play} seed="own-step" className="text-ink2" /> },
  ];
  return (
    <Frame title={`Settlement, ${monYear(s.month, true)}`} meta="Solana devnet">
      <div ref={ref} className="grid sm:grid-cols-2">
        <div className="border-b border-line/6 p-4 sm:border-b-0 sm:border-r sm:p-5">
          <p className="text-[13px] font-[550] text-muted">What the public chain shows</p>
          <dl className="mt-4 space-y-3 text-[13px]">
            {rows.map((r) => <div key={r.k} className="flex items-baseline justify-between gap-4"><dt className="text-faint">{r.k}</dt><dd>{r.pub}</dd></div>)}
          </dl>
          <div className="mt-6">
            <p className="text-[12px] text-faint">Paid to the fleet</p>
            <p className="mt-1.5 text-[28px] font-[540] tracking-[-0.02em]"><DecodeText text={usd2(s.payout)} play={false} seed="pub-pay" /></p>
          </div>
        </div>
        <div
          className="p-4 sm:p-5"
          onPointerEnter={() => on && setReplay((r) => r + 1)}
        >
          <p className="text-[13px] font-[550] text-ink2">What {d.company.replace(/ LLC$/, "")} sees</p>
          <dl className="mt-4 space-y-3 text-[13px]">
            {rows.map((r) => <div key={r.k} className="flex items-baseline justify-between gap-4"><dt className="text-faint">{r.k}</dt><dd>{r.own}</dd></div>)}
          </dl>
          <div className="mt-6">
            <p className="text-[12px] text-faint">Paid to the fleet, test dollars</p>
            <p className="mt-1.5 text-[28px] font-[540] tracking-[-0.02em] text-ink"><DecodeText key={replay} text={usd2(s.payout)} play={play} seed="own-pay" /></p>
          </div>
        </div>
      </div>
      <div className="num border-t border-line/6 bg-panel/40 px-4 py-3 text-[12px] text-muted">
        {s.paidSteps} steps × {"$"}0.25 × {Math.round(s.gallons).toLocaleString("en-US")} covered gallons. Amounts and balances stay encrypted on chain.
      </div>
    </Frame>
  );
}

/* 5. The lender's read-only view */
export function LenderView({ d }: { d: LandingData }) {
  const s = d.settlement;
  return (
    <Frame title="Lender view" meta="Read-only">
      <div className="px-4 pb-1 pt-4 sm:px-5">
        <p className="text-[15px] font-[560] text-ink">{d.company}</p>
        <p className="mt-0.5 text-[13px] text-muted">Diesel cap, {d.diesel.regionLabel} index, {monYear(s.month, true)}</p>
      </div>
      <table className="mt-3 w-full text-[13px]">
        <thead>
          <tr className="border-y border-line/6 text-[12px] text-faint">
            <th scope="col" className="py-2 pl-4 text-left font-normal sm:pl-5">Step</th>
            <th scope="col" className="py-2 text-right font-normal">Trigger</th>
            <th scope="col" className="py-2 text-right font-normal">Funded</th>
            <th scope="col" className="py-2 pl-6 pr-4 text-left font-normal sm:pr-5">Status</th>
          </tr>
        </thead>
        <tbody className="num">
          {s.steps.map((st) => (
            <tr key={st.index} className="border-b border-line/[0.04] last:border-0">
              <td className="py-2 pl-4 text-faint sm:pl-5">{st.index}</td>
              <td className="py-2 text-right text-ink2">{"$"}{st.trigger.toFixed(3)}</td>
              <td className="py-2 text-right text-ink2">{usd2(s.stepAmount)}</td>
              <td className={cx("py-2 pl-6 pr-4 sm:pr-5", st.paid ? "text-ink" : "text-faint")}>{st.paid ? "Paid" : "Returned to underwriter"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="num flex flex-wrap gap-x-6 gap-y-1 border-t border-line/6 bg-panel/40 px-4 py-3 text-[12px] text-muted sm:px-5">
        <span>Funded <span className="text-ink2">{usd2(s.funded)}</span></span>
        <span>Paid <span className="text-ink2">{usd2(s.payout)}</span></span>
        <span>Index <span className="text-ink2">{"$"}{s.indexMean.toFixed(3)}</span></span>
      </div>
    </Frame>
  );
}
