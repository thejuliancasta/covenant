"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion, useAnimate, useReducedMotion } from "motion/react";
import { txUrl, type SettlementEvent, type SettlementResult, type StepStatus } from "@/lib/chain/types";
import { cx } from "../ui";
import { LockIcon, TxLink, tusd } from "../chain";
import { CipherGlyphs, DecodeText } from "./cipher";
import { FLUID_SPRING, STAGGER, UI_SPRING, clamp01 } from "./motion";
import { ArrowOut, DrawCheck, HashChip, TxChip } from "./tx";

/*
 * The settlement stage. Three lanes per protection step: underwriter, the step's vault on
 * chain, and the business wallet. Plates move between lanes only when a real streamed
 * SettlementEvent says so: open (accounts exist, money still with the underwriter), fund
 * (plate moves into its vault and seals with a cipher pattern), report (the attested mean
 * rises in the vault lane), release (plate slides to the wallet and leaves a payout chip),
 * reclaim (plate returns to the underwriter). Refusals shake once in rust.
 */

export type StepEvent = Extract<SettlementEvent, { type: "step" }>;
type Lane = "underwriter" | "vault" | "wallet";

export interface PlateModel { index: number; trigger: number; lane: Lane; sealed: boolean; triggered: boolean; released: boolean; reclaimed: boolean; tx?: string }

export interface StageModel {
  plates: PlateModel[];
  strike: number; stepSize: number;
  fromServer: boolean;
  opened: boolean; funded: boolean;
  mean: number | null; expectedMean: number;
  sha: string | null; reportTx: string | null; reportReused: boolean;
  perStep: number | null;
  received: number | null;
  dupStep: number | null; dupCount: number; strangerCount: number;
  strangerDetail: string | null;
}

const num = (s: string | undefined) => (s === undefined ? undefined : Number(s.replace(/,/g, "")));
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** Builds the stage from the event log only. The local plan fills in until the server says otherwise. */
export function deriveStage(log: StepEvent[], result: SettlementResult | null, plan: { strike: number; stepSize: number; count: number; expectedMean: number }): StageModel {
  let strike = plan.strike, stepSize = plan.stepSize, count = plan.count, fromServer = false, first: number | undefined;
  let opened = false, funded = false, mean: number | null = null, sha: string | null = null, reportTx: string | null = null, reportReused = false, perStep: number | null = null;
  let dupStep: number | null = null, dupCount = 0, strangerCount = 0, strangerDetail: string | null = null;
  const released = new Map<number, string>(), reclaimed = new Map<number, string>();
  for (const e of log) {
    const d = e.detail ?? "";
    if (e.id === "oracle" && e.status === "done") {
      const m = d.match(/strike \$([\d.]+); (\d+) steps of \$([\d.]+)\/gal/);
      if (m) { strike = Number(m[1]); count = Number(m[2]); stepSize = Number(m[3]); fromServer = true; }
      const h = d.match(/sha256 ([0-9a-f]{8,})/); if (h) sha = h[1];
    } else if (e.id === "open" && e.status === "done") {
      opened = true;
      const m = d.match(/triggers \$([\d.]+) to/); if (m) first = Number(m[1]);
    } else if (e.id === "fund" && e.status === "done") {
      funded = true;
      const m = d.match(/each holds ([\d,.]+) tUSD/); if (m) perStep = num(m[1]) ?? null;
    } else if (e.id === "report" && e.status === "done") {
      const m = d.match(/= \$([\d.]+)\/gal/); if (m) mean = Number(m[1]);
      const h = d.match(/sha256 ([0-9a-f]{8,})/); if (h) sha = h[1];
      reportTx = e.tx ?? null; reportReused = /already on chain/.test(d);
    } else if (e.id === "release" && e.tx) {
      const m = d.match(/^Step (\d+)/); if (m) released.set(Number(m[1]), e.tx);
    } else if (e.id === "reclaim" && e.tx) {
      const m = d.match(/^Step (\d+)/); if (m) reclaimed.set(Number(m[1]), e.tx);
    } else if (e.id === "duplicate" && e.status === "rejected") {
      dupCount += 1; const m = d.match(/step (\d+)/i); dupStep = m ? Number(m[1]) : 1;
    } else if (e.id === "stranger" && e.status === "rejected") {
      strangerCount += 1; strangerDetail = d;
    }
  }
  let plates: PlateModel[];
  if (result) {
    strike = result.strike; stepSize = result.stepSize; fromServer = true; opened = true; funded = true;
    mean = result.indexMean; sha = result.sourceHash; reportTx = result.txs.report || null; reportReused = result.txs.reportAlreadyOnChain;
    perStep = result.steps[0]?.amount ?? perStep;
    plates = result.steps.map((s) => {
      const back = !s.triggered && (reclaimed.has(s.index) || !!result.txs.reclaim);
      return { index: s.index, trigger: s.triggerPrice, lane: s.paid ? "wallet" : back ? "underwriter" : "vault", sealed: true, triggered: s.triggered, released: s.paid, reclaimed: back, tx: s.releaseTx ?? reclaimed.get(s.index) };
    });
  } else {
    plates = Array.from({ length: count }, (_, i) => {
      const index = i + 1, trigger = first !== undefined ? r3(first + i * stepSize) : r3(strike + index * stepSize);
      const rel = released.get(index), rec = reclaimed.get(index);
      const lane: Lane = rel ? "wallet" : rec ? "underwriter" : funded ? "vault" : opened ? "underwriter" : "vault";
      return { index, trigger, lane, sealed: funded, triggered: mean !== null && mean >= trigger - 1e-9, released: !!rel, reclaimed: !!rec, tx: rel ?? rec };
    });
  }
  return { plates, strike, stepSize, fromServer, opened, funded, mean, expectedMean: plan.expectedMean, sha, reportTx, reportReused, perStep, received: result ? result.fleetView.received : null, dupStep, dupCount, strangerCount, strangerDetail };
}

