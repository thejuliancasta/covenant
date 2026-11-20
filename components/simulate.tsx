"use client";
import { useMemo, useState } from "react";
import { MotionConfig, motion, useReducedMotion } from "motion/react";
import type { Analysis } from "@/lib/engine/pipeline";
import { DEFAULT_EXPLORER, txUrl, type SettlementEvent, type SettlementResult } from "@/lib/chain/types";
import { scenario } from "@/lib/engine/payout";
import { priceCap } from "@/lib/engine/pricing";
import { int, monthLabel, pct, ppg, readNdjson, usd } from "@/lib/format";
import { Arrow, Button, Ev, Note, PageHead, Row, Table, cx } from "./ui";
import { Panel as Card } from "./settle/surface";
import { AddrLink, LockIcon, TxLink, periodYm, tusd, useChainStatus } from "./chain";
import { FineRange, PresetChip, PriceRiseControl, Segmented, plateBounds } from "./settle/price-control";
import { Rolling, useCountUp } from "./settle/rolling";
import { UI_SPRING } from "./settle/motion";
import { EventLog, SettlementStage, deriveStage, type StepEvent } from "./settle/stage";
import { HashChip, TxChip } from "./settle/tx";
import { TwoViews } from "./settle/views";
import { PriceVsTrigger } from "./fx/price-vs-trigger";

/* ------------------------------------------------------------------ simulator */

