"use client";
import type { Analysis } from "@/lib/engine/pipeline";
import { int, monthLabel, pct, ppg, usd, usdK } from "@/lib/format";
import { Button, Card, Check, Ev, Eyebrow, Note, PageHead, Row, Stat, Table, Tag, cx } from "./ui";
import { Bars, HBar, LineChart } from "./charts";

const MARKET = new Set(["fleet_fuel", "natural_gas", "electricity", "interest"]);

export function Overview({ a, onNext }: { a: Analysis; onNext: () => void }) {
  const f = a.financials, d = a.diesel, pool = a.pool;
  const noInstrument = a.others.filter((o) => o.verdict === "no instrument");
  const small = a.others.filter((o) => o.verdict !== "no instrument");
  const top = f.categories[0];
  return (
    <div className="space-y-6">
      <PageHead eyebrow={`${a.company ?? "Your business"} · ${monthLabel(f.ttm[0])} to ${monthLabel(f.ttm[f.ttm.length - 1])}`}
        title={d?.material ? "We found one cost risk worth protecting." : "We found no cost risk worth protecting."}
        lede={<>We analyzed {int(a.lineCount)} transactions over {f.months.length} months. {d?.material
          ? <>Fuel is {pct(d.shareOfRevenue)} of your revenue and its price is set by a market you do not control. Most of your other costs either do not follow a market or are too small to matter.</>
          : <>None of your market-driven costs is large enough against profit to justify paying for protection. Repricing or setting cash aside is the better tool.</>}</>} />

      <Card>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <Stat label="Operating expenses, last 12 months" value={usdK(f.expensesTtm)} sub={`${usdK(f.expensesTtm / 12)} a month`} ev="C" />
          <Stat label="Revenue, last 12 months" value={usdK(f.revenueTtm)} ev="C" />
          <Stat label="Operating profit" value={usd(f.operatingProfitTtm)} sub={`${pct(f.marginTtm, 1)} margin`} ev="C" />
          <Stat label="Largest cost" value={pct(top.shareOfExpenses)} sub={`${top.label} · concentration index ${f.hhi.toFixed(2)}`} ev="C" />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="flex items-baseline justify-between"><h2 className="text-[15px] font-medium">Where the money goes</h2><span className="text-xs text-faint">share of expenses · month-to-month swing</span></div>
          <ul className="mt-4 space-y-3">
            {f.categories.slice(0, 9).map((c) => (
              <li key={c.category}>
                <div className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="flex items-center gap-2 truncate"><span className="truncate">{c.label}</span>{MARKET.has(c.category) && <Tag tone={c.category === "fleet_fuel" ? "warn" : "neutral"}>market price</Tag>}</span>
                  <span className="num shrink-0 text-muted"><span className="text-ink">{usdK(c.ttm)}</span> · {pct(c.shareOfExpenses)} · ±{pct(c.cv)}</span>
                </div>
                <div className="mt-1.5"><HBar value={c.ttm} max={top.ttm} color={c.category === "fleet_fuel" ? "#9A5B06" : "#15181B"} /></div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-faint">Swing is the standard deviation of monthly spend divided by its average. {pct(f.classifiedShare)} of spend was classified by rule; anything unmatched is shown as unclassified rather than guessed.</p>
        </Card>

        {d && (
          <Card className="border-amber-line">
            <div className="flex items-center justify-between"><Eyebrow>Primary risk</Eyebrow><Tag tone={d.material ? "warn" : "neutral"}>{d.material ? "Material" : "Not material"}</Tag></div>
            <h2 className="mt-2 font-display text-[30px] leading-tight tracking-tight">Diesel prices</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              You bought about {int(d.gallonsTtm)} gallons for {usd(d.spendTtm)} in the last 12 months. In a 1-in-20 price year that bill rises {pct(d.shocks[1].pct)}.
              After the fuel surcharges your contract customers already pay, about <span className="font-medium text-ink">{usd(d.shocks[1].netImpact)}</span> lands on you{d.shocks[1].pctOfProfit ? <>, which is <span className="font-medium text-ink">{d.shocks[1].pctOfProfit.toFixed(1)} times</span> your annual operating profit</> : null}.
            </p>
            <div className="mt-4">
              <Table align={["l", "r", "r", "r"]} head={["Price shock", "Fuel bill", "Cost to you", "vs profit"]}
                rows={d.shocks.map((s) => [s.label, `+${pct(s.pct)}`, usd(s.netImpact), s.pctOfProfit ? `${s.pctOfProfit.toFixed(1)}x` : "n/a"])} />
            </div>
            <p className="mt-3 text-xs text-faint">Shock sizes are calculated from {d.shocks[0].basis}.<Ev e="C" /> &quot;Cost to you&quot; applies to the {pct(d.unsurchargedShare)} of gallons not covered by a surcharge.<Ev e="E" /></p>
          </Card>
        )}
      </div>

      {d && (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <h2 className="text-[15px] font-medium">Your price per gallon follows the {d.regionLabel} index</h2>
            <p className="mt-1 text-[13px] text-muted">
              {d.fit.method === "ledger-regression"
                ? <>R² {d.fit.r2.toFixed(2)} on {d.fit.n} monthly changes.<Ev e="C" /> You pay about {ppg(Math.abs(d.fit.levelBasis))} {d.fit.levelBasis < 0 ? "below" : "above"} the index, and month to month your price strays from it by about ±{ppg(d.fit.residualStd)}. That gap is the basis risk an index payout cannot remove.</>
                : <>{d.fit.note}<Ev e="A" /></>}
            </p>
            <div className="mt-4">
              <LineChart height={300} x={d.monthly.map((m) => monthLabel(m.month))} yFmt={(v) => `$${v.toFixed(2)}`}
                lines={[{ label: `EIA ${d.regionLabel} retail diesel`, color: "#8B9197", values: d.monthly.map((m) => m.index), dashed: true }, { label: "Price you paid (fuel-card lines with gallons)", color: "#9A5B06", values: d.monthly.map((m) => m.pricePaid), width: 2.4 }]} />
            </div>
          </Card>
          <Card>
            <div className="flex items-center justify-between"><Eyebrow>Risk pool</Eyebrow>{pool && <Tag tone={pool.status === "member" ? "good" : "warn"}>{pool.status}</Tag>}</div>
            {pool && (<>
              <p className="mt-2 font-mono text-[13px] text-ink">{pool.poolId}</p>
              <p className="mt-1 text-[13px] text-muted">{pool.reasoning}</p>
              <div className="mt-3 flex items-center gap-3"><div className="h-1.5 flex-1 rounded-full bg-paper"><div className="h-1.5 rounded-full bg-shield" style={{ width: pct(pool.confidence) }} /></div><span className="num text-[13px] font-medium">{pct(pool.confidence)} confidence</span></div>
              <ul className="mt-4 space-y-2.5">
                {pool.criteria.map((c) => (<li key={c.name} className="flex gap-2.5 text-[13px]"><Check ok={c.pass} /><div><p className="text-ink">{c.name}{c.hard && <span className="ml-1.5 text-[11px] text-faint">required</span>}</p><p className="text-xs text-muted">{c.detail}</p></div></li>))}
              </ul>
              <Note tone="info" title="A pool is not a policy"><span>A pool groups businesses whose payouts move on the same index, so one hedge can cover all of them. Protection also needs a liquid hedge and a licensed company to owe the payout. See the next step.</span></Note>
            </>)}
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-[15px] font-medium">Risks with no usable hedge</h2>
          <p className="mt-1 text-[13px] text-muted">{pct(noInstrument.reduce((s, o) => s + o.spendTtm, 0) / f.expensesTtm)} of your spending. No index or traded instrument tracks these costs, so nobody can honestly sell you protection on them.</p>
          <ul className="mt-3 divide-y divide-line/70">
            {noInstrument.slice(0, 6).map((o) => <li key={o.category} className="flex items-center justify-between py-2 text-[13px]"><span>{o.label}</span><span className="num text-muted">{usdK(o.spendTtm)} · {pct(o.shareOfRevenue, 1)} of revenue</span></li>)}
          </ul>
        </Card>
        <Card>
          <h2 className="text-[15px] font-medium">Market-driven, but too small to protect</h2>
          <p className="mt-1 text-[13px] text-muted">These follow a market price, but a bad year would barely move your profit.</p>
          <ul className="mt-3 divide-y divide-line/70">
            {small.map((o) => (<li key={o.category} className="py-2 text-[13px]"><div className="flex items-center justify-between"><span>{o.label}</span><span className="num text-muted">{usdK(o.spendTtm)}{o.impact1in20 !== null && <> · bad year +{usd(o.impact1in20)}</>}</span></div><p className="text-xs text-faint">{o.reason} Benchmark: {o.benchmark}.</p></li>))}
          </ul>
        </Card>
      </div>

      <Card>
        <h2 className="text-[15px] font-medium">How much to trust this</h2>
        <div className="mt-3 grid gap-x-10 md:grid-cols-2">
          <Row label="Transactions read" hint={`${a.report.format}, header on row ${a.report.headerRow}`}>{int(a.report.imported)} of {int(a.report.rowsRead)}</Row>
          <Row label="Rows skipped" hint={a.report.skipped.map((s) => `${s.reason}: ${s.count}`).join("; ") || "None"}>{a.report.skipped.reduce((s, x) => s + x.count, 0)}</Row>
          {d && <Row label="Fuel spend with gallons on the record" hint="The rest is estimated as dollars divided by the weekly index">{pct(d.gallonsObservedShare)}</Row>}
          {d && <Row label="Share of gallons not surcharged" hint={d.surcharge.note}>{pct(d.unsurchargedShare)}<Ev e="E" /></Row>}
        </div>
        <p className="mt-3 text-xs text-faint">Labels: <Ev e="V" /> verified public data, <Ev e="C" /> calculated from data, <Ev e="E" /> estimate, <Ev e="A" /> assumption. Open Judge mode for every source and formula.</p>
      </Card>
      <div className="flex justify-end"><Button onClick={onNext}>See protection options →</Button></div>
    </div>
  );
}

export function Protection({ a, onNext }: { a: Analysis; onNext: () => void }) {
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
    <div className="space-y-6">
      <PageHead eyebrow="Protection opportunities" title="One candidate: a cap on your diesel price."
        lede="If the monthly average diesel price in your region rises above a set level, the cap pays the difference on the gallons you actually bought and could not surcharge. Here are the terms, what it would have done, and who would have to stand behind it." />

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <div className="flex items-center justify-between"><h2 className="text-[15px] font-medium">Diesel price cap, 12 months</h2><Tag tone="bad">Not available to buy</Tag></div>
          <div className="mt-3">
            <Row label="Economic risk">Diesel price increases, {d.regionLabel}</Row>
            <Row label="Benchmark" hint="Monthly mean of the weekly print">EIA {d.regionLabel} retail diesel<Ev e="V" /></Row>
            <Row label="Trigger" hint={`Example as if bound in ${monthLabel(p.inceptionMonth)}: index ${ppg(p.inceptionIndex)} + ${usd(p.strikeOffset, 2)}`}>Monthly mean above {ppg(p.strike)}</Row>
            <Row label="Payout each month">(index − {ppg(p.strike)}) × covered gallons</Row>
            <Row label="Covered gallons" hint="Purchase-linked: from your own records, not a fixed bet">{pct(p.coveredShare)} of purchases, up to {int(p.maxCoveredGallonsPerMonth)}/month</Row>
            <Row label="Estimated loss in a 1-in-20 year">{usd(d.shocks[1].netImpact)}<Ev e="C" /></Row>
            <Row label="Maximum payout, 12 months">{usd(p.aggregateLimit)}</Row>
          </div>
          <div className="mt-4 rounded-xl bg-paper p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-faint">Not covered</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] text-muted">
              <li>Gallons already billed to customers under a fuel surcharge.</li>
              <li>The first {usd(p.strikeOffset, 2)} per gallon of any increase, and gallons above the monthly cap.</li>
              <li>The gap between your pump price and the regional index (about ±{ppg(d.fit.residualStd || 0.06)} per gallon month to month).</li>
              <li>Changes in how many miles you run, and every non-fuel cost.</li>
            </ul>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="text-[15px] font-medium">What it would cost</h2>
            <p className="mt-1 text-[13px] text-muted">A model price, not a quote. Hedge cost is a strip of 12 monthly call options on wholesale diesel (Black-76), divided by 0.70 to cover expenses and margin.<Ev e="A" /></p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-line p-4">
                <p className="text-xs text-muted">If bound in {monthLabel(p.inceptionMonth)}</p>
                <p className="num mt-1 font-display text-[30px] leading-none">{usd(then.premium)}</p>
                <p className="num mt-1.5 text-xs text-muted">{ppg(then.premiumPerGallon)} per covered gallon · wholesale {ppg(then.forward)} · {pct(then.sigma)} vol</p>
              </div>
              <div className="rounded-xl border border-amber-line bg-amber-soft p-4">
                <p className="text-xs text-amber">If bound today</p>
                <p className="num mt-1 font-display text-[30px] leading-none">{usd(today.premium)}</p>
                <p className="num mt-1.5 text-xs text-muted">{ppg(today.premiumPerGallon)} per covered gallon · wholesale {ppg(today.forward)} · {pct(today.sigma)} vol</p>
              </div>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-muted">Cover costs {(today.premium / then.premium).toFixed(1)} times more after the 2026 spike, and the strike would sit at {ppg(p.todayIndex + p.strikeOffset)}. Protection is cheapest before you need it.</p>
            <p className="mt-2 text-xs text-faint">Volatility today: {m.volatility.source}<Ev e={m.volatility.evidence} /></p>
          </Card>
          <Card>
            <h2 className="text-[15px] font-medium">What it would have done since 2015</h2>
            <div className="mt-3 grid grid-cols-3 gap-4">
              <Stat label="12-month periods that paid" value={pct(bt.shareOfCohortsPaid)} sub={`${bt.n} rolling periods`} ev="C" />
              <Stat label="Average payout" value={ppg(bt.burnPerGallonYear)} sub="per covered gallon a year" ev="C" />
              <Stat label="Cost swings removed" value={pct(bt.varianceReduction)} sub={`${pct(bt.recoveryInBad)} of the increase recovered in bad years`} ev="C" />
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <h2 className="text-[15px] font-medium">Payout per covered gallon, by the month cover started</h2>
        <p className="mt-1 text-[13px] text-muted">Each bar is one 12-month period on real {d.regionLabel} prices, with the strike {usd(p.strikeOffset, 2)} above the starting price. Most periods pay nothing. The ones that pay are the years that hurt.</p>
        <div className="mt-3"><Bars values={bt.cohorts.map((c) => c.payoutPerGallon)} labels={bt.cohorts.map((c) => c.inception.slice(0, 4))} fmt={(v) => `$${v.toFixed(2)}`} /></div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-[15px] font-medium">Can this risk actually be hedged?</h2><Tag tone={m.status === "live" ? "good" : "warn"}>{m.status === "live" ? `Gemini live · ${m.scanned} markets scanned` : "Gemini unavailable"}</Tag></div>
        <p className="mt-1 text-[13px] text-muted">We test each instrument against your cost, not against a price forecast. A market that does not track what you pay is rejected even if it is the only one listed.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {a.hedges.map((h) => (
            <div key={h.name} className={cx("rounded-xl border p-4", h.status.startsWith("viable") ? "border-shield-line bg-shield-soft/50" : "border-line")}>
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs text-faint">{h.venue}</p><p className="mt-0.5 text-sm font-medium">{h.name}</p></div><Tag tone={h.status.startsWith("viable") ? "good" : h.status === "signal only" ? "warn" : "bad"}>{h.status}</Tag></div>
              <dl className="mt-3 space-y-1.5 text-[13px]">
                {([["Tracks retail diesel (12-month R²)", h.basisR2Annual !== null ? h.basisR2Annual.toFixed(2) : "n/a"], ["Tenor", h.tenor], ["Capacity", h.capacity], ["Cost", h.cost]] as const).map(([k, v]) => <div key={k} className="flex justify-between gap-4"><dt className="shrink-0 text-muted">{k}</dt><dd className="num text-right">{v}</dd></div>)}
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-muted">{h.note}</p>
            </div>
          ))}
        </div>
        {crude && (
          <div className="mt-5 grid gap-5 border-t border-line pt-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <Eyebrow>What the Gemini market is good for</Eyebrow>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">The <span className="font-mono text-ink">{crude.ticker}</span> ladder is a set of yes/no contracts on whether Brent finishes above each price. Read together, their prices are the market&apos;s probability curve for oil. We fit that curve and get an implied volatility of <span className="font-medium text-ink">{pct(crude.implied.sigmaAnnual)}</span> and a median of <span className="font-medium text-ink">${crude.implied.median.toFixed(2)}</span> a barrel.<Ev e="V" /> That volatility is the input our cap price uses today, in place of an options data feed that costs five figures a year.</p>
              <p className="mt-2 text-xs text-faint">Fit quality R² {crude.implied.fitR2.toFixed(3)} on {crude.implied.nUsed} strikes. Brent explains {pct(crude.relation.r2Annual)} of 12-month retail diesel moves, against {pct(a.wholesale.r2Annual)} for ULSD.<Ev e="C" /></p>
            </div>
            <LineChart height={190} x={crude.implied.points.map((x) => `$${x.strike}`)} yFmt={(v) => pct(v)}
              lines={[{ label: "Ask", color: "#CFCBC2", values: crude.implied.points.map((x) => x.ask) }, { label: "Bid", color: "#CFCBC2", values: crude.implied.points.map((x) => x.bid) }, { label: `Chance Brent finishes above each price (${crude.implied.days.toFixed(0)} days out)`, color: "#0B5D4B", values: crude.implied.points.map((x) => x.mid), width: 2.4 }]} />
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-[15px] font-medium">Who would owe the payout</h2>
        <p className="mt-1 text-[13px] text-muted">CostShield would never owe or fund a payout itself. This is the chain a real product needs, and how much of it exists today.</p>
        <ol className="mt-4 grid gap-3 md:grid-cols-3">
          {waterfall.map(([who, what, status], i) => (
            <li key={who} className="rounded-xl border border-line p-4">
              <div className="flex items-center justify-between"><span className="num text-xs text-faint">{i + 1}</span><Tag tone={status === "Not confirmed" ? "bad" : status === "Modelled" ? "warn" : "neutral"}>{status}</Tag></div>
              <p className="mt-2 text-sm font-medium">{who}</p><p className="mt-1 text-xs leading-relaxed text-muted">{what}</p>
            </li>
          ))}
        </ol>
        <div className="mt-4"><Note tone="warn" title="Why you cannot buy this">{a.eligibility.reasons.join(" ")}</Note></div>
      </Card>
      <div className="flex justify-end"><Button onClick={onNext}>Simulate a price shock →</Button></div>
    </div>
  );
}
