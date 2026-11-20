# CostShield: concept, customer workflows and UI/UX

Nov 20, 2026 · @Julian Castaneda

> **Context file.** This is the current definition of the CostShield idea: what the product is, who carries the risk, how a customer moves from sign-up to payout, and how the desktop and mobile apps should work. Read it before changing product behaviour, copy or screens. Sections 1 to 6 are the concept. Section 7 is a snapshot of the build and the hackathon plan on the day this was written, and section 8 records the decisions made after it. The code in this repo implements one slice of the concept (US diesel for a fleet); `README.md` and `docs/PRODUCT.md` describe what is actually built.

## 1. The concept in one page

CostShield lets any business connect its books, see which outside price or weather shocks can hurt its margins, and buy protection that pays cash automatically when a public index crosses an agreed level. Big companies have trading desks for this. Small and mid-sized businesses have nothing.

**What the customer gets**

- A risk profile built from their own accounting data, in dollars, not in contracts.
- A protection plan per exposure: trigger, maximum payout, price, and the cases where it will not pay.
- An automatic payout when the index settles above the trigger. No claim form, no adjuster.

**How it works behind the scenes**

1. **Read the ledger.** QuickBooks, Xero or a CSV export gives 12 to 24 months of expenses, vendors and revenue.
2. **Classify by economic exposure.** "Truck Stop Fuel", "Diesel" and "Fleet Fuel" are the same risk. Each cost maps to a risk factor and a public index.
3. **Measure.** Spend share, volatility, how closely the business's real cost follows the index (basis risk), and what a bad year costs.
4. **Pool by risk, not by industry.** A pool is one index, one region, one period, for example "Gulf Coast diesel, monthly average, Q1 2027". A business holds a basket of positions across several pools.
5. **Route the pool to whoever can carry it best.** Futures and options once the pool is large enough, prediction markets for small or odd exposures, parametric insurers for weather, supplier or utility fixed-price plans where those are simply the better answer.
6. **Settle automatically.** Collateral is posted before cover starts. When the index publishes, the payout is computed and sent.

**The three things that make it more than "hedge it on a prediction market"**

- It starts from the business's real books, so cover is sized to verified spend and capped there. That keeps it hedging, not betting.
- Pooling is the product. One bakery is far too small for a 5,000 bushel wheat contract or a 42,000 gallon diesel contract. A thousand of them are not.
- It is honest about fit. Every plan shows a coverage score, and the engine rejects a hedge that does not track the cost. In your current build it already rejects Gemini's Brent markets as a diesel hedge and says why.

**The 14 segments and 6 product families from your notes collapse into 5 risk-factor families.** This is what makes "all businesses" a real claim and not a list of logos.

| Risk family | Example indices | Who it touches | Natural risk-taker |
| --- | --- | --- | --- |
| Fuel | Diesel, gasoline, jet | Trucking, delivery, contractors, landscaping, farms | Market makers hedging in futures |
| Energy | Electricity, natural gas | Restaurants, laundromats, bakeries, manufacturers, cold storage, data centers | Energy traders, retail energy suppliers |
| Commodity inputs | Wheat, corn, dairy, sugar, coffee, steel, aluminum | Food producers, breweries, small manufacturers, wholesalers | Market makers, suppliers offering forwards |
| Weather | Rainfall, temperature, snowfall, wind, sunshine | Construction, events, hotels, ski resorts, farms, solar and wind | Parametric insurers and reinsurers |
| Financial | FX rates, interest rates, freight rates | Importers, exporters, anyone with a floating-rate loan | Banks, FX providers |

Keep these out of scope at the start, as your notes already say: payroll, rent, supplier-specific pricing, tariffs, general inflation, insurance premiums. No clean index, no clean hedge.

## 2. Router vs. risk-taker

Start as the router: CostShield measures, pools, runs the price competition and settles, while specialists hold the risk and post the collateral. This is the direction from your earlier chats, and it is the better business. No balance sheet, revenue grows with volume, and CostShield never sets the price of protection.