export function Simulator({ a, onNext }: { a: Analysis; onNext: () => void }) {
  const d = a.diesel!, p = a.policy!;
  const sep = p.replay.find((r) => r.month === p.settlement.month);
  const likeSettle = sep ? Math.round((sep.index - p.inceptionIndex) * 20) / 20 : 2.5; // opens on this scenario
  const [rise, setRise] = useState(Math.min(3, likeSettle));
  const [gallons, setGallons] = useState(Math.round(d.gallonsTtm / 12 / 10) * 10);
  const [share, setShare] = useState(p.coveredShare);
  const [offset, setOffset] = useState(p.strikeOffset);
  const [vol, setVol] = useState(Math.round(a.markets.volatility.value * 100) / 100);
  const basisStd = d.fit.residualStd || 0.06;
  const reduce = useReducedMotion();

  const price = useMemo(() => priceCap({ forward: p.priceToday.forward, strikeOffset: offset, sigma: vol, monthlyGallons: Array(12).fill(gallons * share), hedgeRatio: a.wholesale.slopeAnnual }), [p, offset, vol, gallons, share, a.wholesale.slopeAnnual]);
  const s = scenario({ gallonsPerMonth: gallons, coveredShare: share, priceRise: rise, strikeOffset: offset, premiumPerMonth: price.premiumPerMonth, basisStd });
  const presets: [string, number][] = [["60 cents", 0.6], ["A bad year (once in 20 years)", Math.round(d.avgPricePaidTtm * d.shocks[1].pct * 20) / 20], [`Like ${monthLabel(p.settlement.month, true)}`, likeSettle]];
  const max = Math.max(s.extraCost, 1);
  const w = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  const plates = plateBounds(offset, 3);
  const crossed = plates.filter((x) => rise >= x.hi - 1e-6).length;
  const covered = gallons * share;
  const offsetOptions = Array.from(new Set([0.1, 0.25, 0.5, 1, p.strikeOffset])).sort((x, y) => x - y);

  const company = a.company?.trim() || "your business";
  const line = (label: string, value: number, tone: string, note?: string) => (
    <li className="flex min-w-0 items-baseline gap-3">
      <span aria-hidden className="w-4 shrink-0 text-[15px] text-faint">→</span>
      <span className="min-w-0 text-[15px] leading-[1.45] text-ink2 sm:text-[16px]">
        {label} <span className={cx("num font-[550]", tone)}>{usd(value)}</span>{note && <span className="text-[14px] text-muted"> {note}</span>}
      </span>
    </li>
  );

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-6">
        <PageHead eyebrow={`One month for ${company}, using the gallons in your books`} title="What if diesel jumps?"
          lede="Move the price. Every number is simple arithmetic on your own books: gallons times the price rise, minus what CostShield would pay you back." />

        <Card>
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="text-[17px] text-ink2 sm:text-[19px]">If diesel rises by</span>
              <Rolling text={`$${rise.toFixed(2)}`} className="text-[26px] font-[550] tracking-[-0.02em] text-heat sm:text-[30px]" />
              <span className="text-[17px] text-ink2 sm:text-[19px]">a gallon</span>
            </p>
            <div role="group" aria-label="Examples" className="flex flex-wrap gap-1">
              {presets.map(([l, v]) => <PresetChip key={l} on={Math.abs(rise - Math.min(3, v)) < 1e-9} onClick={() => setRise(Math.min(3, v))}>{l}</PresetChip>)}
            </div>
          </div>

          <PriceRiseControl className="mt-6" value={rise} onChange={setRise} offset={offset} label="How much diesel rises, per gallon"
            valueText={`diesel up $${rise.toFixed(2)} a gallon; CostShield would pay you ${usd(s.payout)}`} />

          {/* The answer: what the month costs with protection, next to what it costs without. */}
          <div className="mt-8" aria-live="polite">
            <div className="flex flex-wrap items-end gap-x-4 gap-y-4 sm:gap-x-10">
              <div>
                <p className="text-[15px] leading-5 text-ink2">You&apos;re out</p>
                <Rolling text={usd(s.unhedged)} className="mt-1 text-[44px] font-[560] tracking-[-0.035em] text-ink sm:text-[72px]" />
              </div>
              <div className="pb-1 sm:pb-2.5">
                <p className="num text-[24px] font-[550] leading-none tracking-[-0.02em] text-heat sm:text-[32px]">{usd(s.exposedCost)}</p>
                <p className="mt-1.5 text-[14px] leading-5 text-muted">without protection</p>
              </div>
            </div>
            <p className="mt-3 text-[13px] leading-[1.5] text-muted">That month, before what protection costs: about <span className="num text-ink2">{usd(s.premium)}</span> a month if bought today<Ev e="A" />.</p>
          </div>

          <ol className="mt-6 space-y-2">
            {line("your fuel bill rises", s.extraCost, "text-ink", s.passedThrough > 0 ? `(your fuel surcharges pass ${usd(s.passedThrough)} of it to customers)` : undefined)}
            {line("CostShield would pay you back", s.payout, "text-jade", s.payout === 0 && rise > 0 ? `(the rise is still under the ${usd(offset, 2)} you cover yourself)` : undefined)}
          </ol>

          <div className="mt-7 text-[13px]">
            <div className="flex h-2 gap-[3px] overflow-hidden rounded-full" aria-hidden>
              {([[s.passedThrough, "bg-ink/20"], [s.payout, "bg-jade"], [s.unhedged, "bg-heat/70"]] as const).map(([v, c], i) => (
                <motion.div key={i} className={cx("h-full rounded-full", c)} initial={false} animate={{ width: w(v) }} transition={reduce ? { duration: 0 } : UI_SPRING} />
              ))}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-ink/20" />Passed on by your fuel surcharges</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-jade" />Paid back by CostShield</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-heat/70" />Still on you</span>
            </div>
            <p className="mt-3 max-w-[70ch] text-[12.5px] leading-[1.55] text-faint">Protection starts once diesel is up {usd(offset, 2)} a gallon. Above that, CostShield would pay back every cent on the <span className="num">{int(covered)}</span> gallons your customers don&apos;t cover; each lit block on the slider is 25 cents{crossed ? `, ${crossed} lit now` : ""}.</p>
          </div>
        </Card>

        <div className="grid items-start gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <Card className="space-y-5 self-start">
            <h2 className="text-[15px] font-medium leading-6 tracking-[-0.01em] text-ink">Your numbers</h2>
            <FineRange label="Gallons bought per month" value={gallons} min={500} max={40000} step={10} onChange={setGallons} fmt={int} />
            <FineRange label="Share of fuel your customers don't pay surcharges on" value={share} min={0} max={1} step={0.01} onChange={setShare} fmt={(v) => pct(v)} />
            <Segmented label="Price rise you cover yourself before protection starts" options={offsetOptions} value={offset} onChange={setOffset} fmt={(o) => `$${o.toFixed(2)}`} />
            <FineRange label="How jumpy diesel prices are (sets the price of protection)" value={vol} min={0.2} max={0.8} step={0.01} onChange={setVol} fmt={(v) => pct(v)} />
            <p className="text-xs leading-[1.5] text-faint">Starting values: gallons and surcharge share from your books<Ev e="E" />, price jumpiness from {a.markets.volatility.evidence === "V" ? "live Gemini prediction markets" : "a planning assumption"}<Ev e={a.markets.volatility.evidence} />.</p>
          </Card>
          <Card>
            <h2 className="text-[15px] font-medium leading-6 tracking-[-0.01em] text-ink">The month, line by line</h2>
            <div className="mt-2">
              <Row label="Extra fuel cost" hint={`${int(gallons)} gallons × $${rise.toFixed(2)}`}>{usd(s.extraCost)}</Row>
              <Row label="Passed on through fuel surcharges" hint={`${pct(1 - share)} of gallons, if surcharges keep pace`}>−{usd(s.passedThrough)}</Row>
              <Row label="Left for you to pay"><span className="text-heat">{usd(s.exposedCost)}</span></Row>
              <Row label="CostShield would pay you back" hint={`($${rise.toFixed(2)} − $${offset.toFixed(2)}, if above zero) × ${int(gallons * share)} protected gallons`}><span className="text-jade">−{usd(s.payout)}</span></Row>
              <Row label="You're out" hint={`${pct(s.offsetShare)} of the hit would be paid back`}>{usd(s.unhedged)}</Row>
              <Row label="What protection costs this month, if bought today" hint={`Estimated price: ${usd(price.premium)} a year, ${ppg(price.premiumPerGallon)} per protected gallon`}>{usd(s.premium)}<Ev e="A" /></Row>
              <Row label={<span className="font-medium text-ink">Effect on profit this month</span>} hint={`Without protection: ${usd(s.netWithoutCover)}`}><span className="text-base">{usd(s.net)}</span></Row>
            </div>
            <div className="mt-4"><Note tone="info" title="Your pump price can differ from the official price">CostShield would pay on the official Midwest diesel price (U.S. government data), not your pump price. Yours differs by about ±{ppg(basisStd)} a gallon in a typical month<Ev e={d.fit.method === "ledger-regression" ? "C" : "A"} />, so the real effect on {int(gallons * share)} gallons could be about {usd(s.basisBand)} better or worse (95% range).</Note></div>
          </Card>
        </div>
        <div className="flex justify-end"><Button onClick={onNext} size="lg">See a real payout<Arrow /></Button></div>
      </div>
    </MotionConfig>
  );
}


