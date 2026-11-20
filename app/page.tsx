import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Arrow, SimBanner } from "@/components/ui";
import { getLandingData } from "@/components/landing/data";
import { Nav } from "@/components/landing/nav";
import { Reveal } from "@/components/landing/reveal";
import { ProductWindow } from "@/components/landing/product-window";
import { Backdrop } from "@/components/fx/backdrop";
import { ExposureBars, LenderView, PrivatePayout, ProtectionChart } from "@/components/landing/fragments";
import { body, btnPrimary, cx, h2, lift, linkArrow, monYear, surface, usd0, wrap } from "@/components/landing/kit";

export const dynamic = "force-static";

function Rule() {
  return <div aria-hidden className="h-px w-full bg-line/[0.07]" />;
}

function Feature({ id, label, title, children, fragment, flip }: {
  id?: string; label: string; title: ReactNode; children: ReactNode; fragment: ReactNode; flip?: boolean;
}) {
  return (
    <section id={id} className="scroll-mt-20 py-8 md:py-14">
      <div className={cx(wrap, "grid items-center gap-10 md:gap-16 lg:grid-cols-[0.85fr_1.15fr]")}>
        <div className={cx("max-w-[480px] lg:sticky lg:top-24", flip && "lg:order-2 lg:justify-self-end")}>
          <Reveal><p className="text-[13px] font-[550] text-jade">{label}</p></Reveal>
          <Reveal i={1}><h2 className={cx(h2, "mt-4")}>{title}</h2></Reveal>
          <Reveal i={2}><div className={cx(body, "mt-5 space-y-4")}>{children}</div></Reveal>
        </div>
        <Reveal i={1} className={cx("min-w-0", flip && "lg:order-1")}>{fragment}</Reveal>
      </div>
    </section>
  );
}

function SectionHead({ id, title, lede }: { id: string; title: ReactNode; lede?: ReactNode }) {
  return (
    <div>
      <Reveal><h2 id={id} className={h2}>{title}</h2></Reveal>
      {lede && <Reveal i={1}><p className={cx(body, "mt-5 max-w-[440px]")}>{lede}</p></Reveal>}
    </div>
  );
}

function Actions() {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
      <Link href="/app?sample=1" className={btnPrimary}>Try the sample fleet</Link>
      <Link href="/app" className={linkArrow}>Analyze my business<Arrow /></Link>
    </div>
  );
}