| Actor | Role | What they want |
| --- | --- | --- |
| Members | Businesses buying protection | Budget certainty, easy onboarding, fast payouts, a fair price |
| Specialists | Market makers, insurers, reinsurers, energy traders who cover pools | Premium for risks they can price and hedge, in sizes worth their time |
| CostShield | Router and marketplace operator | A fee on premium, growing volume, few disputes |
| Regulated partner | Exchange or fronting insurer that gives the legal wrapper | Fees, volume, compliance |
| Index providers | Publish the settlement prices (EIA, NOAA, exchanges, national statistics offices) | Data fees in some cases |
| Distribution partners | Accounting apps, POS, fuel cards, banks, lenders | Revenue share, more value for their users |

**How the router sets a price.** Each pool runs a sealed-bid auction among approved specialists. Bids are filled cheapest first, and every winner gets the same clearing premium. Winners post collateral equal to the maximum payout before cover binds. A reserve price protects members when few bidders show up.

**The contract.** A capped call on the index: payout per unit = min(max(0, index - strike), cap - strike). The maximum loss is known in advance, so it can be fully collateralized.

**Routing is wider than markets.** For some costs the best protection is not a derivative at all: a fixed-rate electricity plan, a fuel-card price lock, a forward with the flour mill, a bank FX forward. A router that says "take the fixed-rate plan, here is the referral" earns trust and a referral fee. This is what separates CostShield from the other hackathon entries that only hedge on Gemini.

**Three versions of the model**

| Version | CostShield does | Revenue | Main risk |
| --- | --- | --- | --- |
| A. Pure router (start here) | Exposure data, pooling, auction, settlement rails | 10% to 15% take rate on premium, plus an analytics subscription | Getting both sides to show up |
| B. Router plus best-execution advice | A, plus referrals to off-market options (fixed-rate plans, price locks, forwards) | A, plus referral fees | Conflicts of interest must be disclosed |
| C. Risk-bearing (later, if forced) | Runs an MGA or holds some risk itself | Underwriting margin | Capital, licences, losses |

**The pressure you should plan for.** From our earlier research: Arbol started as a marketplace and ended up as an underwriter with an MGA and a licensed carrier. Regulators and capital providers want someone accountable. Design version A so it can grow into C without a rebuild.

**Unit economics, illustrative figures from the earlier model.** About $60,000 of hedgeable spend per business, premium at 3% to 6%, take rate 10% to 15%: roughly $180 to $540 of revenue per business per year. At that level direct sales and ads do not pay back. Embedded distribution inside accounting software, fuel cards and banks is required, which is one more reason the accounting integration is central and not a feature.

**Three things decide whether the router works:** regulation, distribution, and two-sided liquidity. Whether a parametric payout counts as insurance or as a swap depends on the jurisdiction and the structure. That needs a lawyer before anything real is sold. I am not one.

## 3. Every business type, every country

You can support all businesses and all countries without building 14 products, because the unit of the system is the risk pool and not the industry. A new industry is a new onboarding template. A new country is a new set of indices, connectors and partners plugged into the same engine.

**What is universal (build once)**

- Ledger import and expense classification.
- The exposure model: spend share, volatility, basis risk, coverage score.
- Pool definition: risk factor x region x period.
- The auction, the capped-call contract, collateral and settlement.
- The customer app.

**What is local (a registry, one row per country or region)**

| Layer | What changes by country | Examples to check |
| --- | --- | --- |
| Accounting connectors | Which software businesses use | QuickBooks (North America), Xero (UK, Australia, New Zealand), Sage, Zoho Books, Tally, DATEV, Conta Azul, Alegra, Siigo |
| Indices | Which public price or weather series settles the payout | EIA for US fuel, Brent for crude, TTF for European gas, national weather services, central bank rates |
| Units and currency | Gallons or litres, kWh, local currency | Shown in the owner's units, settled in a stable currency |
| Risk-takers | Who can price that pool | Local energy traders, regional insurers, global reinsurers |
| Legal wrapper | Insurance, derivative, or neither, and who must be licensed | One regulated partner per jurisdiction |
| Payout rails | How cash reaches the business | Local bank transfer, or USDC and EURC to a business wallet |

**Two shortcuts that make global realistic**

- **Unified accounting APIs.** Providers such as Codat, Merge and Rutter expose many accounting systems through one integration. Build against one of those plus CSV upload as the universal fallback, not against each package.
- **Stablecoin settlement.** Collateral and payouts in USDC on one chain means a specialist in Chicago can cover a pool of bakeries in Bogota without correspondent banking. This is the real answer to "why onchain?" for the judges.