/* ------------------------------------------------------------------ payout and private settlement */

/** Gallons as the maths uses them, so a written-out sum can be checked by hand. */
const gal2 = (g: number) => g.toLocaleString("en-US", { maximumFractionDigits: 2 });

/**
 * The team's devnet settlement of the sample fleet's September 2026, run on Nov 20, 2026 at 3:12 AM Central.
 * Copied from the README ("Deployed program"); keep the two in step. It is the sample fleet's month only:
 * the screen claims "this settlement ran" for the sample fleet and that month, and for nothing else.
 */
const README_URL = "https://github.com/thejuliancasta/orange-cat#deployed-program";
const EARLIER_RUN = {
  month: "2026-09", when: "Nov 20, 2026 at 3:12 AM Central",
  txs: [
    ["eight steps opened", "5EcVnVPwuLLKudQEhm5p4nErLGkFS29vx7Jo6thwrHDR1nJuWGPDS5xKrPHzF5EaQHLjgDg8hxK2ZDBenrF5Y7jL"],
    ["official price posted", "3FYhzywtKP1hmRxN1Y1BmsBaaoW3YWiKugKndctb5A8NcbVKVcT7M1jAPKwoFvgHqkczNYVmhsCPSues4wca8a2Z"],
    ["first step paid privately", "2wTYb5MjiCKCWLNA6FVrnufXAWsfmhyCBhAimbWnjFXFCQnXrEsm61zHstiz5z6ZvgiXycqujN2HRQKngPC7pC9S"],
    ["unused step returned to the backer", "3zZyVtP2HHdRU5am7YRaddypcjYYebUfpF3KgHy26tUWT3V71iPPTi9rbar4L8gNwuABrnMaxiNyJEL3LKftHP7j"],
  ] as [string, string][],
};
const LINK = "text-jade underline decoration-jade/40 underline-offset-2 hover:decoration-jade";

/** Defaults from docs/SOLANA_PORT.md. The server's result is authoritative once a settlement has run. */
const DEFAULT_STEP = 0.25, LADDER_TOP = 2;

/**
 * The linear cap rounded down to whole steps: step i pays when index >= strike + i x step.
 * Triggers round up to a tenth of a cent, as lib/chain/server.ts and the landing page do.
 */
function ladder(index: number, strike: number, step: number, gallons: number) {
  const count = Math.round(LADDER_TOP / step);
  const triggers = Array.from({ length: count }, (_, i) => Math.ceil(Math.round((strike + (i + 1) * step) * 1e6) / 1000) / 1000);
  const hit = triggers.filter((t) => index >= t - 1e-9).length;
  return { count, triggers, hit, perStep: step * gallons, total: hit * step * gallons };
}

