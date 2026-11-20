"use client";
import { motion } from "motion/react";
import type { Analysis } from "@/lib/engine/pipeline";
import { int, monthLabel, pct, ppg, usd, usdK } from "@/lib/format";
import { Arrow, Button, Card, CardTitle, Check, Ev, Meter, Note, PageHead, Row, Stat, Tag, cx, display } from "./ui";
import { Bars, LineChart } from "./charts";
import { CountUp } from "./fx/count";
import { ExposureColumns } from "./fx/exposure-columns";
import { PriceVsTrigger } from "./fx/price-vs-trigger";
import { SPRING_FLUID, tok } from "./fx/motion";

const MARKET = new Set(["fleet_fuel", "natural_gas", "electricity", "interest"]);
/** Inner panel: a hairline sub-surface inside a card. */
const SUB = "rounded-[10px] border border-line/[0.08] bg-panel/60 p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]";

/** Content group that settles into place when it first scrolls into view. It is never hidden, so captures and prints show everything. */
function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div initial={{ y: 14 }} whileInView={{ y: 0 }} viewport={{ once: true, margin: "0px 0px -40px 0px" }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }} className={className}>{children}</motion.div>
  );
}

/** A list line with no divider rule: rhythm and a hover tone separate items. */
function Line({ children, className }: { children: React.ReactNode; className?: string }) {
  return <li className={cx("py-2 text-[14px] leading-5", className)}>{children}</li>;
}

type DetailProps = { detail: boolean; onDetail: (detail: boolean) => void };

