# Decision log

Newest first. One or two lines each: what was decided, why, and where the detail lives. Add a line whenever the team settles something. If a decision is reversed, add a new line; do not edit the old one.

## Open questions

- **QuickNode Streams bounty: enter or not?** Not integrated today.
- **Colour theme and final UI direction.** A proposal with four themes is on the `design/ui-ux-proposal` branch. Not merged, not decided. (Merged on Nov 20, see below.)

## 2026-11-20

- **The light, green, Simple-first UI is what we submit.** Julian chose it over the dark redesign and the earlier UI; `friendly-ui` was fast-forwarded into `main`. The earlier UI stays on `classic-ui`, and the dark redesign as merged is commit `1bb1955`.
- **Light mode is the default, dark mode is a button** (`components/theme.tsx`, tokens in `app/globals.css`). The accent changes from ember orange to dark green in both themes, with amber kept for risk. Reason: owners should read this as a safe business tool, not a crypto product. Built on the `friendly-ui` branch.
- **Simple view first, Detailed on a switch** for Risks and Protection. Simple never hides a "not available", "rejected" or "signal only" label. Judge mode stays the technical view. Choosing the view automatically by business size is not built: no threshold has been agreed.
- **Aabis's redesign is merged** (`design/ui-ux-proposal`): landing page at `/`, the app at `/app`, dark token-based theme. This reverses "Cut before submission: merging `design/ui-ux-proposal`" below. Julian asked for it. The earlier UI stays viewable on the `classic-ui` branch.
- **`motion` accepted as a dependency.** The redesign's animations use it. It is the one exception to "no new dependencies before submission".
- **Judge mode stays.** The redesign removed it; Julian wants it back. It opens from a button in the app's sidebar once an analysis exists.
- **The redesign keeps the honesty rules.** The simulation notice is on the landing page, the app and the lender page. Replayed months read "would have paid", not "paid". "Settled privately below" appears only after a real devnet settlement. The landing page says the cover is not for sale and that no insurer has agreed to carry it.
- **Hosted demo runs without settlement keys.** The live link is a Vercel deployment with no env vars. Everything runs except private settlement, which shows its not-configured note. Proof of settlement is the video and the Explorer transactions in the README. Reasons: keys on a public host let anyone spend the devnet wallets, and the Privacy Rings WASM is untested on a serverless host.
- **Without keys, Judge mode shows the deployed program's public wallets** from `deployments/solana-devnet.json`, not addresses derived from whatever keys are on the machine (`lib/chain/server.ts`).
- **How we describe the Arc work.** Archived, written for Arc testnet, not deployed (`deployments/arc-testnet.json` holds no addresses). Labelled in `contracts/README.md`, `scripts/chain.ts`, `scripts/export-abi.cjs`, `lib/chain/arc/` and the README. Nothing deleted or renamed.
- **Disclose the upgrade authority and unfinished runs.** The program is upgradeable by the wallet that deployed it (read from devnet), and one devnet policy was left half-settled. Both are stated in the README and `docs/LIMITATIONS.md`.
- **Cut before submission.** Merging `design/ui-ux-proposal`; settlement on the host; narrowing the Xero and QuickBooks scopes; the "0 contracts" depth text in `lib/engine/pipeline.ts` (stated in `docs/LIMITATIONS.md` instead); the small premium difference between Protection and Simulate; new tests for `lib/chain/`, the API routes, the lender share and the stepped payout; renaming the repo from `orange-cat`.
- **How we describe ledger sign-in.** Built, not verified live: code for QuickBooks Online, Xero, Zoho Books and FreshBooks, unit-tested against mocked responses (QuickBooks end to end, the others line mapping only), never run against a live account, and off in the demo ("Needs keys"). CSV upload is the working path. The full status lives in Judge mode, `docs/LIMITATIONS.md` and `docs/PRODUCT.md`; owner-facing and Devpost copy stays short and points there. The Connect tag reads "Only reads your books", not "Read only". Closes the open docs-drift question.
- **How we describe Equity Floor.** The settlement program, chain code and checks are adapted from Equity Floor, our first idea for this hackathon, written during the event and set aside on Nov 20. Every mention in code comments, Judge mode and docs uses that wording; the old "ported from our earlier program" phrasing and the `../archive/` path (not in this repo) are gone. Rust change is comments only, so no redeploy.
- **Submit without a new settlement run unless Aabis returns in time.** Aabis was unreachable on the morning of Nov 20. This machine has no `.solana-keys/` folder and no Helius key, and the program accepts only the oracle key compiled into it (`ORACLE` in `solana/program/src/lib.rs`), so creating new wallets here cannot settle. Proof of settlement is the program's Explorer page with the earlier devnet run. Aabis gets repo access later. Ledger sign-in is treated as not verified against a live provider.
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
