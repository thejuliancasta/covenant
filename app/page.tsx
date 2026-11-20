import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Arrow } from "@/components/ui";
import { getLandingData } from "@/components/landing/data";
import { Nav } from "@/components/landing/nav";
import { Reveal } from "@/components/landing/reveal";
import { ProductWindow } from "@/components/landing/product-window";
import { CapLadder, ExposureBars, LedgerSort, LenderView, PrivatePayout } from "@/components/landing/fragments";
import { body, btnPrimary, cx, h2, lift, linkArrow, pct1, surface, usd0, wrap } from "@/components/landing/kit";

export const dynamic = "force-static";

function Rule() {
  return <div aria-hidden className="h-px w-full bg-line/[0.07]" />;
}

function Feature({ id, label, title, children, aside, fragment, flip }: {
  id?: string; label: string; title: ReactNode; children: ReactNode; aside?: ReactNode; fragment: ReactNode; flip?: boolean;
}) {
  return (
    <section id={id} className="scroll-mt-20 py-20 md:py-[120px]">
      <div className={cx(wrap, "grid items-center gap-10 md:gap-16 lg:grid-cols-[0.85fr_1.15fr]")}>
        <div className={cx("max-w-[480px]", flip && "lg:order-2 lg:justify-self-end")}>
          <Reveal><p className="text-[13px] font-[500] text-ink2">{label}</p></Reveal>
          <Reveal i={1}><h2 className={cx(h2, "mt-4")}>{title}</h2></Reveal>
          <Reveal i={2}><div className={cx(body, "mt-5 space-y-4")}>{children}</div></Reveal>
          {aside && <Reveal i={3}><div className="mt-8">{aside}</div></Reveal>}
        </div>
        <Reveal i={1} className={cx("min-w-0", flip && "lg:order-1")}>{fragment}</Reveal>
      </div>
    </section>
  );
}