**The router model is also what makes global possible.** CostShield does not need a licence to carry risk in 50 countries if a local regulated partner carries it. It needs the data layer and the marketplace.

**Limits to say out loud**

- A pool only works where a public, trusted, frequently published index exists and someone can hedge it. Many countries lack this for local electricity or food inputs.
- Regulation is per jurisdiction. "Global" in practice means a rollout order, not a launch day. A sensible order: US fuel, then US energy and weather, then UK and Australia through Xero, then FX for importers anywhere.
- Thin pools get bad prices. Each new region needs enough members before specialists will bid.

**How to show "all businesses, globally" in the product without overclaiming:** every exposure the engine finds gets one of four statuses.

| Status | Meaning | Example |
| --- | --- | --- |
| Protectable now | Index, pool and risk-taker exist | Diesel for a US fleet |
| Better handled another way | A fixed-price plan or supplier contract beats a hedge | Electricity in a deregulated market |
| Needs more data | The books alone cannot size it | Weather days lost, gallons vs. dollars |
| Not protectable yet | No clean index or no risk-taker | Rent, payroll, supplier-specific pricing |

A bakery in Mexico and a fleet in Illinois both get a full risk profile on day one. What differs is how many rows say "Protectable now".

## 4. Customer workflow, sign-up to payout

Build Version A as the core product, use Version B as the main way customers arrive, and add Version C as the retention feature once A works. All three share the same engine and the same eleven steps underneath.

### Version A: Connect and choose (self-serve, recommended core)

The owner comes to CostShield directly, connects the books, and picks protection from a ranked list.

1. **Sign up.** Email, business name, country. Nothing else yet. Analysis is free and needs no identity check.
2. **Connect accounting.** QuickBooks, Xero, others through a unified API, or CSV upload. The owner signs in on the provider's own consent screen. CostShield never sees the password, only reads the books and never changes them, and connecting authorizes no trades.
3. **Automatic analysis (under a minute).** Classify 12 to 24 months of expenses, map each cost to a risk factor and region, measure volatility and fit.
4. **Fill the gaps.** Ask only what the books cannot say: gallons or kWh behind a dollar total, where the fleet runs, whether customers already pay a fuel surcharge. Offer a fuel-card or utility connection in place of typing.
5. **Risk profile.** "We analyzed your business." Exposures ranked by dollars at risk in a bad year, each with one of the four statuses from section 3.
6. **Build a plan.** For a protectable exposure, choose how much to cover (capped at verified spend), the trigger level and the period. Show the live price, the maximum payout, the coverage score, and the plain list of when it will not pay.
7. **Verify and agree.** Business verification, eligibility check, disclosures, e-signature. The screen names the regulated provider that carries the risk. CostShield is shown as the platform, not the insurer.
8. **Pay and set the payout account.** Premium by bank debit, card or stablecoin. Payouts to a bank account or a business wallet.
9. **Cover starts.** Collateral is confirmed before the period begins. The owner sees "Fully funded" with a proof link.
10. **Monitor.** Index against trigger, projected payout this month, alerts when the trigger is close.
11. **Settle and renew.** The index publishes, the payout is computed and sent the same day, a receipt lands in Activity, and a matching entry is written back to the accounting software. Before the period ends the owner gets a renewal quote resized to the latest books.

What the customer receives in full: a risk report they keep even if they buy nothing, a protection certificate per plan, automatic payouts, a ledger entry for each payout, and a year-end statement of premiums paid and payouts received.

### Version B: Embedded (recommended for distribution)

The owner never visits CostShield first. The offer appears inside a tool they already use, which already has their data and their trust.

1. Inside their accounting app, fuel-card portal, POS or bank dashboard, a card says: "Diesel is 38% of your expenses. A 60 cent rise costs you about $6,000 a month. See protection."
2. One tap shares the data the partner already holds. No separate sign-up, no second connection.
3. Steps 5 to 11 of Version A run inside the partner's screens or a CostShield panel within them.
4. Premium is added to an existing bill or debited from the account on file. Payouts land in the same account.

Why it matters: at $180 to $540 of revenue per business, acquisition has to be nearly free. An accountant or bookkeeper portal is the same idea with a person in the loop: one advisor reviews risk profiles for 50 clients and recommends plans.