/** One rust shake per new refusal. */
function useShake(count: number) {
  const [scope, animate] = useAnimate();
  const reduce = useReducedMotion();
  const seen = useRef(count);
  useEffect(() => {
    if (count > seen.current && scope.current && !reduce) animate(scope.current, { x: [0, -6, 5, -3, 2, 0] }, { duration: 0.38, ease: "easeOut" });
    seen.current = count;
  }, [count, animate, scope, reduce]);
  return scope;
}

const ROW = 52;

/*
 * A plate is drawn as a slab (a thin bar) with its label above it, so no text is enclosed.
 * Slab color carries state: neutral (still with the underwriter), cipher (sealed in its vault),
 * heat (sealed and triggered by the attested mean), accent (released to the wallet).
 */
function PlateBody({ p, perStep }: { p: PlateModel; perStep: number | null }) {
  const slab = p.lane === "wallet" ? "bg-jade" : p.lane === "underwriter" ? (p.reclaimed ? "bg-ink/30" : "bg-ink/20") : p.triggered ? "bg-heat/55" : "bg-cipher/70";
  return (
    <div className="relative flex h-full min-w-0 flex-col justify-center gap-1.5 px-1">
      <div className="flex min-w-0 items-baseline justify-between gap-2 leading-4">
        <span className={cx("num shrink-0 text-[12px] font-medium", p.lane === "wallet" ? "text-ink" : "text-ink2")}>Chunk {p.index}</span>
        <span className="min-w-0 truncate text-[12px]">
          {p.lane === "wallet" ? (perStep !== null ? <DecodeText text={`+${perStep.toFixed(2)}`} play className="font-medium text-jade" /> : <span className="text-jade">paid</span>)
            : p.lane === "underwriter" ? (p.reclaimed ? <span className="text-muted">back to backer</span> : <span className="text-faint">not set aside yet</span>)
            : p.sealed ? <CipherGlyphs length={5} seed={`plate-${p.index}`} className="text-[12px] sm:text-[13px]" label={`Step ${p.index} amount, encrypted`} /> : null}
        </span>
      </div>
      <div className="relative h-[5px] overflow-hidden rounded-[3px] bg-line/10">
        <motion.div layout className={cx("absolute inset-0 rounded-[3px] transition-colors duration-300", slab)} />
        {p.sealed && p.lane === "vault" && <motion.span key="seal" aria-hidden className="pointer-events-none absolute inset-0 bg-cipher" initial={{ opacity: 1, scaleX: 0 }} animate={{ opacity: 0, scaleX: 1 }} style={{ originX: 0 }} transition={{ duration: 0.6, ease: "easeOut" }} />}
      </div>
    </div>
  );
}