export default async function Landing() {
  const d = await getLandingData();
  const proof = [
    { v: pct1(d.diesel.share), c: "of the sample fleet's revenue goes to diesel" },
    { v: `${d.diesel.shockTimesProfit.toFixed(1)}×`, c: "its operating profit, lost in a 1-in-20 diesel year after surcharges" },
    { v: String(d.backtest.n), c: `rolling 12-month cover years backtested on EIA prices, ${d.backtest.from.slice(0, 4)} to ${d.backtest.to.slice(0, 4)}` },
    { v: `${d.backtest.badPaid} of ${d.backtest.bad}`, c: "bad diesel years, a quarter a gallon or worse, in which the cap paid" },
  ];
  const verdicts = [
    { name: "NY Harbor diesel calls", where: "NYMEX", status: "Viable, modelled", tone: "text-jade", note: `R² ${d.wholesaleR2.toFixed(2)} to retail diesel, 12 monthly expiries` },
    { name: "Crude oil ladders", where: "Gemini", status: "Signal only", tone: "text-ink2", note: "Brent is not diesel, and the ladder expires in days" },
    { name: "Payroll, leases, repairs", where: "None", status: "No instrument", tone: "text-rust", note: "Nothing trades on these costs" },
  ];
  const details = [
    { t: "Judge mode", b: "Every number opens to its source, its formula and its inputs: provenance, classification, statistics, Gemini and the settlement program.", m: "5 tabs" },
    { t: "Evidence on every number", b: "Each figure carries a letter: verified public data, calculated, estimate or assumption. Owners can ignore it; reviewers can read it.", m: "V  C  E  A" },
    { t: "Live Gemini market reads", b: "Prediction-market ladders are read live and turned into an implied volatility for pricing. They are scored as a hedge, and rejected when they fail.", m: "Index, tenor, depth, fit" },
    { t: "Write-once oracle reports", b: "The oracle posts the EIA monthly mean with the sha256 of the source file. A period can be reported once.", m: `sha256 ${d.eia.sha256.slice(0, 16)}…` },
    { t: "Refusals the program enforces", b: "Reports from anyone but the oracle, releases of untriggered steps, releases by anyone but the fleet and double releases are refused on chain.", m: "4 checks" },
    { t: "Reads real exports", b: "QuickBooks reports with title rows above the header, or any export with debit and credit columns. Unreadable rows are counted, not guessed.", m: `${d.lines.toLocaleString("en-US")} rows, ${d.skipped} skipped` },
  ];

  return (
    <div className="min-h-screen overflow-x-clip bg-bg">
      <Nav />
      <main>
        {/* Hero */}
        <section className="pt-16 md:pt-[104px]">
          <div className={wrap}>
            <Reveal immediate>
              <a href="#privacy" className="group/btn inline-flex items-center gap-1.5 text-[14px] text-muted transition-colors duration-150 hover:text-ink">
                <span className="text-ink2">Private payouts on Solana devnet</span>
                <span className="text-faint">with Helius Privacy Rings</span>
                <Arrow className="text-faint" />
              </a>
            </Reveal>
            <Reveal immediate i={1}>
              <h1 className="mt-6 max-w-[880px] bg-gradient-to-b from-ink from-30% to-ink/70 bg-clip-text pb-1 text-[40px] font-[540] leading-[1.04] tracking-[-0.032em] text-transparent sm:text-[56px] sm:leading-[1.02] lg:text-[68px]">
                Protect your business from <br className="hidden sm:block" />the costs a market controls
              </h1>
            </Reveal>
            <Reveal immediate i={2}>
              <p className="mt-6 max-w-[560px] text-[16px] leading-[1.6] text-muted md:text-[18px]">
                CostShield reads your books, measures what a price spike would cost you, and says plainly what can be protected. Payouts settle privately on Solana.
              </p>
            </Reveal>
            <Reveal immediate i={3}>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <Link href="/app?sample=1" className={btnPrimary}>Analyze a sample company</Link>
                <a href="#how" className={linkArrow}>How it works<Arrow /></a>
              </div>
            </Reveal>
          </div>
          <div id="product" className={cx(wrap, "scroll-mt-20 mt-16 md:mt-20")}>
            <ProductWindow d={d} />
          </div>
        </section>

        {/* Proof */}
        <section aria-label="The sample company in numbers" className="pb-20 md:pb-[120px]">
          <div className={wrap}>
            <Reveal><p className="text-[13px] text-faint">From the sample company: {d.company}, a synthetic 10-truck Midwest fleet with real EIA prices.</p></Reveal>
            <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-line/8 bg-line/[0.07] lg:grid-cols-4">
              {proof.map((p, i) => (
                <Reveal key={p.c} i={i} className="bg-bg">
                  <div className="h-full px-5 py-6 md:px-6 md:py-8">
                    <p className="num text-[32px] font-[540] leading-none tracking-[-0.03em] text-ink md:text-[40px]">{p.v}</p>
                    <p className="mt-3 max-w-[30ch] text-[13px] leading-[1.5] text-muted">{p.c}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <Rule />

        <Feature id="how" label="Reads your books" title={<>Starts from the books <br className="hidden md:block" />you already keep</>} fragment={<LedgerSort d={d} />}>
          <p>Upload a QuickBooks export. Ordered, deterministic rules give every line a category and a confidence, gallons come straight from fuel memos, and any row that cannot be read is counted rather than guessed.</p>
        </Feature>

        <Feature label="Finds what a market controls" title="Finds the costs a market sets" fragment={<ExposureBars d={d} />} flip>
          <p>Each category is measured as a share of revenue, then the price you paid is tested against public indexes. For the sample fleet, diesel follows the {d.diesel.regionLabel} index with R² {d.diesel.r2.toFixed(2)}. Payroll and leases follow nothing.</p>
        </Feature>

        <Feature
          label="Prices protection honestly"
          title="Prices the cover, and says no when nothing hedges"
          fragment={<CapLadder d={d} />}
          aside={
            <ul className="divide-y divide-line/[0.06] border-y border-line/[0.06]">
              {verdicts.map((v) => (
                <li key={v.name} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 py-3 text-[13px]">
                  <span className="text-ink">{v.name} <span className="text-faint">{v.where}</span></span>
                  <span className={v.tone}>{v.status}</span>
                  <span className="col-span-2 text-faint">{v.note}</span>
                </li>
              ))}
            </ul>
          }
        >
          <p>A 12-month diesel cap in $0.25 steps, priced as a strip of options with Black-76 and backtested on {d.backtest.n} rolling cover years. Any instrument that fails on index, tenor, depth or fit is rejected, and the page says so.</p>
        </Feature>

        <Feature id="privacy" label="Pays privately on Solana" title="The payout is real. The amount stays private." fragment={<PrivatePayout d={d} />} flip>
          <p>Each step of the cap is funded in advance. An oracle posts the EIA monthly mean, and the program releases every step the price reached. Helius Privacy Rings keeps step amounts, the payout and balances encrypted on chain.</p>
          <p className="text-[14px] text-faint">Hover the fleet&apos;s view to decode it again.</p>
        </Feature>

        <Feature id="lenders" label="Proves it to your lender" title="Proof for your lender, without a spreadsheet" fragment={<LenderView d={d} />}>
          <p>Send one link. It carries read-only viewing keys, so your lender sees each step&apos;s trigger, what was funded and what paid. The key can decrypt. It cannot spend.</p>
        </Feature>

        <Rule />

        {/* Details */}
        <section aria-labelledby="details" className="py-20 md:py-[120px]">
          <div className={wrap}>
            <Reveal><h2 id="details" className={cx(h2, "max-w-[640px]")}>Built to be checked</h2></Reveal>
            <Reveal i={1}><p className={cx(body, "mt-5 max-w-[520px]")}>Every claim on this page traces back to a file, a formula or a transaction you can open.</p></Reveal>
            <div className="mt-12 grid gap-px overflow-hidden rounded-[16px] border border-line/8 bg-line/[0.07] sm:grid-cols-2 lg:grid-cols-3">
              {details.map((x, i) => (
                <Reveal key={x.t} i={i % 3} className="bg-bg">
                  <div className="flex h-full flex-col px-6 py-7">
                    <h3 className="text-[15px] font-[560] tracking-[-0.01em] text-ink">{x.t}</h3>
                    <p className="mt-2 flex-1 text-[14px] leading-[1.55] text-muted">{x.b}</p>
                    <p className="num mt-6 truncate font-mono text-[12px] text-faint">{x.m}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <Rule />

        {/* Final call to action */}
        <section className="py-24 md:py-[144px]">
          <div className={cx(wrap)}>
            <Reveal>
              <div className={cx(surface, lift, "px-6 py-12 md:px-14 md:py-16")}>
                <h2 className={cx(h2, "max-w-[620px]")}>Start with the sample company</h2>
                <p className={cx(body, "mt-5 max-w-[540px]")}>
                  Two years of books from a 10-truck fleet, {d.lines.toLocaleString("en-US")} transactions, {usd0(d.revenueTtm)} in revenue and {usd0(d.profitTtm)} of profit. Every number above came from it.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <Link href="/app?sample=1" className={btnPrimary}>Analyze a sample company</Link>
                  <Link href="/app" className={linkArrow}>Upload your own export<Arrow /></Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-line/[0.07] py-12">
        <div className={cx(wrap, "grid gap-8 text-[13px] md:grid-cols-[1fr_1.4fr]")}>
          <div>
            <Logo size={18} />
            <p className="mt-4 max-w-[38ch] leading-[1.6] text-faint">
              A simulation built for the UBC 2026 Hackathon. Not an offer of insurance or derivatives. No real premiums, orders or money: devnet test dollars only.
            </p>
          </div>
          <dl className="grid gap-x-8 gap-y-4 leading-[1.6] sm:grid-cols-2">
            {[
              ["Diesel prices", "U.S. Energy Information Administration (EIA)"],
              ["Market data", "Gemini Prediction Markets public API"],
              ["Settlement", "Solana devnet"],
              ["Privacy", "Helius Privacy Rings"],
            ].map(([k, v]) => (
              <div key={k}><dt className="text-faint">{k}</dt><dd className="text-muted">{v}</dd></div>
            ))}
          </dl>
        </div>
      </footer>
    </div>
  );
}