### Version C: Autopilot (budget-first)

The owner sets a goal, and CostShield keeps the cover in place.

1. Sign up and connect, as in A.
2. The owner states a goal in their own terms: "Keep my fuel cost under $4.20 a gallon" or "Spend at most $300 a month on protection".
3. CostShield proposes a standing plan across every protectable exposure and shows the worst and best case for the year.
4. One approval, with hard limits: maximum monthly premium, maximum price per period, pause at any time.
5. Each period CostShield enters the new auction within those limits, resizes to current spend, and reports what it did. If the price exceeds the limit it does not buy and tells the owner.
6. Payouts and ledger entries as in A.

This is the stickiest version, and the one with the most duty of care. It should come after A has real renewal data.

### How the three compare

|  | A. Connect and choose | B. Embedded | C. Autopilot |
| --- | --- | --- | --- |
| Entry point | CostShield site or app | Partner's product | CostShield, after A |
| Owner effort | About 10 minutes | About 2 minutes | One setup, then none |
| Acquisition cost | High | Low | None (existing customers) |
| Depends on | Marketing | A signed partner | Trust and renewal history |
| Hackathon demo | Yes, this is the build | Mention in the pitch | One slide at most |

### The specialist side (the other half of the marketplace)

Risk-takers have their own flow, and the judges will ask about it: get approved, see open pools with size, index and history, submit sealed bids, post collateral for winning bids, watch settlement, withdraw released collateral. This is a desktop-only console.

## 5. Desktop app

Desktop is where the owner onboards, studies the risk profile and builds plans. Use a left sidebar with four primary items, large dollar figures, one main chart per screen, and no trading or crypto vocabulary anywhere in the customer view.

**Navigation**

- Primary: Overview, My Risks, Protection, Activity.
- Secondary, at the bottom of the sidebar: Connections, Business profile, Documents, Settings.
- Separate from the customer app: Technical view (for judges and partners) and the Specialist console.

**Screens**

| Screen | What it shows | Primary action |
| --- | --- | --- |
| Welcome | One sentence of value, country and business name | Connect your books |
| Connect | QuickBooks, Xero, more providers, CSV upload, a plain privacy line | Connect |
| Analyzing | Live progress: transactions read, vendors grouped, exposures found | None, auto-advances |
| Gap questions | 2 to 4 questions the books cannot answer, each skippable | Confirm |
| Overview | Total at risk in a bad year, share protected, active plans, next settlement date, alerts | Review my risks |
| My Risks | Ranked exposure cards with status chip, dollars at risk, coverage score | Protect this |
| Risk detail | Your cost vs. the index over time, shock table, how well the index tracks your bills | Build a plan |
| Plan builder | Sliders for coverage share and trigger, live price, maximum payout, before and after bar, "when this will not pay" | Continue |
| Review and sign | Provider name, terms, disclosures, verification | Agree and pay |
| Protection | Active plans, index vs. trigger gauge, funded status with proof, renewal date | Renew or adjust |
| Activity | Premiums, payouts, receipts, export, sync-to-books status | Download statement |
| Connections | Accounting, fuel card, utility, bank, payout account, each with last sync and disconnect | Add or remove |

**Three layout versions**

| Version | Feel | Strength | Weakness |
| --- | --- | --- | --- |
| 1. Dashboard-first | Calm banking dashboard: sidebar, metric tiles, one chart | Familiar, good for returning users, scales to many plans | Cold for a first visit, the owner must find the story |
| 2. Guided | One question or one decision per screen, big type, progress bar | Best conversion for a first-time, non-financial owner | Slow for power users, awkward with many exposures |
| 3. Report-first | The risk profile as a readable report with protect buttons inline | Feels like advice, works well for accountants and for sharing | Weaker for ongoing monitoring |

**Recommendation:** Version 2 for onboarding through the first purchase, then drop the owner into Version 1 for everything after. Offer Version 3 as the "Download or share my risk report" export. That is one design system and three entry points, not three apps.

**UX rules for both platforms**

