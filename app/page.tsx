import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Arrow } from "@/components/ui";
import { getLandingData } from "@/components/landing/data";
import { Nav } from "@/components/landing/nav";
import { Reveal } from "@/components/landing/reveal";
import { ProductWindow } from "@/components/landing/product-window";
import { Backdrop } from "@/components/fx/backdrop";
import { ExposureBars, LedgerSort, LenderView, PrivatePayout, ProtectionChart } from "@/components/landing/fragments";
import { body, btnPrimary, cx, h2, lift, linkArrow, monYear, surface, usd0, wrap } from "@/components/landing/kit";

export const dynamic = "force-static";

function Rule() {
  return <div aria-hidden className="h-px w-full bg-line/[0.07]" />;
}

function Feature({ id, label, title, children, aside, fragment, flip }: {
  id?: string; label: string; title: ReactNode; children: ReactNode; aside?: ReactNode; fragment: ReactNode; flip?: boolean;
}) {
  return (
    <section id={id} className="scroll-mt-20 py-20 md:py-[112px]">
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
  const rows = d.policy.rows;
  const coverFrom = monYear(rows[0].month, true), coverTo = monYear(rows[rows.length - 1].month, true);
  const startsAt = `$${d.policy.strike.toFixed(2)}`;
  const times = d.diesel.shockTimesProfit;

  const story = [
    { n: "1", step: "The books", value: `$${Math.round(d.diesel.spendTtm / 1000)}K`, unit: "a year on diesel",
      text: `Read from ${d.lines.toLocaleString("en-US")} transactions in a QuickBooks export. Diesel is ${Math.round(d.diesel.share * 100)}% of everything the fleet earns.` },
    { n: "2", step: "The risk", value: `${times.toFixed(0)}×`, unit: "their profit, lost in a bad year",
      text: `A bad diesel year, the kind that comes about once every 20 years, costs ${usd0(d.diesel.shockNet)} against ${usd0(d.profitTtm)} of profit.` },
    { n: "3", step: "Money back", value: usd0(d.policy.totalPayout), unit: `paid back through ${coverTo}`,
      text: `Protection started at ${startsAt} a gallon. Every month diesel went above that, CostShield paid the difference.` },
  ];

  const tracks = [
    { track: "DeFi and Onchain Applications", kind: "Main track", line: "Small businesses get the price protection big companies use, with the money locked in advance so the payout can't fail.", see: "See it on the Protection screen" },
    { track: "Best use of Solana", kind: "Chain award", line: "A Solana program holds the backer's money and pays the business automatically when the official price crosses the line. Helius Privacy Rings keeps the amounts private, and the business can prove its cover to a lender with a read-only key.", see: "See it at the payout step" },
    { track: "Gemini Prediction Markets", kind: "Bounty", line: "CostShield reads live Gemini markets to estimate how likely a price jump is, and says plainly when no market fits.", see: "See it in the analysis" },
  ];

  const verdicts = [
    { name: "Diesel options on NYMEX", status: "Works", tone: "text-jade", note: "Follows the diesel price trucks pay and runs a full year. Priced with a model, not traded." },
    { name: "Gemini crude oil markets", status: "A signal only", tone: "text-ink2", note: "Crude oil is not diesel, and these markets close within days." },
    { name: "Payroll, leases, repairs", status: "Can't be protected", tone: "text-rust", note: "Nothing exists that moves with these costs." },
  ];

  const details = [
    { t: "Every number shows where it came from", b: "Each figure says whether it is official public data, calculated from data, an estimate or an assumption, and names its source.", m: "V  C  E  A" },
    { t: "No wallet needed", b: "This demo pays from test wallets on Solana devnet, so a visitor can run the whole thing without devnet SOL or a wallet.", m: "Solana devnet" },
    { t: "Live Gemini markets", b: "Gemini prices are read live to estimate how much diesel could move. A market that doesn't fit is turned down, with the reason.", m: "Read at analysis time" },
    { t: "The official price, posted once", b: "The official diesel price is posted on the blockchain with a fingerprint of the government file. It cannot be changed afterwards.", m: `sha256 ${d.eia.sha256.slice(0, 16)}…` },
    { t: "Rules the program enforces", b: "Only the official price poster can post. Only the business can collect. Nothing pays below the line, and nothing pays twice.", m: "Refused on chain" },
    { t: "Reads real exports", b: "QuickBooks reports, title rows and all, or any export with debit and credit columns. Rows it can't read are counted, not guessed.", m: `${d.lines.toLocaleString("en-US")} rows, ${d.skipped} skipped` },
  ];

  return (
    <div className="relative isolate min-h-screen overflow-x-clip bg-bg">
      <Backdrop variant="landing" />
      <Nav />
      <main>
        {/* Hero: the problem, then what CostShield does */}
        <section className="pt-16 md:pt-[96px]">
          <div className={wrap}>
            <Reveal immediate>
              <a href="#ubc" className="group/btn inline-flex items-center gap-1.5 text-[14px] text-muted transition-colors duration-150 hover:text-ink">
                <span className="text-ink2">Built for the UBC 2026 Hackathon</span>
                <span className="hidden text-faint sm:inline">DeFi, Solana and Gemini tracks</span>
                <Arrow className="text-faint" />
              </a>
            </Reveal>
            <Reveal immediate i={1}>
              <h1 className="mt-6 max-w-[960px] bg-gradient-to-b from-ink from-30% to-ink/70 bg-clip-text pb-1 text-[38px] font-[540] leading-[1.06] tracking-[-0.032em] text-transparent sm:text-[52px] sm:leading-[1.03] lg:text-[64px]">
                A small fleet earns {usd0(d.profitTtm)} a year. <br className="hidden md:block" />A bad diesel year costs {usd0(d.diesel.shockNet)}.
              </h1>
            </Reveal>
            <Reveal immediate i={2}>
              <p className="mt-6 max-w-[600px] text-[16px] leading-[1.6] text-muted md:text-[18px]">
                CostShield finds that risk in a business&apos;s books and pays it back automatically when prices spike, privately, on Solana. Shown here with {d.company}, a 10-truck sample fleet built on real diesel prices.
              </p>
            </Reveal>
            <Reveal immediate i={3}>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <Link href="/app?sample=1" className={btnPrimary}>Analyze a sample company</Link>
                <a href="#how" className={linkArrow}>How it works<Arrow /></a>
              </div>
            </Reveal>
          </div>
          <div id="product" className={cx(wrap, "mt-16 scroll-mt-20 md:mt-20")}>
            <ProductWindow d={d} />
          </div>
        </section>

        {/* Three-step story */}
        <section aria-labelledby="story" className="pb-20 md:pb-[112px]">
          <div className={wrap}>
            <Reveal><h2 id="story" className="text-[13px] font-[500] text-faint">What happened to the sample fleet, from {coverFrom} to {coverTo}</h2></Reveal>
            <ol className="mt-6 grid gap-px overflow-hidden rounded-[16px] border border-line/8 bg-line/[0.07] md:grid-cols-3">
              {story.map((s, i) => (
                <li key={s.n} className="bg-bg">
                  <Reveal i={i} className="h-full">
                    <div className="flex h-full flex-col px-6 py-7 md:px-7 md:py-8">
                      <p className="flex items-center gap-2 text-[13px] text-ink2">
                        <span className="num text-faint">{s.n}</span>{s.step}
                        {i < 2 && <Arrow className="ml-auto hidden text-faint md:block" />}
                      </p>
                      <p className={cx("num mt-6 text-[40px] font-[540] leading-none tracking-[-0.03em] md:text-[48px]", i === 2 ? "text-jade" : "text-ink")}>{s.value}</p>
                      <p className="mt-2 text-[15px] text-ink2">{s.unit}</p>
                      <p className="mt-4 text-[14px] leading-[1.55] text-muted">{s.text}</p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <Rule />

        {/* Built for UBC 2026 */}
        <section id="ubc" aria-labelledby="ubc-title" className="scroll-mt-20 py-20 md:py-[112px]">
          <div className={cx(wrap, "grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16")}>
            <div>
              <Reveal><h2 id="ubc-title" className={h2}>Built for UBC 2026</h2></Reveal>
              <Reveal i={1}><p className={cx(body, "mt-5 max-w-[400px]")}>One working product across three tracks. It is a simulation: test dollars on Solana devnet, never real money.</p></Reveal>
            </div>
            <ul className="divide-y divide-line/[0.07] border-y border-line/[0.07]">
              {tracks.map((t, i) => (
                <li key={t.track}>
                  <Reveal i={i}>
                    <div className="grid gap-x-8 gap-y-2 py-7 md:grid-cols-[200px_1fr]">
                      <div>
                        <p className="text-[15px] font-[560] tracking-[-0.01em] text-ink">{t.track}</p>
                        <p className="mt-1 text-[13px] text-faint">{t.kind}</p>
                      </div>
                      <div>
                        <p className="text-[15px] leading-[1.6] text-muted">{t.line}</p>
                        <Link href="/app?sample=1" className="group/btn mt-3 inline-flex items-center gap-1 text-[13px] font-[500] text-ink2 transition-colors duration-150 hover:text-ink">{t.see}<Arrow /></Link>
                      </div>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <Rule />

        <Feature id="how" label="1. Reads the books" title={<>Starts from the books <br className="hidden md:block" />you already keep</>} fragment={<LedgerSort d={d} />}>
          <p>Upload a QuickBooks export. CostShield sorts every line into a category with fixed rules, reads the gallons straight from each fuel receipt, and counts any row it can&apos;t read instead of guessing.</p>
        </Feature>

        <Feature label="2. Finds the risk" title="Finds the costs a price you don't control can hurt" fragment={<ExposureBars d={d} />} flip>
          <p>Diesel is {Math.round(d.diesel.share * 100)}% of the fleet&apos;s revenue, and what it pays at the pump follows the official Midwest diesel price published by the U.S. government. Payroll, leases and repairs don&apos;t follow any price, so there is nothing to protect them with.</p>
        </Feature>

        <Feature
          label="3. Prices the protection"
          title="Says what can be protected, and what can't"
          fragment={<ProtectionChart d={d} />}
          aside={
            <ul className="divide-y divide-line/[0.06] border-y border-line/[0.06]">
              {verdicts.map((v) => (
                <li key={v.name} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 py-3 text-[13px]">
                  <span className="text-ink">{v.name}</span>
                  <span className={v.tone}>{v.status}</span>
                  <span className="col-span-2 text-faint">{v.note}</span>
                </li>
              ))}
            </ul>
          }
        >
          <p>Protection starts at {startsAt} a gallon. Any month diesel goes above it, CostShield pays back the difference on the fuel the business pays for itself. Tested on every year since {d.backtest.from.slice(0, 4)}, it paid in {d.backtest.badPaid} of the {d.backtest.bad} bad ones.</p>
        </Feature>

        <Feature id="privacy" label="4. Pays back privately" title="The money is real. The amount stays private." fragment={<PrivatePayout d={d} />} flip>
          <p>The backer sets the money aside in advance. When the official diesel price is posted on the blockchain, a Solana program pays the business automatically. Helius Privacy Rings keeps every amount encrypted, so only the business can read it.</p>
          <p className="text-[14px] text-faint">Hover the business&apos;s side to decrypt it again.</p>
        </Feature>

        <Feature id="lenders" label="5. Proves it to the bank" title="Proof for your lender in one link" fragment={<LenderView d={d} />}>
          <p>The business sends its lender a link with a read-only key. The lender sees how much was set aside and how much was paid. The key can read the amounts. It cannot move any money.</p>
        </Feature>

        <Rule />

        {/* Details */}
        <section aria-labelledby="details" className="py-20 md:py-[112px]">
          <div className={wrap}>
            <Reveal><h2 id="details" className={cx(h2, "max-w-[640px]")}>Built to be checked</h2></Reveal>
            <Reveal i={1}><p className={cx(body, "mt-5 max-w-[520px]")}>Every number on this page traces back to a file, a formula or a transaction you can open.</p></Reveal>
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
        <section className="py-24 md:py-[128px]">
          <div className={wrap}>
            <Reveal>
              <div className={cx(surface, lift, "px-6 py-12 md:px-14 md:py-16")}>
                <h2 className={cx(h2, "max-w-[640px]")}>See it on the sample fleet</h2>
                <p className={cx(body, "mt-5 max-w-[540px]")}>
                  Two years of books, {d.lines.toLocaleString("en-US")} transactions, {usd0(d.profitTtm)} of profit and a diesel bill of {usd0(d.diesel.spendTtm)}. Every number above came from it.
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
            <p className="mt-4 max-w-[40ch] leading-[1.6] text-faint">
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
