# Decision log

Newest first. One or two lines each: what was decided, why, and where the detail lives. Add a line whenever the team settles something. If a decision is reversed, add a new line; do not edit the old one.

## Open questions

- **QuickNode Streams bounty: enter or not?** Not integrated today.
- **Colour theme and final UI direction.** A proposal with four themes is on the `design/ui-ux-proposal` branch. Not merged, not decided.
- **Docs drift to fix before submitting.** `docs/LIMITATIONS.md` and `docs/SUBMISSION.md` still say QuickBooks and Xero OAuth were not built, but ledger sign-in for four providers was merged on Nov 20. State exactly which providers work end to end.

## 2026-11-20

- **Entering the Gemini Prediction Markets bounty.** The engine calls Gemini's Prediction Markets API live for market discovery, screens each market as a hedge, and fits an implied volatility from the Brent ladders to price the cap. Gemini lists no diesel market, so we say plainly that it is rejected as a direct hedge. Do not describe providers as hedging on Gemini; that is not built.
- **UI/UX proposal drafted, not adopted.** Owner navigation becomes Overview, Costs, Protection, Payments, with a three-step onboarding (connect, confirm, review offer) and a separate provider workspace. Pool matching moves to the background. See `design/` on the `design/ui-ux-proposal` branch.
- **Never call the accounting connection "read-only".** The standard QuickBooks scope can write. We say the app only reads and never changes the books, and the code has to keep that true.
- **Ledger sign-in added** for QuickBooks, Xero, Zoho Books and FreshBooks, connecting to each provider directly (`lib/ledger/`). CSV upload stays as the fallback that always works.
- **Settlement moved from Arc testnet to Solana devnet with Helius Privacy Rings.** Chain award changed to Best use of Solana. Reasons: covered gallons and payouts stay private, the fleet can prove cover to a lender with a read-only viewing key, and parametric USDC cover on Arc already exists among other entries. See `docs/SOLANA_PORT.md`. The Arc vault stays in `contracts/` as archived work.
- **Lender page added.** A shared link gives a lender read-only proof of each step's trigger, funded amount and paid status.
- **Router model.** CostShield measures, pools, runs the price competition and settles. Specialists carry the risk and post collateral. CostShield never sets the price. See `docs/CONCEPT.md` section 2.
- **Pool by risk, not by industry.** A pool is one index, one region, one period. Business type is only for onboarding and marketing. See `docs/CONCEPT.md`.
- **Pitch the platform for every business, demo one journey that fully works** (US diesel for a fleet). Other exposures are sized and labelled, not priced.

## 2026-11-19

- **Hackathon project is CostShield**: ledger-driven cost protection for small businesses. Main track: DeFi and Onchain Applications.
- **Diesel for small trucking fleets is the first wedge.** Transparent index, repeatable consumption, a liquid hedge behind it.
- **Deterministic engine, no LLM in the pipeline.** Every number is labelled verified, calculated, estimated or assumed.
- **The product is allowed to say no.** A hedge that fails on index, tenor, depth or fit is shown as rejected, with the reason.
- **Simulation only.** No real premiums, orders or payouts. Every screen says so.