1. Dollars first. "A 60 cent rise costs you $6,000 a month", never "2.4 contracts".
2. Every plan shows what it does not cover, on the same screen as the price.
3. One coverage score, 0 to 100, with a sentence: "This plan tracks about 80% of how your fuel cost moves."
4. Status chips use the same four words everywhere.
5. Name the risk-bearing provider on every plan. CostShield is the platform.
6. Automate what the data shows, ask only what it cannot.
7. Customer words: "payout account", "funded", "receipt". Wallet addresses, transaction hashes and market names live in the Technical view.
8. Local by default: language, currency, litres or gallons, date format. Build English and Spanish first.
9. In the hackathon build, every simulated number and every testnet payout is labelled as such.

**Technical view (judges, partners, auditors).** For any plan: the raw market data pulled, the hedges considered and why each was accepted or rejected, pricing inputs, pool membership criteria, collateral balance, and the settlement transaction. The customer never needs this screen to understand what they bought.

## 6. Mobile app

Mobile is for the moments between decisions: checking whether a trigger is close, approving a renewal, and seeing a payout land. Full onboarding must work on a phone too, because in many countries the phone is the owner's only computer.

**Navigation:** a bottom tab bar with four tabs: Home, Risks, Protection, Activity. Profile and Connections sit behind an avatar at the top right.

**Screens**

| Screen | What it shows | Primary action |
| --- | --- | --- |
| Home | One headline ("You are protected against $4,800 of a $6,000 fuel shock"), next settlement, one alert | Open the alert |
| Risks | A vertical stack of exposure cards, status chip and dollars at risk | Tap for detail |
| Risk detail | One chart, one sentence, one coverage score | Protect this |
| Plan builder | One slider per screen (how much, then trigger), price and maximum payout pinned at the bottom | Continue |
| Review and sign | Short summary, expandable terms, face or fingerprint confirmation | Agree and pay |
| Protection | Plan cards with a trigger gauge and funded badge | Renew |
| Payout | Full-screen moment: amount, reason ("Diesel index averaged $4.61, your trigger was $4.20"), receipt link | Done |
| Activity | Simple list of premiums and payouts | Share statement |

**What mobile does that desktop does not**

- Push notifications: trigger approaching, payout sent, renewal quote ready, connection needs re-authorizing.
- One-tap renewal approval from the notification.
- Photo capture of a fuel receipt or utility bill to fill a data gap.
- Biometric confirmation for purchases and payout-account changes.

**What mobile leaves to desktop**

- Multi-exposure comparison tables and long history charts.
- CSV upload and document export bundles.
- The Technical view and the Specialist console.

**Two mobile versions**

| Version | Shape | Best for |
| --- | --- | --- |
| 1. Companion | Monitoring, alerts, renewals and payouts only. Onboarding hands off to the web. | Markets where owners already use desktop accounting software |
| 2. Mobile-first | The whole journey on the phone, guided one step per screen, with accounting sign-in in the phone's browser | Global rollout, micro and small businesses, embedded partners with mobile apps |

**Recommendation:** design Version 2 from the start. A guided, one-decision-per-screen onboarding is the same pattern recommended for desktop, so the mobile-first flow is the desktop flow in a narrower column. Ship it first as a responsive web app, then wrap it as a native app when push notifications and biometrics justify it.

**Mobile rules**

- One number per screen is the hero. Everything else is secondary.
- Thumb-reachable primary button, always in the same place.
- Works on a slow connection: cached last state, small payloads, no blocking spinners over the whole screen.
- Readable in sunlight and with one hand. The users are in trucks, kitchens and on job sites.

## 7. What to show by noon today, and what is roadmap

> Historical. This section was written before settlement moved from Arc testnet to Solana devnet. The Arc vault was not deployed and ledger sign-in has since been written. For what exists now, see `README.md`, `docs/LIMITATIONS.md` and `docs/DECISIONS.md`.

Pitch the platform for every business and every country, and demo one journey that fully works. Submission closes today at 12:00 PM Central. Rebuilding for 14 industries before then would cost you the working demo you already have.

**What exists, as of last night's build:** CSV import of a QuickBooks export, rule-based classification, exposure measurement, pool assignment, hedge evaluation (NYMEX diesel options priced, Gemini markets read live and rejected with reasons), a backtest over 131 cohorts, seven screens plus a judge mode, and a tested vault contract. Not done at that point: the Arc deployment (wallet unfunded), hosting, the repo push, the video, live QuickBooks sign-in.

**Order of work for the hours left**

