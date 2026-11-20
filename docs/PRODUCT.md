# Product requirements and UX specification

## PRD

**Target user.** The owner of a for-hire trucking fleet with roughly 3 to 20 trucks. Fuel is about a fifth to a quarter of cost, margins are under 1%, and part of the freight is hauled with no fuel surcharge. The owner has never traded a derivative and keeps books in QuickBooks.

**Problem.** A bad diesel year costs this business several times its annual profit. Large carriers hedge. Small ones cannot size the exposure, find the instrument, or meet contract minimums.

**MVP.** One working journey: upload an accounting export, get a measured diesel exposure and an honest verdict on what can and cannot be protected, simulate a shock, and watch a funded payout settle privately on Solana devnet, then share read-only proof of it with a lender.

**Out of scope.** Selling cover, taking premiums, executing hedges, QuickBooks OAuth, more than one priced risk, more than two diesel regions.

**Acceptance criteria**

| # | Criterion | Status |
| --- | --- | --- |
| 1 | A QuickBooks-style CSV with report preamble rows imports with a per-reason count of skipped rows | Met, tested |
| 2 | A malformed file yields a specific error message and no partial result | Met, tested |
| 3 | Every expense line gets a category, rule id and confidence, or is marked unclassified | Met, tested |
| 4 | Fuel exposure reports spend share, gallons (observed vs estimated), index fit, shock table and materiality | Met, tested |
| 5 | The fit to the index is only measured from gallons present in the ledger | Met, tested |
| 6 | Pool assignment shows each criterion, pass or fail, and a confidence score | Met |
| 7 | Gemini data is fetched live; if unreachable the UI says so and pricing falls back to a labelled assumption | Met, tested |
| 8 | No Gemini market is presented as a hedge unless it passes every screen | Met, tested |
| 9 | Scenario outputs are pure arithmetic on visible inputs | Met, tested |
| 10 | A settlement produces real Solana devnet transactions, Explorer links and the fleet's decrypted balance before and after | Met once the program is deployed and `npm run solana:setup` has run |
| 11 | Reports from anyone but the oracle, releases of untriggered steps, releases by anyone but the fleet and double releases are refused by the program | Met on devnet; the stranger and duplicate refusals are shown on every settlement |
| 12 | Step amounts, the payout and balances are encrypted on chain; the payout screen shows the fleet's view next to the public chain's view | Met with Helius Privacy Rings |
| 13 | A lender link shows each step's trigger, funded amount and paid status, read-only | Met; decryption runs on the demo server |
| 14 | Every screen states that this is a simulation | Met |

## UX specification

Design intent: a business-banking product, not a trading terminal. Warm paper background, one serif display face for headlines and big numbers, a neutral sans for everything else, one green accent for "paid" and one amber for "risk". Numbers use tabular figures. Evidence chips (V, C, E, A) sit next to numbers so an owner can ignore them and a judge can read them.

| Screen | Purpose | Key interactions | Data it needs | Narrow screens |
| --- | --- | --- | --- | --- |
| Welcome | Value proposition | "Analyze my business"; "Explore a sample company" runs the full pipeline on the sample | None | Single column |
| Connect | Bring in records | File picker and drag-and-drop; sample company; region select; consent checkbox required before upload; QuickBooks card shown as not connected, with export instructions | Sample CSV in `public/sample` | Cards stack |
| Analysis | Show real processing | Seven stages, each with server-measured time and its actual result; errors name the failing stage and offer a way back | NDJSON from `/api/analyze` | Unchanged |
| Your risks | Plain-language findings | Scroll only. Headline changes with the verdict (one risk, or none) | `financials`, `diesel`, `pool`, `others` | Two-column grids collapse |
| Protection | Terms, cost, history, hedge test, who pays | Scroll only. "Not available to buy" is stated on the card | `policy`, `backtest`, `markets`, `hedges` | Tables scroll sideways |
| Simulate | One month of impact | Sliders for price rise, gallons, un-surcharged share, volatility; four deductible choices; three presets | `scenario()` and `priceCap()` run in the browser | Controls above results |
| Payout | Replay and settle privately | "Settle privately" streams settlement steps with Explorer links, private steps marked "amounts encrypted"; stepped payout next to the linear amount; each step's trigger, amount and release; fleet balance before and after; refused attempts; "What {company} sees" next to "What the public chain shows"; "Share with your lender" link with a copy button; honest "not configured" state | `/api/chain`, `/api/settle` | Two views stack; result card full width |
| Lender | Read-only proof for a lender | Opened from the shared link; decodes the share from the URL fragment and shows each step's trigger, funded amount and paid status, totals and check time | `/api/lender` | Tables scroll sideways |
| Judge mode | Technical evidence | Five tabs: provenance, classification, statistics, Gemini, settlement program (addresses, privacy model, safeguards, trust assumptions) | Whole analysis object and chain status | Tables scroll sideways |

States covered: empty (welcome), loading (analysis stages, checking the chain, "Settling…", decrypting on the lender page), error (bad file, consent missing, file too large, Gemini unreachable, chain not configured, program refusal, damaged or missing lender link), and success.
