# Product requirements and UX specification

## PRD

**Target user.** The owner of a for-hire trucking fleet with roughly 3 to 20 trucks. Fuel is about a fifth to a quarter of cost, margins are under 1%, and part of the freight is hauled with no fuel surcharge. The owner has never traded a derivative and keeps books in QuickBooks.

**Problem.** A bad diesel year costs this business several times its annual profit. Large carriers hedge. Small ones cannot size the exposure, find the instrument, or meet contract minimums.

**MVP.** One working journey: upload an accounting export, get a measured diesel exposure and an honest verdict on what can and cannot be protected, simulate a shock, and watch a funded payout settle privately on Solana devnet, then share read-only proof of it with a lender.

**Out of scope.** Selling cover, taking premiums, executing hedges, more than one priced risk, more than two diesel regions.

**Ledger sign-in.** Sign-in code exists for QuickBooks Online, Xero, Zoho Books and FreshBooks. It is unit-tested against mocked provider responses (QuickBooks end to end, the other three for line mapping only) and has not been verified against a live provider account. The demo has no provider keys, so the Books screen shows one line: sign-in is built but switched off in this demo. A provider's card appears only when the server holds its keys. CSV upload is the working path.

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
| 10 | A settlement produces real Solana devnet transactions, Explorer links and the fleet's decrypted balance before and after | Met on devnet: the program is deployed and settlements have run. Needs the Solana keys, so it does not run without them |
| 11 | Reports from anyone but the oracle, releases of untriggered steps, releases by anyone but the fleet and double releases are refused by the program | Met on devnet; the stranger and duplicate refusals are shown on every settlement |
| 12 | Step amounts, the payout and balances are encrypted on chain; the payout screen shows the fleet's view next to the public chain's view | Met with Helius Privacy Rings |
| 13 | A lender link shows each step's trigger, funded amount and paid status, read-only | Met; decryption runs on the demo server |
| 14 | Every screen states that this is a simulation | Met |

## UX specification

Design intent: a business-banking product, not a trading terminal. Since the Nov 20 redesign: colour tokens in `app/globals.css`, Inter for text and Geist Mono for figures, dark green for action and protection, amber for risk, and a simulation notice at the top of every page. Light mode is the default; a button in the landing nav and the app sidebar switches to dark mode and the choice is kept in the browser. The app has a sidebar with five steps (Books, Risks, Protection, What if, Payouts) and a Judge mode button. Risks and Protection open in a Simple view with a switch to Detailed: Simple keeps the findings, the price, the hedge verdicts and every "not available" label; Detailed adds the index fit, the risk pool, the backtest chart, the full hedge test, the payment chain and the data-quality table. The earlier warm-paper single-page UI is on the `classic-ui` branch. Numbers use tabular figures. Evidence chips (V, C, E, A) sit next to numbers so an owner can ignore them and a judge can read them.

| Screen | Purpose | Key interactions | Data it needs | Narrow screens |
| --- | --- | --- | --- | --- |
| Landing (`/`) | Value proposition | Links into the app at `/app`; the primary button, "Try the sample fleet", opens `/app?sample=1` and runs the full pipeline on the sample. Its figures are computed at build time by the engine on the sample fleet, with market discovery skipped | `components/landing/data.ts` | Single column |
| Connect | Bring in records | Sample fleet and CSV upload (file picker and drag-and-drop) come first; region select; consent checkbox required before upload; one line saying sign-in for QuickBooks, Xero, Zoho Books and FreshBooks is built but switched off in this demo, with a sign-in card only for a provider whose client id and secret the server holds | Sample CSV in `public/sample`; `/api/connect/status` | Cards stack |
| Analysis | Show real processing | Seven stages, each with server-measured time and its actual result; errors name the failing stage and offer a way back | NDJSON from `/api/analyze` | Unchanged |
| Your risks | Plain-language findings | Scroll only. Headline changes with the verdict (one risk, or none) | `financials`, `diesel`, `pool`, `others` | Two-column grids collapse |
| Protection | Terms, cost, history, hedge test, who pays | Scroll only. "Not available to buy" is stated on the card | `policy`, `backtest`, `markets`, `hedges` | Tables scroll sideways |
| Simulate | One month of impact | Opens on the "Like September 2026" preset. The largest number is what the owner is out that month, next to the cost without protection; the price of protection is labelled "if bought today". Sliders for price rise, gallons, un-surcharged share, volatility; four deductible choices; three presets | `scenario()` and `priceCap()` run in the browser | Controls above results |
| Payout | Replay and settle privately | The chart opens on the settlement month, with the replay amount and the amount in 25-cent steps side by side. "Settle privately" streams settlement steps with Explorer links, private steps marked "amounts encrypted"; stepped payout next to the linear amount; each step's trigger, amount and release; fleet balance before and after; refused attempts; "What {company} sees" next to "What the public chain shows"; "Share with your lender" link with a copy button. On a server without keys there is no settle button: for the sample fleet the screen says "This settlement ran on Solana devnet" and links the team's Nov 20 transactions from the README; for any other ledger it says the server does not settle that month and links the sample fleet's run | `/api/chain`, `/api/settle` | Two views stack; result card full width |
| Lender | Read-only proof for a lender | Opened from the shared link; decodes the share from the URL fragment and shows each step's trigger, funded amount and paid status, totals and check time | `/api/lender` | Tables scroll sideways |
| Judge mode | Technical evidence | Opened from the "Judge mode" button in the app's sidebar (top bar on a phone) once an analysis exists. Five tabs: provenance, classification, statistics, Gemini, settlement program (addresses, privacy model, safeguards, trust assumptions) | Whole analysis object and chain status | Tables scroll sideways |

States covered: empty (Books), loading (analysis stages, checking the chain, "Settling…", decrypting on the lender page), error (bad file, consent missing, file too large, Gemini unreachable, chain not configured, program refusal, damaged or missing lender link), and success.