export default async function Landing() {
  const d = await getLandingData();
  const rows = d.policy.rows;
  const coverFrom = monYear(rows[0].month, true), coverTo = monYear(rows[rows.length - 1].month, true);
  const startsAt = `$${d.policy.strike.toFixed(2)}`;

  const story = [
    { n: "1", step: "Your books", value: `$${Math.round(d.diesel.spendTtm / 1000)}K`, unit: "a year on diesel",
      text: `Read from ${d.lines.toLocaleString("en-US")} transactions. Diesel is ${Math.round(d.diesel.share * 100)}% of everything the fleet earns.` },
    { n: "2", step: "Your risk", value: `${d.diesel.shockTimesProfit.toFixed(0)}×`, unit: "their profit, lost in a bad year",
      text: `A bad diesel year, the kind that comes about once every 20 years, costs ${usd0(d.diesel.shockNet)} against ${usd0(d.profitTtm)} of profit.` },
    { n: "3", step: "Money back", value: usd0(d.policy.totalPayout), unit: `would have come back through ${coverTo}`,
      text: `A replay on real prices: with protection starting at ${startsAt} a gallon, every month diesel went above that would have paid the difference. Nobody sold this policy.` },
  ];

  const verdicts = [
    { name: "Diesel", status: "Can be protected", tone: "text-jade", note: "What the fleet pays at the pump follows the official Midwest price closely." },
    { name: "Payroll, leases, repairs", status: "Can't be protected", tone: "text-rust", note: "No price moves with these costs, so nothing could pay them back fairly." },
    { name: "Interest", status: "Too small to matter", tone: "text-ink2", note: "Under 5% of revenue. Not worth paying to protect." },
  ];

  const s = d.settlement;
  const versus = [
    { k: "What it covers", day: "One event: a cold morning, a rained-out Saturday, a lost game.", us: "The cost that can close you. For a fleet, diesel, month after month, for a full year." },
    { k: "How the loss is found", day: "You guess it, in a sentence.", us: `Measured from your books: ${d.lines.toLocaleString("en-US")} transactions, the gallons on every receipt, less what your fuel surcharges already pass on.` },
    { k: "How big it can be", day: "Capped by how deep a prediction market's order book is, often a few hundred dollars.", us: `Sized to the business. A bad diesel year costs this fleet ${usd0(d.diesel.shockNet)}, ${d.diesel.shockTimesProfit.toFixed(0)} times its profit.` },
    { k: "Who pays you", day: "Whoever is selling on the order book that day.", us: "A backer whose money is locked on Solana before your cover starts, and can't be pulled back while you're covered." },
    { k: "Who sees it", day: "Payouts and exposures are public on chain.", us: "Amounts are encrypted with Helius Privacy Rings. Your lender can check your cover with a read-only key." },
    { k: "Proof it works", day: "The next event.", us: `Replayed on every 12-month period since ${d.backtest.from.slice(0, 4)}: it would have paid in ${d.backtest.badPaid} of the ${d.backtest.bad} bad ones.` },
  ];
  const stack = [
    { k: "Your books", h: "Finds the cost that can sink you",
      b: `Covenant sorts every transaction, reads the gallons off each fuel receipt and works out what a spike costs after the fuel surcharges your customers already pay. Every number traces back to a line in your books or a public dataset. No AI guesses in the numbers.`,
      n: "Upload a CSV export from any accounting system. Sign-in for QuickBooks Online, Xero, Zoho Books and FreshBooks is built but switched off in this demo." },
    { k: "U.S. Energy Information Administration", h: "Draws the line",
      b: `Protection pays on the government's official weekly diesel price for your region, averaged over the month. Not on anyone's say-so, and not on a claim you have to file.` },
    { k: "Solana", h: "Makes the payout certain",
      b: `Before your protection starts, the backer locks the most it could ever pay into vaults that only Covenant's Solana program can open. Each month the official price is posted on chain once. If it is over the line, you sign once and the program releases your money. The backer can't block it or take it back.`,
      n: `Money the protection never needed goes back to the backer, but only after every month of the term has come in under the line.` },
    { k: "Helius Privacy Rings", h: "Keeps the amounts yours",
      b: `The money in each vault and every payout are encrypted balances. The program enforces the rules without seeing the amounts, and the public can see that you were paid, not how much. So a competitor or a customer can't work out your gallons or your margins.`,
      n: `Because the program can't read encrypted amounts, it pays in whole 25-cent steps: ${usd0(s.payout)} for ${monYear(s.month, true)} instead of the exact ${usd0(d.policy.rows.find((r) => r.month === s.month)?.payout ?? s.payout)}. We show both.` },
    { k: "Gemini Prediction Markets", h: "Prices the protection",
      b: `Covenant reads Gemini's live oil-price markets, yes-or-no contracts on where Brent crude will be, and turns their prices into how big a move traders expect. That sets today's price of protection: the jumpier the market, the more it costs.`,
      n: `It also tests every live Gemini market as a way to carry the risk. Today none qualifies (there is no diesel market, and they end within days), so the app says so instead of pretending.` },
  ];

  const security = [
    { t: "We only read", b: "Covenant reads your transactions and never changes, categorizes or posts anything back to your accounting system." },
    { t: "Your file isn't stored", b: "An uploaded export is processed in memory and discarded when the analysis ends." },
    { t: "Funded before you're covered", b: "The most the protection could ever pay is locked on Solana before the cover starts. In this simulation, in test dollars." },
    { t: "Amounts hidden from the public", b: "Payouts and balances are encrypted with Helius Privacy Rings. Only you, and whoever you give a viewing key to, can read them." },
    { t: "One official price a month", b: "Each month's price is posted on chain once and can't be changed afterwards, with a fingerprint of the government file it came from." },
    { t: "Rules anyone can check", b: "Who can post a price, when a step pays and when money goes back to the backer are written into the Solana program, the same for everyone." },
  ];

  const faq = [
    { q: "Why does this need a blockchain?", a: "So the payout doesn't depend on anyone's promise. The money is locked before your cover starts, the rules are code anyone can read, and the money is released when the posted price crosses your line. Nobody can delay it or dispute it. Helius Privacy Rings adds what a public blockchain lacks: privacy for your amounts." },
    { q: "Why not just buy a prediction-market contract?", a: "A contract pays on one event, and you can only buy as much as its order book holds, often a few hundred dollars. Gemini lists no diesel market at all; the closest, on Brent crude, ends within days, and a fleet needs a year. So Covenant uses those markets as a price signal and puts the risk with a backer whose money is locked on Solana for the whole term." },
    { q: "Is this insurance?", a: "It is protection that pays when an official price crosses a line, not after a claim. It is not for sale. A real version would need a licensed insurer or partner to back the payouts, and none has agreed to. Today Covenant is a simulation that pays in test dollars." },
    { q: "What if my pump price is different?", a: "It can be. Protection pays on the official price, so before you buy, Covenant shows how closely your own price has followed it, from your receipts." },
    { q: "Why is the payout in 25-cent steps?", a: `Because the amounts are encrypted, the Solana program can't do arithmetic on them. So the money is set aside in fixed steps, one for every 25 cents above the line, and the program releases each step the price passed. In ${monYear(s.month, true)} that paid ${usd0(s.payout)} in ${s.paidSteps} steps. A future version could pay to the cent.` },
    { q: "What does it cost?", a: `The scan is free and nothing is for sale. The model price for the sample fleet is ${usd0(d.policy.premiumPerMonth)} a month if bought in ${monYear(d.policy.inceptionMonth, true)}. Today's price follows how much Gemini's live oil markets expect prices to move. Both are estimates, not quotes.` },
    { q: "Do I need crypto?", a: "No. You see dollars. In this simulation payouts settle in test dollars on Solana's test network. Paying into a bank account is not built yet." },
  ];

  return (
    <div className="relative isolate min-h-screen overflow-x-clip bg-bg">
      <Backdrop variant="landing" />
      <SimBanner />
      <Nav />
      <main>
        {/* Hero */}
        <section className="pt-16 md:pt-[96px]">
          <div className={wrap}>
            <Reveal immediate>
              <a href="#different" className="group/btn inline-flex items-center gap-1.5 text-[14px] text-muted transition-colors duration-150 hover:text-ink">
                <span className="text-ink2">Protection for a bad year, not a bad day</span>
                <Arrow className="text-faint" />
              </a>
            </Reveal>
            <Reveal immediate i={1}>
              <h1 className="mt-6 max-w-[960px] bg-gradient-to-b from-ink from-30% to-ink/70 bg-clip-text pb-1 text-[38px] font-[540] leading-[1.06] tracking-[-0.032em] text-transparent sm:text-[52px] sm:leading-[1.03] lg:text-[64px]">
                A small fleet makes {usd0(d.profitTtm)} in profit a year. <br className="hidden md:block" />A bad diesel year costs {usd0(d.diesel.shockNet)}.
              </h1>
            </Reveal>
            <Reveal immediate i={2}>
              <p className="mt-6 max-w-[560px] text-[16px] leading-[1.6] text-muted md:text-[18px]">
                Airlines lock in what they pay for fuel. Small businesses can&apos;t. Covenant reads your books, finds the cost that could sink you, and sets a line. When that price goes above it, money already locked on Solana comes back to you on its own, and only you can see how much.
              </p>
            </Reveal>
            <Reveal immediate i={3}><Actions /></Reveal>
          </div>
          <div id="product" className={cx(wrap, "mt-16 scroll-mt-20 md:mt-20")}>
            <ProductWindow d={d} />
          </div>
        </section>

        {/* How it works: the sample fleet in three steps */}
        <section id="how" aria-labelledby="story" className="scroll-mt-20 pb-12 md:pb-16">
          <div className={wrap}>
            <Reveal><h2 id="story" className="text-[13px] font-[500] text-faint">How it works, with {d.company}, a 10-truck fleet, {coverFrom} to {coverTo}</h2></Reveal>
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

        {/* Positioning: a bad year, not a bad day */}
        <section id="different" aria-labelledby="different-title" className="scroll-mt-20 pb-12 md:pb-16">
          <div className={wrap}>
            <SectionHead id="different-title" title="Built for a bad year, not a bad day"
              lede="Cover for one rained-out Saturday is easy to sell. The losses that close small businesses are slower and bigger: a cost that stays high for months. That is what Covenant is for." />
            <Reveal i={1}>
              <div className="mt-10 overflow-hidden rounded-[16px] border border-line/8">
                <div className="hidden grid-cols-[180px_1fr_1fr] gap-x-6 border-b border-line/[0.07] bg-panel/40 px-6 py-3 text-[13px] md:grid">
                  <span />
                  <span className="text-faint">Cover for a bad day</span>
                  <span className="font-[550] text-jade">Covenant</span>
                </div>
                <dl className="divide-y divide-line/[0.07]">
                  {versus.map((r) => (
                    <div key={r.k} className="grid gap-x-6 gap-y-2 px-6 py-5 md:grid-cols-[180px_1fr_1fr]">
                      <dt className="text-[13px] text-faint md:text-[14px]">{r.k}</dt>
                      <dd className="text-[14px] leading-[1.55] text-muted"><span className="mr-1.5 text-faint md:hidden">Bad-day cover:</span>{r.day}</dd>
                      <dd className="text-[15px] leading-[1.55] text-ink"><span className="mr-1.5 font-[550] text-jade md:hidden">Covenant:</span>{r.us}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Reveal>
            <Reveal i={2}>
              <p className={cx(body, "mt-6 max-w-[720px]")}>
                Prediction markets still matter here, for what they do best. Covenant reads Gemini&apos;s live oil markets to see how big a move traders expect, and that sets the price of your protection. The risk itself sits with a backer whose money is locked for the whole year.
              </p>
            </Reveal>
          </div>
        </section>

        <Rule />

        <Feature label="Cost scan" title="Finds the costs a price you don't control can hurt" fragment={<ExposureBars d={d} />}>
          <p>Upload your books and Covenant sorts every transaction, reads the gallons off each fuel receipt, and measures what a price spike would really cost you after the surcharges your customers already pay.</p>
          <p>For {d.company} that is one cost: diesel, {Math.round(d.diesel.share * 100)}% of everything the fleet earns, at a price nobody in the company controls.</p>
        </Feature>

        <Feature
          label="Fair price"
          title="A straight answer on what can be protected"
          flip
          fragment={
            <div className={cx(surface, lift, "overflow-hidden")}>
              <div className="flex h-11 items-center justify-between border-b border-line/6 px-4 text-[13px]">
                <span className="font-[550] text-ink2">What can be protected</span>
                <span className="text-faint">{d.company}</span>
              </div>
              <ul className="divide-y divide-line/[0.05]">
                {verdicts.map((v) => (
                  <li key={v.name} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 py-4 text-[14px] sm:px-5">
                    <span className="text-ink">{v.name}</span>
                    <span className={cx("text-[13px]", v.tone)}>{v.status}</span>
                    <span className="col-span-2 text-[13px] text-faint">{v.note}</span>
                  </li>
                ))}
              </ul>
              <div className="num flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-line/6 bg-panel/40 px-4 py-3 text-[12px] text-muted sm:px-5">
                <span>Protection starts at <span className="text-ink2">{startsAt}</span> a gallon</span>
                <span>Costs <span className="text-heat">{usd0(d.policy.premiumPerMonth)}</span> a month if bought {monYear(d.policy.inceptionMonth)}</span>
              </div>
            </div>
          }
        >
          <p>You see a monthly price for protecting your gallons. It follows how much traders expect oil to move, which Covenant reads from Gemini&apos;s live prediction markets. It is an estimate, not a quote.</p>
          <p>When nothing can fairly protect a cost, Covenant says so instead of selling you something that won&apos;t pay.</p>
        </Feature>

        <Feature label="Automatic payouts" title="When prices spike, the money comes back on its own" fragment={<ProtectionChart d={d} />}>
          <p>No claims and no adjuster. The money is locked on Solana before your protection starts. Each month the official diesel price is posted on chain, and if it is above your line, the program releases the difference on your gallons. Nobody has to approve it.</p>
          <p>Tested on every 12-month period since {d.backtest.from.slice(0, 4)}, it would have paid in {d.backtest.badPaid} of the {d.backtest.bad} bad ones.</p>
        </Feature>

        <Feature id="privacy" label="Private by default" title="Your money is visible to you, not the world" fragment={<PrivatePayout d={d} />} flip>
          <p>On a normal blockchain anyone could read your payouts and work back to your gallons and margins. Helius Privacy Rings encrypts every balance and payout, so the public sees that the rules were followed and that you were paid, but not how much.</p>
          <p>In this simulation payouts settle in test dollars on Solana&apos;s test network.</p>
          <p className="text-[14px] text-faint">Hover your side to decrypt it again.</p>
        </Feature>

        <Feature id="lenders" label="Proof for your lender" title="Show the bank you're covered, in one link" fragment={<LenderView d={d} />}>
          <p>A fleet with protected fuel costs is a safer loan. Send your lender a link with a read-only viewing key: they see each step, how much was set aside and what was paid, straight from Solana.</p>
          <p>The key can read your amounts. It can&apos;t move any money.</p>
        </Feature>

        <Rule />

        {/* Technology: what each piece does for the business */}
        <section id="technology" aria-labelledby="technology-title" className="scroll-mt-20 py-10 md:py-16">
          <div className={cx(wrap, "grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16")}>
            <div className="lg:sticky lg:top-24 lg:self-start">
              <SectionHead id="technology-title" title="What each piece does" lede="Five pieces, each with one job. Together they turn a cost you can't control into money that comes back to you on its own." />
            </div>
            <dl className="divide-y divide-line/[0.07] border-y border-line/[0.07]">
              {stack.map((x, i) => (
                <Reveal key={x.k} i={i % 3}>
                  <div className="grid gap-x-8 gap-y-2 py-6 sm:grid-cols-[180px_1fr]">
                    <dt className="text-[14px] leading-[1.5] text-faint">{x.k}</dt>
                    <dd>
                      <p className="text-[17px] font-[560] tracking-[-0.012em] text-ink">{x.h}</p>
                      <p className="mt-2 text-[15px] leading-[1.6] text-ink2">{x.b}</p>
                      {x.n && <p className="mt-2 text-[14px] leading-[1.55] text-muted">{x.n}</p>}
                    </dd>
                  </div>
                </Reveal>
              ))}
            </dl>
          </div>
        </section>

        <Rule />

        {/* Security and privacy */}
        <section id="security" aria-labelledby="security-title" className="scroll-mt-20 py-10 md:py-16">
          <div className={wrap}>
            <SectionHead id="security-title" title="Security and privacy" lede="Built so you never have to trust us with more than you need to." />
            <div className="mt-12 grid gap-px overflow-hidden rounded-[16px] border border-line/8 bg-line/[0.07] sm:grid-cols-2 lg:grid-cols-3">
              {security.map((x, i) => (
                <Reveal key={x.t} i={i % 3} className="bg-bg">
                  <div className="h-full px-6 py-7">
                    <h3 className="text-[15px] font-[560] tracking-[-0.01em] text-ink">{x.t}</h3>
                    <p className="mt-2 text-[14px] leading-[1.55] text-muted">{x.b}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <Rule />

        {/* Who it's for */}
        <section aria-labelledby="who-title" className="py-10 md:py-16">
          <div className={cx(wrap, "grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16")}>
            <SectionHead id="who-title" title="Trucks first. Then every small business with a price it can't control." lede="Big companies have whole teams that lock in their costs. A café, a bakery or a contractor has nobody. The same engine reads any set of books and finds the cost a market controls." />
            <div>
              <Reveal>
                <div className={cx(surface, "px-6 py-6")}>
                  <p className="text-[13px] text-jade">In the simulation today</p>
                  <p className="mt-2 text-[20px] font-[560] tracking-[-0.015em] text-ink">Trucking fleets and diesel</p>
                  <p className="mt-1 text-[14px] text-muted">Measured from the books, priced for the fleet&apos;s gallons, replayed on real prices and settled on Solana&apos;s test network. Not on sale.</p>
                </div>
              </Reveal>
              <Reveal i={1}>
                <p className="mt-8 text-[13px] text-faint">Next, not built yet</p>
                <dl className="mt-3 divide-y divide-line/[0.07] border-y border-line/[0.07] text-[15px]">
                  {[["Cafés", "Coffee beans"], ["Bakeries", "Wheat and butter"], ["Restaurants", "Beef and natural gas"], ["Greenhouses", "Natural gas"], ["Contractors and landscapers", "Diesel"], ["Farms", "Rainfall"]].map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[1fr_auto] gap-4 py-4"><dt className="text-ink2">{k}</dt><dd className="text-muted">{v}</dd></div>
                  ))}
                </dl>
              </Reveal>
            </div>
          </div>
        </section>

        <Rule />

        {/* FAQ */}
        <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 py-10 md:py-16">
          <div className={cx(wrap, "grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16")}>
            <SectionHead id="faq-title" title="Questions" />
            <dl className="divide-y divide-line/[0.07] border-y border-line/[0.07]">
              {faq.map((x, i) => (
                <Reveal key={x.q} i={i % 3}>
                  <div className="py-6">
                    <dt className="text-[16px] font-[550] tracking-[-0.01em] text-ink">{x.q}</dt>
                    <dd className="mt-2 max-w-[60ch] text-[15px] leading-[1.6] text-muted">{x.a}</dd>
                  </div>
                </Reveal>
              ))}
            </dl>
          </div>
        </section>

        {/* Final call to action */}
        <section className="pb-16 pt-2 md:pb-24">
          <div className={wrap}>
            <Reveal>
              <div className={cx(surface, lift, "px-6 py-12 md:px-14 md:py-16")}>
                <h2 className={cx(h2, "max-w-[640px]")}>Find the cost that could close your business</h2>
                <p className={cx(body, "mt-5 max-w-[520px]")}>Try it on the sample fleet, or upload an export of your own books. It takes a minute, and nothing is sold.</p>
                <Actions />
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-line/[0.07] py-12">
        <div className={cx(wrap, "grid gap-10 text-[13px] md:grid-cols-[1.1fr_0.7fr_1.2fr]")}>
          <div>
            <Logo size={18} />
            <p className="mt-4 max-w-[40ch] leading-[1.6] text-faint">
              Price protection for small businesses, paid out on Solana. Today a simulation: payouts use test dollars on Solana devnet. Not an offer of insurance or derivatives.
            </p>
          </div>
          <ul className="space-y-2 leading-[1.6]">
            {[["Open app", "/app"], ["Try the sample fleet", "/app?sample=1"], ["How it works", "#how"], ["Technology", "#technology"], ["Security", "#security"], ["FAQ", "#faq"]].map(([l, h]) => (
              <li key={l}><Link href={h} className="text-muted transition-colors duration-150 hover:text-ink">{l}</Link></li>
            ))}
          </ul>
          <dl className="grid gap-x-8 gap-y-4 leading-[1.6] sm:grid-cols-2">
            {[
              ["Diesel prices", "U.S. Energy Information Administration"],
              ["Market data", "Gemini prediction markets"],
              ["Payouts", "Solana"],
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