/** `sample` is true only for the bundled sample fleet, the one ledger the team settled on devnet. */
export function Payout({ a, sample = false, detail, onDetail }: { a: Analysis; sample?: boolean; detail: boolean; onDetail: (detail: boolean) => void }) {
  const d = a.diesel!, p = a.policy!;
  const company = a.company?.trim() || "Your business";
  const { status: st, failed, reload } = useChainStatus();
  const [log, setLog] = useState<StepEvent[]>([]);
  const [result, setResult] = useState<SettlementResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState(0);

  const settle = async () => {
    setRunning(true); setErr(null); setResult(null); setLog([]); setRunId((x) => x + 1);
    try {
      const res = await fetch("/api/settle", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ region: a.region, inceptionMonth: p.inceptionMonth, settleMonth: p.settlement.month, strikeOffset: p.strikeOffset, coveredGallons: p.settlement.coveredGallons, maxCoveredGallons: p.maxCoveredGallonsPerMonth }) });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? `Settlement failed (HTTP ${res.status}).`);
      let gotResult = false;
      await readNdjson<SettlementEvent>(res, (ev) => {
        if (ev.type === "step") setLog((l) => [...l, ev]);
        else if (ev.type === "result") { gotResult = true; setResult(ev.result); }
        else setErr(ev.message);
      });
      if (!gotResult) setErr((e) => e ?? "The settlement stream ended without a result. Nothing below is a confirmed payout.");
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setRunning(false); reload();
  };

  // Latest state per step id, in first-seen order, for the event log.
  const steps = useMemo(() => {
    const order: string[] = [], by = new Map<string, StepEvent>();
    for (const e of log) { if (!by.has(e.id)) order.push(e.id); by.set(e.id, e); }
    return order.map((id) => by.get(id)!);
  }, [log]);

  const explorer = result?.explorer ?? st?.explorer ?? DEFAULT_EXPLORER;
  const stepSize = result?.stepSize ?? DEFAULT_STEP;
  const strike = result?.strike ?? p.strike;
  const index = result?.indexMean ?? p.settlement.indexMean;
  const gallons = result?.coveredGallons ?? p.settlement.coveredGallons;
  const plan = ladder(index, strike, stepSize, gallons);
  const linear = result?.linearPayoutUsd ?? p.settlement.payout;
  const stepped = result ? result.payoutUsd : plan.total;
  const stage = useMemo(() => deriveStage(log, result, { strike: p.strike, stepSize: DEFAULT_STEP, count: Math.round(LADDER_TOP / DEFAULT_STEP), expectedMean: p.settlement.indexMean }), [log, result, p.strike, p.settlement.indexMean]);
  const net = p.totalPayout - p.priceAtInception.premium * (p.replay.length / 12);
  const month = monthLabel(p.settlement.month, true);
  const canRun = !!st?.configured && !running;
  // The chart opens on the settlement month, not on the month that happened to pay most.
  const settleIdx = p.replay.findIndex((r) => r.month === p.settlement.month);
  const [chartMonth, setChartMonth] = useState<number | undefined>(settleIdx >= 0 ? settleIdx : undefined);
  const off = !!st && !st.configured; // this server cannot settle (the hosted demo holds no keys)
  const ranEarlier = sample && p.settlement.month === EARLIER_RUN.month; // the team's devnet run was this ledger and this month
  const settled = !!result || ranEarlier;
  const paidSteps = result ? result.steps.filter((s) => s.paid).length : plan.hit;
  const allSteps = result ? result.steps.length : plan.count;
  const cents = Math.round(stepSize * 100);
  const started = running || log.length > 0 || !!result || !!err; // a run was started here: show it live in either view
  const earlierLinks = EARLIER_RUN.txs.map(([label, sig], i) => <span key={sig}>{i > 0 && ", "}<a href={txUrl(DEFAULT_EXPLORER, sig)} target="_blank" rel="noreferrer" className={LINK}>{label}</a></span>);

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-6">
        <PageHead eyebrow={st?.configured ? "Real prices, your gallons, a real Solana payment in test dollars" : "Real prices and your gallons, replayed. Nobody sold this policy"}
          title={result ? <>CostShield paid {company} {usd(result.payoutUsd)} in test dollars, privately.</> : <>Replay a real price spike: {month}</>}
          lede={<>Suppose {company} had bought protection in {monthLabel(p.inceptionMonth, true)}, when the official Midwest diesel price (U.S. government data) was {ppg(p.inceptionIndex)}. We replay the real prices against the gallons in its books. {st?.configured ? <>Then {month} is paid for real, in test dollars, on Solana&apos;s test network.</> : ranEarlier ? <>The team settled {month} on Solana&apos;s test network, in test dollars; the transactions are linked below.</> : <>This demo server does not send test payments; the sample fleet&apos;s devnet settlement is linked below.</>}</>} />

        {/* Simple view: one headline, the settlement month's two figures, one chart, one button. The rest is in the detailed analysis. */}
        <div className={cx("grid items-start gap-6", detail && "lg:grid-cols-[1.2fr_0.8fr]")}>
          <Card><div className="flex flex-col">
            <div className={detail ? undefined : "mt-6 border-t border-line/[0.08] pt-5"}>
              <h2 className="text-[15px] font-medium leading-6 tracking-[-0.01em] text-ink">Diesel price each month, and where protection starts</h2>
              <div className="mt-3">
                <PriceVsTrigger months={p.replay.map((r) => ({ label: monthLabel(r.month), price: r.index, payout: r.payout }))} trigger={p.strike} selected={chartMonth} onSelect={setChartMonth} readout="sentence" />
              </div>
            </div>
            {/* The settlement month counted two ways: the replay's formula, and what the program pays. */}
            <div className={detail ? "mt-5 border-t border-line/[0.08] pt-5" : "order-first"}>
              <p className="text-[13px] leading-5 text-muted">{month}, counted two ways</p>
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4">
                <div className="min-w-0">
                  <p className="flex min-h-10 items-end text-[13px] leading-5 text-ink2 sm:min-h-0">Historical replay</p>
                  <p className="num mt-1 text-[30px] font-[560] leading-none tracking-[-0.03em] text-ink sm:text-[36px]">{usd(linear)}</p>
                  <p className="mt-2 text-[12px] leading-[1.45] text-faint">Every cent above the line, on {int(gallons)} protected gallons</p>
                </div>
                <div className="min-w-0">
                  <p className="flex min-h-10 items-end text-[13px] leading-5 text-ink2 sm:min-h-0">{settled ? "Settled" : "Settles"} in {cents}-cent steps</p>
                  <p className="num mt-1 text-[30px] font-[560] leading-none tracking-[-0.03em] text-jade sm:text-[36px]">{usd(stepped)}</p>
                  <p className="mt-2 text-[12px] leading-[1.45] text-faint">{paidSteps} of {allSteps} steps × {usd(plan.perStep, 2)}{result ? ", from the settlement result" : ", worked out from the public price"}</p>
                </div>
              </div>
              <p className="mt-4 max-w-[70ch] text-[13px] leading-[1.55] text-muted">The Solana program can&apos;t read encrypted amounts, so it pays one full {cents}-cent step for every {cents} cents the price climbed above the line{linear - stepped < 0.5 ? "" : index - strike > LADDER_TOP ? `; ${usd(linear - stepped)} isn't paid: the part past the last full step, and anything above ${ppg(strike + LADDER_TOP)}` : `; the last ${usd(linear - stepped)} didn't fill a step and isn't paid`}.</p>
            </div>
          </div></Card>
          {detail && <Card>
            <h2 className="text-[15px] font-medium leading-6 tracking-[-0.01em] text-ink">The protection</h2>
            <div className="mt-2">
              <Row label="Bought">{monthLabel(p.inceptionMonth, true)}</Row>
              <Row label="Protection starts at" hint={`${ppg(p.inceptionIndex)} + ${usd(p.strikeOffset, 2)}`}>{ppg(p.strike)}</Row>
              <Row label="Protected gallons">{pct(p.coveredShare)}, max {int(p.maxCoveredGallonsPerMonth)}/mo</Row>
              <Row label="Extra fuel cost on protected gallons">{usd(p.totalExtraCost)}<Ev e="C" /></Row>
              <Row label={`Would have been paid back, ${p.replay.length} months`}><span className="text-jade">{usd(p.totalPayout)}</span><Ev e="C" /></Row>
              <Row label="Estimated cost of protection for those months">{usd(p.priceAtInception.premium * (p.replay.length / 12))}<Ev e="A" /></Row>
              <Row label={<span className="font-medium text-ink">Net benefit</span>}>{usd(net)}</Row>
            </div>
            <p className="mt-3 text-xs leading-[1.5] text-faint">2026 was one of the worst diesel years on record. In {pct(1 - (a.backtest?.shareOfCohortsPaid ?? 0.35))} of 12-month periods since 2015 this protection paid nothing. The replay pays every cent above the line; the devnet settlement below pays in 25-cent steps.</p>
          </Card>}
        </div>

        {detail && <div>
          <Table align={["l", "r", "r", "r", "r", "r"]} head={["Month", "Official price", "Above the line", "Protected gallons", "Would have paid", ""]}
            rows={p.replay.map((r) => [monthLabel(r.month), <span key="i" className={r.triggered ? "text-heat" : undefined}>{ppg(r.index)}</span>, r.triggered ? `+${ppg(r.index - r.strike)}` : "—", int(r.coveredGallons), r.triggered ? <span key="p" className="text-jade">{usd(r.payout)}</span> : "—",
              r.month === p.settlement.month ? (result ? <span key="s" className="font-medium text-jade">settled privately below</span> : <span key="s" className="text-ink2">settlement month</span>) : r.triggered ? <span key="t" className="text-ink2">would have paid</span> : <span className="text-faint" key="n">no money back</span>])} />
        </div>}

        <section className={detail ? "pt-10" : undefined}>
          {detail && <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-2xl">
              <h2 className="text-[24px] font-[550] leading-[1.1] tracking-[-0.025em] text-ink sm:text-[30px]">{!off ? <>Settle {month} privately on Solana devnet</> : ranEarlier ? <>{month}, settled privately on Solana devnet</> : <>How {month} would settle privately on Solana devnet</>}</h2>
              <p className="mt-3 text-[14px] leading-[1.55] text-muted">The backer sets the money aside in advance. The official price is posted on the blockchain with a fingerprint of the government data file. A Solana program checks the price, and only {company} can collect. Amounts stay encrypted. Money is test dollars: 1 test dollar = $1, nothing scaled.</p>
              {!off && <p className="mt-2 text-[13px] text-ink2">Test mode: paid in test dollars on Solana devnet. No wallet needed.</p>}
            </div>
            {st?.configured && <SettleButton onClick={settle} disabled={!canRun} running={running} again={!!result} />}
          </div>}

          {!st && !failed ? <p className="mt-5 text-[13px] text-muted">Checking the settlement program on Solana devnet…</p>
            : !st ? <div className="mt-5"><Note tone="warn" title="Could not read the settlement status">{failed} The replay and the step plan below are unaffected. Nothing has been sent on chain.</Note></div>
            : !st.configured ? <div className={detail ? "mt-5" : undefined}>{ranEarlier
                ? <Note tone="good" title="This settlement ran on Solana devnet">
                    The team ran it on {EARLIER_RUN.when}, in test dollars. See it on Solana Explorer: {earlierLinks}. Explorer shows who signed and that a private transfer happened, not the amounts.
                    <span className="mt-2 block">This demo server holds no keys, so it does not send the payment again: nothing here is a new payout. The full list of transactions is in the <a href={README_URL} target="_blank" rel="noreferrer" className={LINK}>README</a>, and Judge mode says what this server is missing.</span>
                  </Note>
                : <Note tone="warn" title="This demo server does not settle your month">
                    It holds no keys, so nothing has been sent on chain for this ledger and no payout is shown. The replay and the step plan are unaffected.
                    <span className="mt-2 block">The same settlement ran on Solana devnet for the sample fleet&apos;s {monthLabel(EARLIER_RUN.month, true)}, on {EARLIER_RUN.when}, in test dollars: {earlierLinks}. Explorer shows who signed and that a private transfer happened, not the amounts. The full list is in the <a href={README_URL} target="_blank" rel="noreferrer" className={LINK}>README</a>, and Judge mode says what this server is missing.</span>
                  </Note>}</div>
            : detail && (
              <div className="mt-8">
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-[13px] md:grid-cols-3 lg:grid-cols-6">
                  <div className="min-w-0"><p className="text-xs text-muted">Solana program</p>{st.programId ? <AddrLink addr={st.programId} explorer={st.explorer} /> : <span className="text-faint">not set</span>}</div>
                  <div className="min-w-0"><p className="text-xs text-muted">Test-dollar token</p>{st.mint ? <AddrLink addr={st.mint} explorer={st.explorer} /> : <span className="text-faint">not set</span>}</div>
                  <div className="min-w-0"><p className="truncate text-xs text-muted">{company} wallet</p>{st.fleet ? <AddrLink addr={st.fleet} explorer={st.explorer} /> : <span className="text-faint">not set</span>}</div>
                  <div className="min-w-0"><p className="text-xs text-muted">{company} private balance</p><p className="num font-medium text-ink2">{st.fleetPrivateBalance !== undefined ? tusd(st.fleetPrivateBalance) : "—"}</p></div>
                  <div className="min-w-0"><p className="text-xs text-muted">Backer private balance</p><p className="num font-medium text-ink2">{st.underwriterPrivateBalance !== undefined ? tusd(st.underwriterPrivateBalance, 0) : "—"}</p></div>
                  <div className="min-w-0"><p className="text-xs text-muted">Policies opened</p><p className="num font-medium text-ink2">{st.policies ?? "—"}</p></div>
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-faint"><LockIcon className="text-cipher" />Private balances are encrypted on chain. In test mode the server decrypts them with each party&apos;s own key.</p>
              </div>
            )}

          {!detail && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <Button variant="secondary" onClick={() => onDetail(true)}>Show the detailed analysis</Button>
              {st?.configured ? <SettleButton onClick={settle} disabled={!canRun} running={running} again={!!result} />
                : off ? <a href={txUrl(DEFAULT_EXPLORER, EARLIER_RUN.txs[2][1])} target="_blank" rel="noreferrer"
                    className="group/btn inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-control bg-jade px-6 text-[15px] font-medium text-jade-ink transition-[background-color,transform] duration-150 hover:bg-jade/90 active:scale-[0.98]">
                    {ranEarlier ? "See the payout on Solana Explorer" : "See the sample fleet's payout on Explorer"}<Arrow /></a>
                : null}
            </div>
          )}

          {(detail || started) && <Card className="mt-8"><div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <div className="min-w-0 lg:sticky lg:top-6 lg:self-start">
              <h3 className="mb-3 text-[15px] font-medium leading-6 tracking-[-0.01em] text-ink">Where the money is</h3>
              <SettlementStage key={runId} m={stage} company={company} explorer={explorer} running={running} underwriterBalance={st?.underwriterPrivateBalance} />
            </div>
            <div className="min-w-0">
              <h3 className="mb-3 text-[15px] font-medium leading-6 tracking-[-0.01em] text-ink">What happens on Solana, live</h3>
              <EventLog steps={steps} explorer={explorer} empty={st?.configured ? "Each step appears here as Solana devnet confirms it, with its transaction." : off ? "Nothing has been sent on chain from this server." : "Nothing has been sent on chain."} />
              {err && <ErrorBanner message={err} />}
            </div>
          </div></Card>}

          {detail && <div className="mt-10 px-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-[15px] font-medium leading-6 tracking-[-0.01em] text-ink">Why the money comes in {Math.round(stepSize * 100)}-cent steps</h3>
              <span className="text-xs text-faint">{result ? "from the settlement result" : `expected, at the default ${usd(stepSize, 2)} step`}</span>
            </div>
            <p className="mt-1.5 max-w-[80ch] text-[13px] leading-[1.55] text-muted">The Solana program can&apos;t read encrypted amounts, so it can&apos;t work out the exact amount owed. Instead the money is split into {plan.count} steps up to {ppg(strike + LADDER_TOP)}. Each step holds {usd(stepSize, 2)} × {gal2(gallons)} gallons = {usd(plan.perStep, 2)}, set aside in advance, and pays when the official price reaches its level. The program only compares public prices; it never needs to see an amount.</p>
            <div className="mt-4 grid gap-4 text-[13px] sm:grid-cols-3">
              <div><p className="text-xs text-muted">Every cent above the line</p><p className="num mt-1 text-[24px] font-[550] leading-none tracking-[-0.03em] text-ink">{usd(linear, 2)}</p><p className="mt-1.5 text-xs text-faint">({ppg(index)} − {ppg(strike)}) × {gal2(gallons)} gal</p></div>
              <div><p className="text-xs text-muted">Paid in steps</p><p className="num mt-1 text-[24px] font-[550] leading-none tracking-[-0.03em] text-jade">{usd(stepped, 2)}</p><p className="mt-1.5 text-xs text-faint">{result ? result.steps.filter((s) => s.paid).length : plan.hit} of {result ? result.steps.length : plan.count} steps × {usd(plan.perStep, 2)}</p></div>
              <div><p className="text-xs text-muted">Difference</p><p className="num mt-1 text-[24px] font-[550] leading-none tracking-[-0.03em] text-ink">{usd(Math.max(0, linear - stepped), 2)}</p><p className="mt-1.5 text-xs text-faint">Rounded down to a full step{index - strike > LADDER_TOP ? `, and nothing above ${ppg(strike + LADDER_TOP)}` : ""}</p></div>
            </div>
          </div>}

          {result && <SettledCard r={result} company={company} />}

          {detail && <div className="mt-6"><Note tone="info" title="What is real and what is not">Real: the Solana program on the test network (devnet), the private transfers (Helius Privacy Rings), the transactions and the U.S. government prices. Test money: test dollars are worth nothing. Not real yet: the policy (nobody sold it), the price poster (one key that recomputes the official monthly average, not a decentralised feed) and the business wallet (in test mode the server holds every party&apos;s keys). Helius&apos;s prover sees amounts inside secure hardware. Gemini markets do not pay out here.</Note></div>}
        </section>

        {result && <TwoViews r={result} company={company} />}
        {detail && <div><Button variant="secondary" onClick={() => onDetail(false)}>Show the simple view</Button></div>}
      </div>
    </MotionConfig>
  );
}