/** Simple or Detailed. Simple keeps the findings and every "not available" label; Detailed adds the working behind them. */
function DetailSwitch({ detail, onDetail }: DetailProps) {
  return (
    <div className="flex items-center justify-end gap-2.5 text-[12.5px] text-muted">
      <span>View</span>
      <div role="group" aria-label="Level of detail" className="inline-flex rounded-[8px] border border-line/[0.1] bg-panel p-0.5">
        {[false, true].map((v) => (
          <button key={String(v)} type="button" aria-pressed={detail === v} onClick={() => onDetail(v)}
            className={cx("h-7 rounded-[6px] px-3 text-[12.5px] font-[510] transition-colors duration-150 ease-out", detail === v ? "bg-jade text-jade-ink" : "text-ink2 hover:text-ink")}>
            {v ? "Detailed" : "Simple"}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepFooter({ detail, onDetail, onNext, next }: DetailProps & { onNext: () => void; next: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <Button variant="secondary" onClick={() => onDetail(!detail)}>{detail ? "Show the simple view" : "Show the detailed analysis"}</Button>
      <Button onClick={onNext} size="lg">{next}<Arrow /></Button>
    </div>
  );
}

export function Overview({ a, onNext, detail, onDetail }: { a: Analysis; onNext: () => void } & DetailProps) {
  const f = a.financials, d = a.diesel, pool = a.pool;
  const noInstrument = a.others.filter((o) => o.verdict === "no instrument");
  const small = a.others.filter((o) => o.verdict !== "no instrument");
  const top = f.categories[0];
  const maxNet = d ? Math.max(...d.shocks.map((s) => s.netImpact), 1) : 1;
  return (
    <div className="space-y-4">
      <PageHead eyebrow={`${a.company ?? "Your business"}, ${monthLabel(f.ttm[0])} to ${monthLabel(f.ttm[f.ttm.length - 1])}`}
        title={d?.material ? `Diesel is your biggest risk: a bad year would cost you ${usd(d.shocks[1].netImpact)}${d.shocks[1].pctOfProfit ? `, ${d.shocks[1].pctOfProfit.toFixed(1)} times your yearly profit` : ""}.` : "We found no cost risk worth protecting."}
        lede={<>We analyzed {int(a.lineCount)} transactions over {f.months.length} months. {d?.material
          ? <>Fuel is {pct(d.shareOfRevenue)} of your revenue and its price is set by a market you do not control. Most of your other costs either do not follow a market or are too small to matter.</>
          : <>None of your market-driven costs is large enough against profit to justify paying for protection. Repricing or setting cash aside is the better tool.</>}</>} />
      <DetailSwitch detail={detail} onDetail={onDetail} />

      <Card>
        <div className="grid grid-cols-2 gap-x-6 gap-y-7 md:grid-cols-4">
          <Stat label="Operating expenses, last 12 months" value={<CountUp value={f.expensesTtm} format={usdK} />} sub={`${usdK(f.expensesTtm / 12)} a month`} ev="C" />
          <Stat label="Revenue, last 12 months" value={<CountUp value={f.revenueTtm} format={usdK} />} ev="C" />
          <Stat label="Operating profit" value={<CountUp value={f.operatingProfitTtm} format={(v) => usd(v)} />} sub={`${pct(f.marginTtm, 1)} margin`} ev="C" />
          <Stat label="Largest cost" value={<CountUp value={top.shareOfExpenses * 100} format={(v) => `${v.toFixed(0)}%`} />} sub={detail ? `${top.label}, concentration index ${f.hhi.toFixed(2)}` : top.label} ev="C" />
        </div>
      </Card>

      <Reveal>
        <Card>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <CardTitle>Where your money goes</CardTitle>
            <span className="text-[12px] text-faint">Share of spending, and how much it jumps month to month</span>
          </div>
          <div className="mt-5"><ExposureColumns categories={f.categories.slice(0, 9)} market={MARKET} topTtm={top.ttm} /></div>
          {detail && <p className="mt-4 text-[12px] leading-[1.55] text-faint">Swing is the standard deviation of monthly spend divided by its average. {pct(f.classifiedShare)} of spend was classified by rule; anything unmatched is shown as unclassified rather than guessed.</p>}
        </Card>
      </Reveal>

      {d && (
        <Reveal className={detail ? "grid gap-4 lg:grid-cols-[0.92fr_1.08fr]" : undefined}>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className={cx("text-[20px] leading-[1.15]", display)}>Diesel prices</h2>
              <span className="flex gap-1.5"><Tag tone="neutral">Biggest risk</Tag><Tag tone={d.material ? "warn" : "neutral"}>{d.material ? "Material" : "Not material"}</Tag></span>
            </div>
            <p className="mt-3 text-[13.5px] leading-[1.6] text-muted">
              You bought about {int(d.gallonsTtm)} gallons for {usd(d.spendTtm)} in the last 12 months. In a 1-in-20 price year that bill rises {pct(d.shocks[1].pct)}.
              After the fuel surcharges your contract customers already pay, about <span className="font-medium text-ink">{usd(d.shocks[1].netImpact)}</span> lands on you{d.shocks[1].pctOfProfit ? <>, which is <span className="font-medium text-ink">{d.shocks[1].pctOfProfit.toFixed(1)} times</span> your annual operating profit</> : null}.
            </p>
            <ul className="mt-5 grid gap-3.5" aria-label="Price shocks">
              {d.shocks.map((s, i) => (
                <li key={s.label}>
                  <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                    <span className="text-ink2">{s.label}</span>
                    <span className="num font-medium text-ink">{usd(s.netImpact)} <span className="font-normal text-faint">cost to you</span></span>
                  </div>
                  <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-line/10">
                    <motion.div className="h-full rounded-full bg-heat/75" initial={{ width: 0 }} whileInView={{ width: `${(s.netImpact / maxNet) * 100}%` }} viewport={{ once: true }} transition={{ ...SPRING_FLUID, delay: i * 0.08 }} />
                  </div>
                  <p className="num mt-1 text-[12px] text-faint">Fuel bill +{pct(s.pct)}, {s.pctOfProfit ? `${s.pctOfProfit.toFixed(1)}x profit` : "profit ratio n/a"}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12px] leading-[1.55] text-faint">Shock sizes are calculated from {d.shocks[0].basis}.<Ev e="C" /> &quot;Cost to you&quot; applies to the {pct(d.unsurchargedShare)} of gallons not covered by a surcharge.<Ev e="E" /></p>
          </Card>

          {detail && <Card>
            <CardTitle>Your price per gallon follows the official {d.regionLabel} diesel price</CardTitle>
            <p className="mt-1.5 text-[13.5px] leading-[1.6] text-muted">
              {d.fit.method === "ledger-regression"
                ? <>R² {d.fit.r2.toFixed(2)} on {d.fit.n} monthly changes.<Ev e="C" /> You pay about {ppg(Math.abs(d.fit.levelBasis))} {d.fit.levelBasis < 0 ? "below" : "above"} the index, and month to month your price strays from it by about ±{ppg(d.fit.residualStd)}. That gap is the basis risk an index payout cannot remove.</>
                : <>{d.fit.note}<Ev e="A" /></>}
            </p>
            <div className="mt-4">
              <LineChart height={280} x={d.monthly.map((m) => monthLabel(m.month))} yFmt={(v) => `$${v.toFixed(2)}`}
                lines={[{ label: `EIA ${d.regionLabel} retail diesel`, color: tok("faint"), values: d.monthly.map((m) => m.index), dashed: true }, { label: "Price you paid (fuel-card lines with gallons)", color: tok("heat"), values: d.monthly.map((m) => m.pricePaid), width: 2.4 }]} />
            </div>
          </Card>}
        </Reveal>
      )}

      <Reveal className={detail ? "grid gap-4 lg:grid-cols-[1.08fr_0.92fr]" : undefined}>
        {!detail ? null : d && pool ? (
          <Card>
            <div className="flex items-center justify-between gap-3"><CardTitle>Risk pool</CardTitle><Tag tone={pool.status === "member" ? "good" : "warn"}>{pool.status}</Tag></div>
            <p className="mt-2 break-all font-mono text-[12.5px] text-ink2">{pool.poolId}</p>
            <p className="mt-1.5 text-[13.5px] leading-[1.6] text-muted">{pool.reasoning}</p>
            <div className="mt-4 flex items-center gap-3"><div className="flex-1"><Meter value={pool.confidence} label="Pool confidence" /></div><span className="num text-[13px] font-medium text-ink">{pct(pool.confidence)} confidence</span></div>
            <ul className="mt-5 grid gap-3">
              {pool.criteria.map((c) => (<li key={c.name} className="flex gap-3 text-[13.5px]"><Check ok={c.pass} /><div className="min-w-0"><p className="leading-5 text-ink">{c.name}{c.hard && <span className="ml-2 text-[12px] text-faint">required</span>}</p><p className="mt-0.5 text-[12.5px] leading-[1.5] text-muted">{c.detail}</p></div></li>))}
            </ul>
            <div className="mt-5"><Note tone="info" title="A pool is not a policy"><span>A pool groups businesses whose payouts move on the same index, so one hedge can cover all of them. Protection also needs a liquid hedge and a licensed company to owe the payout. See the next step.</span></Note></div>
          </Card>
        ) : <div className="hidden lg:block" />}
        <div className={cx("grid content-start gap-4", !detail && "md:grid-cols-2")}>
          <Card>
            <CardTitle>Costs nobody can protect</CardTitle>
            <p className="mt-1.5 text-[13.5px] leading-[1.6] text-muted">{pct(noInstrument.reduce((s, o) => s + o.spendTtm, 0) / f.expensesTtm)} of your spending. No index or traded instrument tracks these costs, so nobody can honestly sell you protection on them.</p>
            <ul className="mt-3">
              {noInstrument.slice(0, 6).map((o) => <Line key={o.category} className="flex items-center justify-between gap-4"><span className="text-ink2">{o.label}</span><span className="num shrink-0 text-muted">{usdK(o.spendTtm)}<span className="text-faint">, {pct(o.shareOfRevenue, 1)} of revenue</span></span></Line>)}
            </ul>
          </Card>
          <Card>
            <CardTitle>Follow a market, but too small to matter</CardTitle>
            <p className="mt-1.5 text-[13.5px] leading-[1.6] text-muted">These follow a market price, but a bad year would barely move your profit.</p>
            <ul className="mt-3">
              {small.map((o) => (<Line key={o.category}><div className="flex items-center justify-between gap-4"><span className="text-ink2">{o.label}</span><span className="num shrink-0 text-muted">{usdK(o.spendTtm)}{o.impact1in20 !== null && <span className="text-faint">, bad year +{usd(o.impact1in20)}</span>}</span></div><p className="mt-0.5 text-[12px] leading-[1.5] text-faint">{o.reason} Benchmark: {o.benchmark}.</p></Line>))}
            </ul>
          </Card>
        </div>
      </Reveal>

      {detail ? <Reveal>
        <Card>
          <CardTitle>How much to trust this</CardTitle>
          <div className="mt-3 grid gap-x-10 md:grid-cols-2">
            <Row label="Transactions read" hint={`${a.report.format}, header on row ${a.report.headerRow}`}>{int(a.report.imported)} of {int(a.report.rowsRead)}</Row>
            <Row label="Rows skipped" hint={a.report.skipped.map((s) => `${s.reason}: ${s.count}`).join("; ") || "None"}>{a.report.skipped.reduce((s, x) => s + x.count, 0)}</Row>
            {d && <Row label="Fuel spend with gallons on the record" hint="The rest is estimated as dollars divided by the weekly index">{pct(d.gallonsObservedShare)}</Row>}
            {d && <Row label="Share of gallons not surcharged" hint={d.surcharge.note}>{pct(d.unsurchargedShare)}<Ev e="E" /></Row>}
          </div>
          <p className="mt-3 text-[12px] leading-[1.6] text-faint">Labels: <Ev e="V" /> verified public data, <Ev e="C" /> calculated from data, <Ev e="E" /> estimate, <Ev e="A" /> assumption.</p>
        </Card>
      </Reveal> : <p className="text-[12px] leading-[1.6] text-faint">The small letters next to numbers say where each one comes from: <Ev e="V" /> verified public data, <Ev e="C" /> calculated from data, <Ev e="E" /> estimate, <Ev e="A" /> assumption.</p>}
      <StepFooter detail={detail} onDetail={onDetail} onNext={onNext} next="Protect diesel" />
    </div>
  );
}

export function Protection({ a, onNext, detail, onDetail }: { a: Analysis; onNext: () => void } & DetailProps) {
  const d = a.diesel, p = a.policy, bt = a.backtest, m = a.markets;
  if (!d || !p || !bt) return <Card><p className="text-sm text-muted">No protection candidate: this ledger has no material, hedgeable exposure.</p></Card>;
  const crude = m.crude;
  const today = p.priceToday, then = p.priceAtInception;
  const waterfall: [string, string, string][] = [
    ["You", "Pay a monthly premium", "Premium in"],
    ["CostShield", "Measures exposure, prices, verifies the trigger. Holds no risk and no customer money.", "Software and distribution"],
    ["Licensed insurer", "Would legally owe the payout. None has agreed to: this is the missing piece.", "Not confirmed"],
    ["Reinsurer", "Would carry the gap between retail and wholesale diesel.", "Not confirmed"],
    ["ULSD options hedge", "Would fund the benchmark part of claims.", "Modelled"],
    ["Prediction markets", "0% of funding. Used as a price signal only.", "Live data"],
  ];
  return (
    <div className="space-y-4">
      <PageHead title={`When diesel goes above $${p.strike.toFixed(2)} a gallon, CostShield would pay you the difference.`}
        lede={`Over the last ${p.replay.length} months it would have paid you ${usd(p.totalPayout)}. It pays on the gallons you actually bought and could not pass on to customers, using the official Midwest diesel price (U.S. government data).`} />
      <DetailSwitch detail={detail} onDetail={onDetail} />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Diesel price vs. where protection starts</CardTitle><Tag tone="bad">Not available to buy</Tag></div>
        <div className="mt-5 grid gap-8 lg:grid-cols-[1.12fr_0.88fr]">
          <div className="min-w-0">
            <PriceVsTrigger trigger={p.strike} months={p.replay.map((r) => ({ label: monthLabel(r.month), price: r.index, payout: r.payout }))} />
          </div>
          <div className="min-w-0">
            <Row label="What it protects against">Diesel price increases, {d.regionLabel}</Row>
            <Row label="Price it follows" hint="Monthly average of the weekly price">Official {d.regionLabel} diesel price<Ev e="V" /></Row>
            <Row label="Protection starts at" hint={`If bought in ${monthLabel(p.inceptionMonth)}: that month's price ${ppg(p.inceptionIndex)} plus ${usd(p.strikeOffset, 2)}`}>${p.strike.toFixed(2)} a gallon</Row>
            <Row label="Money back each month">(price − ${p.strike.toFixed(2)}) × gallons covered</Row>
            <Row label="Gallons covered" hint="From your own records, not a fixed bet">{pct(p.coveredShare)} of purchases, up to {int(p.maxCoveredGallonsPerMonth)}/month</Row>
            <Row label="Cost of a bad year" hint="The kind that comes about once every 20 years">{usd(d.shocks[1].netImpact)}<Ev e="C" /></Row>
            <Row label="Most it can pay in 12 months">{usd(p.aggregateLimit)}</Row>
          </div>
        </div>
        <div className={cx("mt-6", SUB)}>
          <p className="text-[13.5px] font-medium text-ink">Not covered</p>
          <ul className="mt-2 grid gap-x-8 gap-y-1.5 text-[13px] leading-[1.5] text-muted md:grid-cols-2">
            {[
              "Gallons already billed to customers under a fuel surcharge.",
              `The first ${usd(p.strikeOffset, 2)} per gallon of any increase, and gallons above the monthly cap.`,
              `The gap between your pump price and the regional index (about ±${ppg(d.fit.residualStd || 0.06)} per gallon month to month).`,
              "Changes in how many miles you run, and every non-fuel cost.",
            ].map((t) => <li key={t} className="flex gap-2.5"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-faint" aria-hidden />{t}</li>)}
          </ul>
        </div>
      </Card>

      <Reveal>
        <Card>
          <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:gap-10">
            <div>
              <CardTitle>What protection costs</CardTitle>
              <p className="mt-1.5 text-[13.5px] leading-[1.6] text-muted">A model price, not a quote.{detail && " Hedge cost is a strip of 12 monthly call options on wholesale diesel (Black-76), divided by 0.70 to cover expenses and margin."}<Ev e="A" /></p>
              <p className="mt-3 text-[13.5px] leading-[1.6] text-muted">Cover costs {(today.premium / then.premium).toFixed(1)} times more after the 2026 spike, and the strike would sit at {ppg(p.todayIndex + p.strikeOffset)}. Protection is cheapest before you need it.</p>
              {detail && <p className="mt-3 text-[12px] leading-[1.55] text-faint">Volatility today: {m.volatility.source}<Ev e={m.volatility.evidence} /></p>}
            </div>
            <div className="grid content-start gap-3 sm:grid-cols-2">
              <div className={SUB}>
                <p className="text-[13px] text-muted">If bound in {monthLabel(p.inceptionMonth)}</p>
                <p className={cx("num mt-2 text-[28px] leading-none", display)}><CountUp value={then.premium} format={(v) => usd(v)} /></p>
                <p className="num mt-2.5 text-[12px] leading-[1.5] text-faint">{ppg(then.premiumPerGallon)} per covered gallon{detail && <>, wholesale {ppg(then.forward)}, {pct(then.sigma)} vol</>}</p>
              </div>
              <div className={SUB}>
                <p className="text-[13px] text-heat">If bound today</p>
                <p className={cx("num mt-2 text-[28px] leading-none", display)}><CountUp value={today.premium} format={(v) => usd(v)} /></p>
                <p className="num mt-2.5 text-[12px] leading-[1.5] text-faint">{ppg(today.premiumPerGallon)} per covered gallon{detail && <>, wholesale {ppg(today.forward)}, {pct(today.sigma)} vol</>}</p>
              </div>
            </div>
          </div>
        </Card>
      </Reveal>

      <Reveal>
        <Card>
          <CardTitle>Tested on every 12-month period since 2015</CardTitle>
          <div className="mt-5 grid gap-x-8 gap-y-6 sm:grid-cols-3">
            <Stat label="Periods that paid something" value={<CountUp value={bt.shareOfCohortsPaid * 100} format={(v) => `${v.toFixed(0)}%`} />} sub={`${bt.n} rolling periods`} ev="C" />
            <Stat label="Average money back" value={<CountUp value={bt.burnPerGallonYear} format={ppg} />} sub="per covered gallon a year" ev="C" />
            <Stat label="Fuel cost swings removed" value={<CountUp value={bt.varianceReduction * 100} format={(v) => `${v.toFixed(0)}%`} />} sub={`${pct(bt.recoveryInBad)} of the increase recovered in bad years`} ev="C" />
          </div>
          {detail && <div className={cx("mt-6", SUB)}>
            <h3 className="text-[14px] font-medium text-ink">Money back per gallon, by the month protection started</h3>
            <p className="mt-1.5 max-w-[80ch] text-[13px] leading-[1.6] text-muted">Each bar is one 12-month period on real {d.regionLabel} prices, with the strike {usd(p.strikeOffset, 2)} above the starting price. Most periods pay nothing. The ones that pay are the years that hurt.</p>
            <div className="mt-4"><Bars values={bt.cohorts.map((c) => c.payoutPerGallon)} labels={bt.cohorts.map((c) => c.inception.slice(0, 4))} readLabels={bt.cohorts.map((c) => monthLabel(c.inception.slice(0, 7), true))} fmt={(v) => `$${v.toFixed(2)}`} height={170} /></div>
          </div>}
        </Card>
      </Reveal>

      <Reveal>
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>Can this risk actually be protected?</CardTitle><Tag tone={m.status === "live" ? "good" : "warn"}>{m.status === "live" ? `Gemini live, ${m.scanned} markets scanned` : "Gemini unavailable"}</Tag></div>
          <p className="mt-1.5 max-w-[80ch] text-[13.5px] leading-[1.6] text-muted">We test each instrument against your cost, not against a price forecast. A market that does not track what you pay is rejected even if it is the only one listed.</p>
          {!detail && (
            <ul className="mt-4 grid gap-2">
              {a.hedges.map((h) => (
                <li key={h.name} className="flex items-center justify-between gap-4 text-[13.5px]">
                  <span className="min-w-0 text-ink2">{h.name} <span className="text-faint">({h.venue})</span></span>
                  <Tag tone={h.status.startsWith("viable") ? "good" : h.status === "signal only" ? "warn" : "bad"}>{h.status}</Tag>
                </li>
              ))}
            </ul>
          )}
          {detail && <div className="mt-4 grid gap-3 md:grid-cols-2">
            {a.hedges.map((h) => {
              const viable = h.status.startsWith("viable");
              return (
                <div key={h.name} className={SUB}>
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[12px] text-faint">{h.venue}</p><p className="mt-0.5 text-[14px] font-medium leading-5 text-ink">{h.name}</p></div><Tag tone={viable ? "good" : h.status === "signal only" ? "warn" : "bad"}>{h.status}</Tag></div>
                  <dl className="mt-3 grid gap-1.5 text-[13px]">
                    {([["Tracks retail diesel (12-month R²)", h.basisR2Annual !== null ? h.basisR2Annual.toFixed(2) : "n/a"], ["Tenor", h.tenor], ["Capacity", h.capacity], ["Cost", h.cost]] as const).map(([k, v]) => <div key={k} className="flex justify-between gap-4"><dt className="shrink-0 text-muted">{k}</dt><dd className="num text-right text-ink2">{v}</dd></div>)}
                  </dl>
                  <p className="mt-3 text-[12px] leading-[1.55] text-faint">{h.note}</p>
                </div>
              );
            })}
          </div>}
          {detail && crude && (
            <div className={cx("mt-4 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]", SUB)}>
              <div>
                <h3 className="text-[14px] font-medium text-ink">What the Gemini market is good for</h3>
                <p className="mt-2 text-[13.5px] leading-[1.6] text-muted">The <span className="font-mono text-[12.5px] text-ink2">{crude.ticker}</span> ladder is a set of yes/no contracts on whether Brent finishes above each price. Read together, their prices are the market&apos;s probability curve for oil. We fit that curve and get an implied volatility of <span className="font-medium text-ink">{pct(crude.implied.sigmaAnnual)}</span> and a median of <span className="font-medium text-ink">${crude.implied.median.toFixed(2)}</span> a barrel.<Ev e="V" /> That volatility is the input our cap price uses today, in place of an options data feed that costs five figures a year.</p>
                <p className="mt-2 text-[12px] leading-[1.55] text-faint">Fit quality R² {crude.implied.fitR2.toFixed(3)} on {crude.implied.nUsed} strikes. Brent explains {pct(crude.relation.r2Annual)} of 12-month retail diesel moves, against {pct(a.wholesale.r2Annual)} for ULSD.<Ev e="C" /></p>
              </div>
              <LineChart height={200} x={crude.implied.points.map((x) => `$${x.strike}`)} yFmt={(v) => pct(v)}
                lines={[{ label: "Ask", color: tok("line", 0.28), values: crude.implied.points.map((x) => x.ask) }, { label: "Bid", color: tok("line", 0.28), values: crude.implied.points.map((x) => x.bid) }, { label: `Chance Brent finishes above each price (${crude.implied.days.toFixed(0)} days out)`, color: tok("ink2"), values: crude.implied.points.map((x) => x.mid), width: 2.4 }]} />
            </div>
          )}
        </Card>
      </Reveal>

      <Reveal>
        <Card>
          <CardTitle>Who would pay you</CardTitle>
          <p className="mt-1.5 text-[13.5px] leading-[1.6] text-muted">CostShield would never owe or fund a payout itself. This is the chain a real product needs, and how much of it exists today.</p>
          {detail && <ol className="mt-4 grid gap-3 md:grid-cols-3">
            {waterfall.map(([who, what, status], i) => (
              <motion.li key={who} initial={{ y: 10 }} whileInView={{ y: 0 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: i * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
                className={cx("min-w-0", SUB)}>
                <div className="flex items-center justify-between gap-3"><span className="num text-[12px] font-[510] text-faint">{String(i + 1).padStart(2, "0")}</span><Tag tone={status === "Not confirmed" ? "bad" : status === "Modelled" ? "warn" : "neutral"}>{status}</Tag></div>
                <p className="mt-3 text-[14px] font-medium text-ink">{who}</p><p className="mt-1 text-[12.5px] leading-[1.55] text-muted">{what}</p>
              </motion.li>
            ))}
          </ol>}
          <div className="mt-4"><Note tone="warn" title="Why you cannot buy this yet">{a.eligibility.reasons.join(" ")}</Note></div>
        </Card>
      </Reveal>
      <StepFooter detail={detail} onDetail={onDetail} onNext={onNext} next="See it pay out" />
    </div>
  );
}