- [ ] Fund the underwriter wallet from the Circle faucet and deploy the vault to Arc testnet. One real settlement transaction is the centre of the demo.
- [ ] Push the public repo and deploy the app.
- [ ] Record the 2 to 3 minute video and complete the Devpost form. Submit a complete version by 10 AM, then edit.
- [ ] Only if time remains: add two more sample ledgers (a bakery, a construction contractor) through the same classifier, so the risk profile shows the four statuses across three industries.
- [ ] Only if time remains: add a "Supported risk pools" page listing the five risk families by region, with everything outside US diesel marked as planned.

The two optional items are the cheapest way to make "all businesses, globally" visible. Both are data and labels on screens you already have. Neither touches pricing or the contract.

**What to say, so the claim is big and still true**

- "CostShield pools by risk, not by industry, so the same engine serves a fleet in Illinois and a bakery in Bogota."
- "Today one pool is live end to end on testnet: US diesel. The engine already tells every other business which of its costs are protectable, which are better handled another way, and which are not hedgeable yet."
- "We are the router. Specialists carry the risk and post collateral. We never set the price."
- "Stablecoin settlement is what lets a risk-taker in one country cover a pool in another."

**Questions to have an answer for**

| Question | Short answer |
| --- | --- |
| Who pays the payout? | The specialist who won the pool, from collateral posted before cover began. In the demo, a pre-funded testnet vault. |
| What about basis risk? | Measured per business and shown as the coverage score. The engine refuses hedges that do not track the cost. |
| Is this insurance? | Depends on jurisdiction and structure. A regulated partner provides the wrapper. The demo is a simulation and sells nothing. |
| Why would specialists show up? | They price a standard pool they can hedge in futures, and earn the spread. Demand they cannot reach today is aggregated for them. |
| Why onchain? | Visible collateral, automatic settlement, and cross-border payouts without correspondent banking. |
| Why Gemini? | Regulated event markets are the venue a small business can legally access for exposures that fit no futures contract. Where no market fits, the engine says so. |

**After the hackathon, in order:** live accounting sign-in through a unified API, a second pool (US natural gas or rainfall), the specialist console with a real auction, one embedded distribution pilot, then the first non-US region.

## 8. Decisions made after this doc

These came out of the design session that followed. Where they differ from sections 5 to 7, they win.

**Priority.** The submission deadline no longer drives the work. The goal is the best possible user experience, so the "order of work for the hours left" in section 7 is history, not a plan.

**One experience, not several versions.** The layout and mobile "versions" in sections 5 and 6 were options. The choice is a single experience on both platforms: one sentence per screen and one number as the hero.

**Screens designed so far (eight, on one design canvas)**

| Platform | Screen | What it does |
| --- | --- | --- |
| Mobile | Connect | One promise, three ways to connect the books, and a reassurance that we only read them |
| Mobile | Risk profile | The biggest exposure in dollars with one "Protect this" button; the other costs each tagged with a plain status |
| Mobile | Build a plan | A slider for how much to cover. Payout, the amount still carried, the maximum and the price update as it moves. "When it will not pay" sits on the same screen as the price |
| Mobile | Home | How much the business is protected against, and a single gauge of the index against the trigger |
| Mobile | Payout | The amount, why it paid, and where it went |
| Desktop | Overview | The protected headline, the index-versus-trigger chart, the active plan and recent activity |
| Desktop | My Risks | The protectable exposure as the hero; everything else as rows with the reason for each status |
| Desktop | Build a plan | The same slider, with a plan summary beside it |

**Look.** Deep green on a cool off-white, picking up the green of the app icon. No design system is applied yet.

**Placeholders in the mockups.** Every figure is for the fictional 10-truck fleet. The $360 quote, "five providers bid", the 6% and 9% expense shares and the index history are invented for the mockup. `[Provider name]` marks where the regulated risk-bearing partner goes.

**Not designed yet.** Gap questions, review and sign, the activity list, connections, the Technical view and the Specialist console.

## Sources

Built from the team's notes and screenshots and three earlier planning chats, which are private and not linked here. Figures quoted from them were not re-checked today.

- Cost-protection platform feasibility
- IB - UBC - Hackathon (router model, pooling, auction, unit economics)
- CostShield hackathon product strategy (build status at the time)