function SettleButton({ onClick, disabled, running, again }: { onClick: () => void; disabled: boolean; running: boolean; again: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-busy={running}
      className={cx("inline-flex h-12 shrink-0 items-center justify-center gap-2.5 rounded-control px-6 text-[15px] font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed",
        running ? "bg-well text-ink2" : disabled ? "bg-well text-faint" : "bg-jade text-jade-ink hover:bg-jade/90")}>
      {running && <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden className="animate-spin text-jade [animation-duration:1.1s]"><circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" /><path d="M10 2.5a7.5 7.5 0 0 1 7.5 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>}
      {!running && <LockIcon />}
      {running ? "Settling…" : again ? "Run again" : "Settle privately"}
    </button>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <motion.p role="alert" className="mt-5 flex gap-2 text-[13.5px] leading-[1.55] text-rust"
      initial={{ x: 0, opacity: 0 }} animate={{ x: [0, -6, 5, -3, 2, 0], opacity: 1 }} transition={{ duration: 0.38, ease: "easeOut" }}>
      <span aria-hidden>–</span><span>{message}</span>
    </motion.p>
  );
}

function SettledCard({ r, company }: { r: SettlementResult; company: string }) {
  const paid = r.steps.filter((s) => s.paid);
  const shown = useCountUp(r.payoutUsd, true, { duration: 1.1 });
  return (
    <motion.div className="mt-14 space-y-12" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={UI_SPRING}>
      <div className="pt-6">
        <p className="flex items-center gap-2 text-[13px] text-muted"><LockIcon className="text-cipher" />Paid privately to {company}</p>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-3">
          <span className="num text-[44px] font-[550] leading-none tracking-[-0.03em] text-ink sm:text-[52px]">{shown.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span className="text-[22px] font-medium text-muted">test dollars</span>
        </p>
        <p className="mt-3 max-w-[80ch] text-[15px] leading-[1.55] text-ink2">This payout is a real Solana devnet transaction; the amount is encrypted for everyone except the business and anyone it shares a read-only key with.</p>
        <p className="mt-2 max-w-[80ch] text-[14px] leading-[1.55] text-muted">{paid.length} of {r.steps.length} steps of {Math.round(r.stepSize * 100)} cents a gallon on {int(r.coveredGallons)} protected gallons (paying every cent above the line would be {usd(r.linearPayoutUsd, 2)}). Official price {ppg(r.indexMean)}, recomputed by the server from U.S. government data; protection started at {ppg(r.strike)}.</p>
        <dl className="mt-5 grid gap-4 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
          <div className="min-w-0"><dt className="text-muted">{company} private balance</dt><dd className="num mt-1 text-ink2">{tusd(r.fleetView.balanceBefore)} → {tusd(r.fleetView.balanceAfter)}</dd></div>
          <div className="min-w-0"><dt className="text-muted">Policy, month</dt><dd className="mt-1 text-ink2"><span className="break-all font-mono text-[12px]">{r.policyId}</span>, {monthLabel(periodYm(r.period), true)}</dd></div>
          <div className="min-w-0"><dt className="text-muted">Official price posting{r.txs.reportAlreadyOnChain ? " (already posted, reused)" : ""}</dt><dd className="mt-1"><TxChip sig={r.txs.report} explorer={r.explorer} /></dd></div>
          <div className="min-w-0"><dt className="text-muted">Government data fingerprint</dt><dd className="mt-1"><HashChip hash={r.sourceHash} /></dd></div>
        </dl>
      </div>

      <div>
        <h3 className="text-[15px] font-medium leading-6 tracking-[-0.01em] text-ink">On Solana: one account per step</h3>
        <div className="mt-2">
          <Table align={["l", "r", "r", "l", "l"]} head={["Step", "Pays when price ≥", "Test dollars", "Status", "Payment"]} rows={r.steps.map((s) => [
            <span key="i" className="inline-flex items-center gap-2 whitespace-nowrap">Step {s.index} <AddrLink addr={s.account} explorer={r.explorer} className="text-[11px]" /></span>,
            ppg(s.triggerPrice),
            <span key="a" className="inline-flex items-center justify-end gap-2 whitespace-nowrap">{tusd(s.amount)}<span className="inline-flex items-center gap-1 text-[11.5px] text-cipher"><LockIcon />encrypted on chain</span></span>,
            s.paid ? <span key="s" className="font-medium text-jade">paid</span> : s.triggered ? <span key="s" className="font-medium text-heat">due, not collected</span> : <span key="s" className="text-muted">price not reached</span>,
            s.releaseTx ? <TxLink key="t" sig={s.releaseTx} explorer={r.explorer} /> : <span key="t" className="text-faint">{s.triggered ? "pending" : "back to the backer"}</span>,
          ])} />
        </div>
        {r.txs.reclaim && <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">Unused money went back to the backer: <TxChip sig={r.txs.reclaim} explorer={r.explorer} /></p>}
      </div>

      <div>
        <h3 className="text-[15px] font-medium leading-6 tracking-[-0.01em] text-ink">Refused on Solana, as designed</h3>
        <ul className="mt-3 grid gap-x-10 gap-y-4 text-[13px] md:grid-cols-2">
          {([["Someone other than the official price source tried to post a price", r.rejections.stranger], ["The business tried to collect the same step twice", r.rejections.duplicate]] as const).map(([l, why]) => (
            <li key={l} className="flex items-start gap-3">
              <span role="img" aria-label="refused" className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center text-rust"><svg viewBox="0 0 12 12" width="11" height="11"><path d="M2.5 2.5 9.5 9.5M9.5 2.5 2.5 9.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg></span>
              <div className="min-w-0"><p className="font-medium text-ink">{l}</p><p className="mt-0.5 break-words leading-[1.5] text-muted">{why}</p></div>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}