export function SettlementStage({ m, company, explorer, running, underwriterBalance }: { m: StageModel; company: string; explorer: string; running: boolean; underwriterBalance?: number }) {
  const n = m.plates.length;
  const top = m.strike + n * m.stepSize;
  const levelOf = (x: number) => clamp01((x - m.strike) / (top - m.strike));
  const reportScope = useShake(m.strangerCount);
  const rows = [...m.plates].sort((a, b) => b.index - a.index);
  const level = m.mean !== null ? levelOf(m.mean) : 0;
  const paid = m.plates.filter((p) => p.released).length;
  const reduce = useReducedMotion();

  return (
    <div className="min-w-0">
      {/* Oracle report line */}
      <div ref={reportScope} className="flex min-h-[44px] flex-wrap items-baseline gap-x-4 gap-y-1.5">
        {m.mean !== null ? (<>
          <span className="text-[13px] text-muted">Official price posted on the blockchain</span>
          <span className="num text-[20px] font-[550] tracking-[-0.03em] text-heat">${m.mean.toFixed(3)}<span className="ml-1 text-[13px] font-normal tracking-normal text-muted">a gallon</span></span>
          {m.sha && <HashChip hash={m.sha} />}
          {m.reportTx && <TxChip sig={m.reportTx} explorer={explorer} />}
          {m.reportReused && <span className="text-[12px] text-faint">already posted, reused</span>}
        </>) : (
          <span className="text-[13px] leading-[1.5] text-muted">{running ? "Waiting for the official price to be posted on the blockchain…" : <>Expected official price from the replay: <span className="num text-ink2">${m.expectedMean.toFixed(3)}</span> a gallon. Not posted yet.</>}</span>
        )}
      </div>

      {/* Lane headers */}
      <div className="mt-5 grid grid-cols-[44px_repeat(3,minmax(0,1fr))] gap-x-2 text-[12px] sm:grid-cols-[60px_repeat(3,minmax(0,1fr))] sm:gap-x-4">
        <span className="self-end text-faint">Pays at price</span>
        <div className="min-w-0"><p className="truncate font-medium text-ink2">The backer</p><p className="num truncate text-faint">{underwriterBalance !== undefined ? tusd(underwriterBalance, 0) : "private balance"}</p></div>
        <div className="min-w-0"><p className="truncate font-medium text-ink2">Set aside in advance</p><p className="truncate text-faint">{m.funded ? "locked, amounts hidden" : m.opened ? "policy open, terms public" : "expected"}</p></div>
        <div className="min-w-0 text-right"><p className="truncate font-medium text-ink2">{company}</p><p className="num truncate text-faint">{paid ? `${paid} of ${n} paid` : "wallet"}</p></div>
      </div>

      <LayoutGroup>
        <div className="relative mt-2 grid grid-cols-[44px_repeat(3,minmax(0,1fr))] gap-x-2 sm:grid-cols-[60px_repeat(3,minmax(0,1fr))] sm:gap-x-4" style={{ gridTemplateRows: `repeat(${n}, ${ROW}px)` }}>
          {/* vault lane: the fuel column rises to the attested mean */}
          <div aria-hidden className="relative overflow-hidden rounded-[6px] bg-line/[0.035]" style={{ gridColumn: 3, gridRow: `1 / span ${n}` }}>
            <motion.div className="absolute inset-x-0 bottom-0" initial={false} animate={{ height: `${level * 100}%` }} transition={reduce ? { duration: 0 } : FLUID_SPRING}
              style={{ background: "linear-gradient(0deg, rgb(var(--heat) / 0.04), rgb(var(--heat) / 0.18))" }}>
              {m.mean !== null && <div className="absolute inset-x-0 top-0 h-[2px] bg-heat/85" />}
            </motion.div>
            {m.mean === null && <div className="absolute inset-x-0 border-t border-dashed border-ink/25" style={{ bottom: `${levelOf(m.expectedMean) * 100}%` }} />}
          </div>
          {/* axis: trigger prices sit on each row's top edge; the attested mean is labelled where the column stops */}
          <div aria-hidden className="relative" style={{ gridColumn: 1, gridRow: `1 / span ${n}` }}>
            {rows.map((p, i) => {
              const hidden = m.mean !== null && Math.abs((1 - level) * n * ROW - i * ROW) < 15;
              return (
                <span key={p.index} className={cx("num absolute right-0 -translate-y-1/2 text-[11.5px] transition-[color,opacity] duration-200", p.triggered ? "text-heat/80" : "text-faint", hidden && "opacity-0")} style={{ top: i * ROW + 1 }}>
                  <span className="sm:hidden">${p.trigger.toFixed(2)}</span><span className="hidden sm:inline">${p.trigger.toFixed(3)}</span>
                </span>
              );
            })}
            <span className={cx("num absolute bottom-0 right-0 translate-y-1/2 text-[11.5px] text-jade transition-opacity duration-200", m.mean !== null && level * n * ROW < 15 && "opacity-0")}>
              <span className="sm:hidden">${m.strike.toFixed(2)}</span><span className="hidden sm:inline">${m.strike.toFixed(3)}</span>
            </span>
            {m.mean !== null && (
              <motion.span className="num absolute right-0 z-20 text-[11.5px] font-[550] leading-4 text-heat" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ bottom: `calc(${level * 100}% - 8px)` }}>
                <span className="sm:hidden">${m.mean.toFixed(2)}</span><span className="hidden sm:inline">${m.mean.toFixed(3)}</span>
              </motion.span>
            )}
          </div>
          {rows.map((p, i) => {
            const row = i + 1;
            return (
              <div key={p.index} className="contents">
                {/* vault slot (stays put): planned terms, or what happened to the plate */}
                <div className="relative flex items-center justify-center px-1" style={{ gridColumn: 3, gridRow: row }}>
                  {p.released && p.tx && <PayoutMark step={p.index} tx={p.tx} explorer={explorer} shake={m.dupStep === p.index ? m.dupCount : 0} />}
                  {p.reclaimed && p.tx && <ReturnMark tx={p.tx} explorer={explorer} />}
                  {!m.opened && !m.funded && (
                    <span className="flex w-full flex-col gap-1.5 px-1">
                      <span className="text-[11.5px] text-faint">Chunk {p.index}</span>
                      <span className="h-[5px] rounded-[3px] border border-dashed border-line/14" />
                    </span>
                  )}
                </div>
                {(m.opened || m.funded) && (
                  <motion.div layout className="relative z-10" style={{ gridColumn: p.lane === "underwriter" ? 2 : p.lane === "vault" ? 3 : 4, gridRow: row }}
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ default: { ...UI_SPRING, delay: reduce ? 0 : (p.index - 1) * STAGGER * 0.5 }, layout: reduce ? { duration: 0 } : { type: "spring", stiffness: 210, damping: 27, delay: p.lane === "vault" ? (p.index - 1) * STAGGER * 0.5 : 0 } }}>
                    <PlateBody p={p} perStep={m.perStep} />
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </LayoutGroup>
      <p className="sr-only" aria-live="polite">{m.mean !== null ? `Attested mean ${m.mean.toFixed(3)} dollars a gallon. ${m.plates.filter((p) => p.triggered).length} of ${n} steps triggered. ${paid} released.` : ""}</p>
    </div>
  );
}

/** What the vault slot keeps after a release: plain "paid" with the transaction. A refused repeat flashes red and shakes once. */
function PayoutMark({ step, tx, explorer, shake }: { step: number; tx: string; explorer: string; shake: number }) {
  const scope = useShake(shake);
  const [flash, setFlash] = useState(false);
  const seen = useRef(shake);
  useEffect(() => {
    if (shake > seen.current) { setFlash(true); const t = setTimeout(() => setFlash(false), 1400); seen.current = shake; return () => clearTimeout(t); }
    seen.current = shake;
  }, [shake]);
  return (
    <motion.span ref={scope} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={UI_SPRING}
      className={cx("inline-flex items-center gap-1.5 whitespace-nowrap text-[11.5px] transition-colors duration-300", flash ? "text-rust" : "text-ink2")}>
      <span className="font-medium">{flash ? "paid, second try refused" : "paid"}</span>
      {!flash && <TxLink sig={tx} explorer={explorer} className="hidden text-[10.5px] !text-inherit xl:inline-flex" />}
      <a href={txUrl(explorer, tx)} target="_blank" rel="noreferrer" aria-label={`Release transaction for step ${step}`} className="relative inline-flex before:absolute before:-inset-3 before:content-[''] xl:hidden"><ArrowOut /></a>
      <span className="sr-only">Step {step} released</span>
    </motion.span>
  );
}

function ReturnMark({ tx, explorer }: { tx: string; explorer: string }) {
  return (
    <motion.a href={txUrl(explorer, tx)} target="_blank" rel="noreferrer" title={`Reclaim transaction ${tx}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={UI_SPRING}
      className="relative inline-flex items-center gap-1.5 whitespace-nowrap text-[11.5px] text-muted transition-colors duration-150 before:absolute before:-inset-y-3 before:inset-x-0 before:content-[''] hover:text-ink">
      <span className="font-medium">back to backer</span><ArrowOut />
    </motion.a>
  );
}

/* Event log: one line per streamed step. Status is a plain glyph and color, never a badge. */

function StatusMark({ status }: { status: StepStatus }) {
  if (status === "running") return (
    <span className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center" role="img" aria-label="in progress">
      <svg viewBox="0 0 20 20" width="15" height="15" className="animate-spin text-jade [animation-duration:1.1s]"><path d="M10 2.5a7.5 7.5 0 0 1 7.5 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
    </span>
  );
  if (status === "done") return <span role="img" aria-label="done" className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center text-muted"><DrawCheck size={14} /></span>;
  if (status === "rejected") return <span role="img" aria-label="refused" className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center text-rust"><svg viewBox="0 0 12 12" width="11" height="11"><path d="M2.5 2.5 9.5 9.5M9.5 2.5 2.5 9.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg></span>;
  return <span role="img" aria-label="error" className="mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center text-[13px] font-bold text-rust">!</span>;
}

/** Plain names for the server's steps; the server's own detail line stays underneath. */
const PLAIN: Record<string, string> = {
  oracle: "Read the official diesel price for the month",
  setup: "Check the test wallets and private balances",
  open: "Open the policy on Solana (terms are public)",
  fund: "The backer sets money aside in advance, privately",
  report: "Official price posted on the blockchain",
  stranger: "Someone else tries to post a fake price",
  release: "Paid to the business, privately",
  duplicate: "The business tries to collect twice",
  reclaim: "Unused money goes back to the backer",
};

function LogRow({ s, explorer }: { s: StepEvent; explorer: string }) {
  const scope = useShake(s.status === "rejected" || s.status === "error" ? 1 : 0);
  return (
    <motion.li layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={UI_SPRING}>
      <div ref={scope} className="flex items-start gap-3">
        <StatusMark status={s.status} />
        <div className="min-w-0 flex-1">
          <p className={cx("flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[14px] font-medium transition-colors duration-200", s.status === "running" ? "text-ink" : s.status === "done" ? "text-ink2" : "text-ink")}>
            {PLAIN[s.id] ?? s.label}
            {s.status === "rejected" && <span className="text-[12.5px] font-medium text-rust">refused, as designed</span>}
          </p>
          {s.detail && <p className="mt-1 break-words text-[12px] leading-[1.55] text-faint">{s.detail}</p>}
          {(s.private || s.tx) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
              {s.tx && <TxChip sig={s.tx} explorer={explorer} />}
              {s.private && <span className="inline-flex items-center gap-1.5 text-[12px] text-cipher"><LockIcon />Private: amounts hidden</span>}
            </div>
          )}
        </div>
      </div>
    </motion.li>
  );
}

export function EventLog({ steps, explorer, empty }: { steps: StepEvent[]; explorer: string; empty: ReactNode }) {
  return (
    <ol className="space-y-5" aria-live="polite" aria-label="Settlement steps on Solana devnet">
      <AnimatePresence initial={false}>
        {steps.map((s) => <LogRow key={s.id} s={s} explorer={explorer} />)}
      </AnimatePresence>
      {steps.length === 0 && <li className="text-[13px] leading-[1.55] text-muted">{empty}</li>}
    </ol>
  );
}
