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
      <Link href="/app" className={btnPrimary}>Analyze my business</Link>
      <Link href="/app?sample=1" className={linkArrow}>Try a sample fleet<Arrow /></Link>
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

  const integrations = [
    { k: "Accounting", v: "QuickBooks Online, Xero, Zoho Books, FreshBooks, or a CSV export from anything else" },
    { k: "Prices", v: "Official diesel prices from the U.S. Energy Information Administration" },
    { k: "Market signals", v: "Gemini prediction markets, read live" },
    { k: "Payouts", v: "Solana, with Helius Privacy Rings keeping amounts private" },
  ];

  const security = [
    { t: "We only read", b: "CostShield reads your transactions and never changes your books." },
    { t: "Your books stay yours", b: "We never change, categorize or post anything back to your accounting system." },
    { t: "Your file isn't stored", b: "An uploaded export is processed in memory and discarded when the analysis ends." },
    { t: "Funded before you're covered", b: "In the simulation, the full amount the protection could pay is set aside on Solana's test network before the cover starts." },
    { t: "Amounts only you can see", b: "Payouts and balances are encrypted. Only you, and whoever you choose to show, can read them." },
    { t: "Prices that can't be edited", b: "Each official price is posted once, with a fingerprint of the government file it came from." },
  ];

  const faq = [
    { q: "Is this insurance?", a: "It is index-based protection: it pays when an official price crosses a line, not after a claim. It is not for sale. A real version would need a licensed insurer to owe the payouts, and none has agreed to. Today CostShield is a simulation that pays in test dollars." },
    { q: "What if my pump price is different?", a: "Your pump price can differ from the official one. Before you buy, CostShield shows how closely your price has followed it, from your own receipts." },
    { q: "Who pays me?", a: "In this simulation, a test backer wallet that sets the full amount aside before the cover starts. In a real version it would be a licensed partner, and none has signed up." },
    { q: "What does it cost?", a: `The scan is free and nothing is for sale. The model price for the sample fleet is ${usd0(d.policy.premiumPerMonth)} a month. That is an estimate, not a quote.` },
    { q: "Is my data safe?", a: "We only read your books, and uploaded files aren't stored. Payout amounts are encrypted, so only you and the people you choose can see them." },
    { q: "Do I need crypto?", a: "No. You see dollars. In this simulation payouts settle in test dollars on Solana's test network. Paying into a bank account is not built." },
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
              <a href="#privacy" className="group/btn inline-flex items-center gap-1.5 text-[14px] text-muted transition-colors duration-150 hover:text-ink">
                <span className="text-ink2">Payouts are private by default</span>
                <Arrow className="text-faint" />
              </a>
            </Reveal>
            <Reveal immediate i={1}>
              <h1 className="mt-6 max-w-[960px] bg-gradient-to-b from-ink from-30% to-ink/70 bg-clip-text pb-1 text-[38px] font-[540] leading-[1.06] tracking-[-0.032em] text-transparent sm:text-[52px] sm:leading-[1.03] lg:text-[64px]">
                A small fleet earns {usd0(d.profitTtm)} a year. <br className="hidden md:block" />A bad diesel year costs {usd0(d.diesel.shockNet)}.
              </h1>
            </Reveal>
            <Reveal immediate i={2}>
              <p className="mt-6 max-w-[560px] text-[16px] leading-[1.6] text-muted md:text-[18px]">
                CostShield finds the price spikes that can wipe out a small business and shows what protection would pay back, automatically.
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

        <Rule />

        <Feature label="Cost scan" title="Finds the costs a price you don't control can hurt" fragment={<ExposureBars d={d} />}>
          <p>Connect your books and CostShield sorts every transaction, reads the gallons off each fuel receipt, and measures what a price spike would really cost you after the surcharges your customers already pay.</p>
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
                <span>Costs <span className="text-heat">{usd0(d.policy.premiumPerMonth)}</span> a month</span>
              </div>
            </div>
          }
        >
          <p>A model price for your gallons is shown per month. It is an estimate, not a quote. When nothing can fairly protect a cost, CostShield says so instead of selling you something that won&apos;t pay.</p>
        </Feature>

        <Feature label="Automatic payouts" title="When prices spike, the money comes back on its own" fragment={<ProtectionChart d={d} />}>
          <p>No claims and no paperwork. Each month the official diesel price is posted, and if it is above where the protection starts, it pays the difference on your gallons. Tested on every 12-month period since {d.backtest.from.slice(0, 4)}, it would have paid in {d.backtest.badPaid} of the {d.backtest.bad} bad ones.</p>
        </Feature>

        <Feature id="privacy" label="Private by default" title="Your money is visible to you, not the world" fragment={<PrivatePayout d={d} />} flip>
          <p>In this simulation payouts settle on Solana's test network, and Helius Privacy Rings keeps every amount encrypted. Anyone can check that the rules were followed. Only you can see what you were paid.</p>
          <p className="text-[14px] text-faint">Hover your side to decrypt it again.</p>
        </Feature>

        <Feature id="lenders" label="Proof for your lender" title="Show the bank you're covered, in one link" fragment={<LenderView d={d} />}>
          <p>Send your lender a link with a read-only key. They see how much was set aside and what was paid. The key can read the amounts. It cannot move any money.</p>
        </Feature>

        <Rule />

        {/* Integrations */}
        <section id="integrations" aria-labelledby="integrations-title" className="scroll-mt-20 py-10 md:py-16">
          <div className={cx(wrap, "grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16")}>
            <SectionHead id="integrations-title" title="Works with the books you keep" lede="Connect your accounting system or upload an export. CostShield does the rest." />
            <dl className="divide-y divide-line/[0.07] border-y border-line/[0.07]">
              {integrations.map((x, i) => (
                <Reveal key={x.k} i={i}>
                  <div className="grid gap-x-8 gap-y-1 py-5 sm:grid-cols-[160px_1fr]">
                    <dt className="text-[14px] text-faint">{x.k}</dt>
                    <dd className="text-[15px] text-ink2">{x.v}</dd>
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
            <SectionHead id="who-title" title="Who it's for" lede="Small businesses whose biggest cost is set by a market they can't control." />
            <div>
              <Reveal>
                <div className={cx(surface, "px-6 py-6")}>
                  <p className="text-[13px] text-jade">In the simulation today</p>
                  <p className="mt-2 text-[20px] font-[560] tracking-[-0.015em] text-ink">Trucking fleets</p>
                  <p className="mt-1 text-[14px] text-muted">Diesel price spikes, measured and priced for your gallons. Not on sale.</p>
                </div>
              </Reveal>
              <Reveal i={1}>
                <p className="mt-8 text-[13px] text-faint">Ideas for later, not built</p>
                <dl className="mt-3 divide-y divide-line/[0.07] border-y border-line/[0.07] text-[15px]">
                  {[["Restaurants and bakeries", "Natural gas and flour"], ["Farms", "Rainfall"], ["Contractors", "Diesel"]].map(([k, v]) => (
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
                <h2 className={cx(h2, "max-w-[640px]")}>See what a price spike would cost you</h2>
                <p className={cx(body, "mt-5 max-w-[520px]")}>Connect your books to see your own numbers, or try it on a sample fleet first.</p>
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
              CostShield is a simulation built for the UBC 2026 Hackathon. Payouts use test dollars on Solana devnet. Not an offer of insurance or derivatives.
            </p>
          </div>
          <ul className="space-y-2 leading-[1.6]">
            {[["Open app", "/app"], ["Try a sample fleet", "/app?sample=1"], ["How it works", "#how"], ["Security", "#security"], ["FAQ", "#faq"]].map(([l, h]) => (
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
