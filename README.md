# CostShield

> **Design proposal on this branch:** a reworked UI/UX for the owner app and a provider workspace lives in [`design/`](design/README.md). It is reference material, not shipped code.

**Cost protection for small businesses, starting from the ledger.** A business uploads its accounting export. CostShield classifies the expenses, measures which costs follow a market price, assigns a risk pool, tests whether any real instrument hedges the risk, prices and backtests a diesel price cap, and settles a replayed price shock as a private payout on Solana devnet, using Helius Privacy Rings so the amounts stay encrypted on chain. The business can prove its cover and payouts to its lender with a read-only key.

> This is a simulation built for the UBC 2026 Hackathon. It is not an offer of insurance or derivatives. It takes no real premiums, places no orders and pays no real money. Devnet test dollars only.

| | |
| --- | --- |
| Main track | DeFi and Onchain Applications |
| Chain award | Best use of Solana |
| Bounty | Gemini Prediction Markets |
| Live demo | _add your deployment URL_ |
| Demo video | _add your video link_ |

## What it does

1. **Import.** A real CSV importer reads QuickBooks Online "Transaction Detail" exports (including the report rows above the header) and generic exports with Debit/Credit columns. Unreadable rows are counted and reported.
2. **Classify.** Ordered, deterministic rules map vendor, account and memo to cost categories and risk factors. There is no LLM in the pipeline. Unmatched lines stay "unclassified".
3. **Measure.** Spend shares, monthly volatility, concentration, a shock table computed from EIA history, and a regression of the price the business paid per gallon against its regional diesel index.
4. **Pool.** A pool is cost driver x region x cover period. Six explicit criteria produce a membership status and a confidence score. Joining a pool does not mean protection is available.
5. **Evaluate hedges.** NYMEX ULSD options are modelled with Black-76. Gemini Prediction Markets are read live and scored against the business's cost. They are rejected as a hedge when they fail on index, tenor, depth or fit.
6. **Price and backtest.** 131 rolling 12-month cohorts on real prices, 2015 to 2026.
7. **Settle privately.** A program on Solana devnet holds the cover as a ladder of steps. The underwriter funds each step in advance from its private balance. An oracle key posts the EIA monthly mean with the data file's sha256. The program lets the fleet release every step whose trigger the index reached, and Privacy Rings pays the fleet in encrypted test dollars (tUSD). Amounts, payouts and balances are encrypted on chain.
8. **Share with a lender.** The fleet sends its lender a link that carries read-only viewing keys. The lender's page shows each step's trigger, funded amount and whether it paid. The key can decrypt, not spend.

The demo company is a synthetic 10-truck Midwest fleet. Its result: diesel is 26% of revenue, a 1-in-20 price year costs about 8 times annual operating profit after surcharges, and a cap bound in November 2025 would have paid about $25,950 through October 2026 under the linear cap formula. On chain the cap pays in $0.25-per-gallon steps, so a settled month pays the linear amount rounded down to the step.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
npm test               # 31 engine tests
npm run test:contracts # earlier work: 15 Foundry tests for the Arc vault (needs Foundry)
```

The app works without any keys: analysis, Gemini evaluation, pricing, backtest and the replay all run. Only private settlement and the lender page need the Solana setup below. Without it, the payout screen says settlement is not configured and why.

### Private settlement on Solana devnet

```bash
npm run solana:setup   # idempotent: wallets, devnet SOL, tUSD mint and Rings registration, private deposits
npm run solana:e2e     # one settlement end to end; prints Explorer links
```

Secrets live in `.env.local` (Helius devnet API key) and `.solana-keys/` (wallet keypairs). Both are gitignored. Never commit them. Public addresses (program id, mint, role wallets) are written to `deployments/solana-devnet.json`, which is committed and read by the app.

<!-- DEPLOYMENT:START -->
### Deployed program

Addresses are in [`deployments/solana-devnet.json`](deployments/solana-devnet.json), including the CostShield program id and the underwriter, oracle and fleet wallets. Fixed addresses:

- Helius Privacy Rings program: `ring1GaLCuJnkUMVkX2JeZLTTX17wKsV4fZmPVzXANW`
- tUSD test mint (6 decimals, Rings asset 427): `FQKedE1cBThwLvc1FJ1xr5b3DPYGVwRNVKrQVSHmCfv8`

Explorer links use `https://explorer.solana.com/...?cluster=devnet`.
<!-- DEPLOYMENT:END -->

## Architecture

```
Browser (Next.js, React, Tailwind)
  welcome -> connect -> analysis -> risks -> protection -> simulator -> payout   + judge mode
  /lender#<share>   read-only lender view (key in the URL fragment)
        |  POST /api/analyze (NDJSON stream of real pipeline stages)
        |  GET  /api/chain   (program, mint, roles, decrypted demo balances)
        |  POST /api/settle  (NDJSON stream of settlement steps on Solana devnet)
        |  POST /api/lender  (decrypts step balances with the shared viewing keys)
        v
Server (Next.js route handlers, Node runtime)
  lib/engine/   pure TypeScript, no I/O except the Gemini client
    ingest.ts     CSV parser and column mapping
    classify.ts   rule-based categorisation, gallons from memos
    exposure.ts   financials, diesel exposure, OLS fit, shock table, materiality
    pool.ts       risk-pool criteria and confidence
    pricing.ts    Black-76 call strip
    backtest.ts   rolling cohorts and effectiveness metrics
    payout.ts     cap payout, scenario arithmetic, policy replay
    gemini.ts     market data client, implied distribution, ladder replication, verdicts
    pipeline.ts   orchestration with stage events
  lib/data/     EIA snapshots (scripts/fetch_eia.py), each with source URL and fetch time
  lib/chain/    Solana devnet access, Privacy Rings transfers, settlement flow
                (types.ts is the shared contract with the UI)
        |                                  |
        v                                  v
Gemini public REST API            Solana devnet
(events, order books)               CostShield program (solana/program, Pinocchio)
                                      step accounts, oracle reports, release, reclaim
                                    Helius Privacy Rings
                                      encrypted tUSD balances, step vaults owned by the program
```

No database. An uploaded file is processed in memory for the request and is not stored.

## How CostShield uses Solana

The settlement program is a Pinocchio program on Solana devnet, ported from our earlier Equity Floor program (`solana/program`). It keeps public terms and private money apart:

- **Step accounts (public).** Each policy month is a ladder of steps. A step account stores the terms only: the fleet, the underwriter, the index id (EIA regional diesel), the period (YYYYMM), and the trigger price in 1/1000 $ per gallon. Both parties sign when the steps are created. No amount is stored.
- **Step vaults (private).** Each step's money sits in a Privacy Rings private balance owned by a program-derived address `["vault", step]`. Only the program can sign for it. The underwriter funds all steps in advance in one private transfer.
- **Oracle reports (public, write-once).** One oracle key posts the EIA monthly mean for a period together with the sha256 of the data file it used. A second report for the same index and period is refused.
- **Release.** The fleet signs `release` for a step. The program checks that the report is authentic, matches the step's index and period, and is at or above the trigger, then signs for the vault and calls Privacy Rings, which pays the fleet privately. The step is marked paid.
- **Reclaim.** After every period of the term is reported, the underwriter can take back steps that never triggered.

Money is tUSD, a devnet test dollar with 6 decimals, registered with Privacy Rings. 1 tUSD stands for $1. There is no demo scaling.

Why Solana: per-step accounts and program-derived vaults make "pay only if this public condition holds" cheap to express, and Helius Privacy Rings gives encrypted balances that a program can own and spend by CPI. That combination lets the condition be public while the money is private.

## Privacy model

A fleet's covered gallons reveal its volume. A payout reveals margin stress. Shippers, brokers and competitors would like to know both. So amounts are private by default, and provable on demand.

| Public on chain | Encrypted (only key holders can read) |
| --- | --- |
| Wallet addresses (fleet, underwriter, oracle), step and vault accounts | Each step's funded amount |
| Step terms: index, period, trigger prices, number of steps | Payout amounts |
| Oracle reports: monthly mean and data-file sha256 | The fleet's and underwriter's balances |
| Which steps are open, paid or reclaimed, and that a private transfer happened | |

**Lender disclosure.** The payout screen has "Share with your lender". It builds a link `/lender#<share>`, where the share holds the policy id and, for each step, its account, vault and a viewing key. A viewing key decrypts a step's private balance. It cannot spend it. The lender opens the link and sees each step's trigger price, funded amount and whether it paid, with totals and the time it was checked. The fleet proves it is protected and was paid without publishing either fact.

Caveats, stated plainly:

- The key travels in the URL fragment, which browsers do not send with page requests. In this demo, though, the `/lender` page posts the share to the CostShield server, which does the decryption. A production version would decrypt in the lender's browser.
- The demo server holds every party's keys and all step viewing keys. It decrypts the fleet's and underwriter's balances for display.
- Helius's prover sees plaintext amounts inside attested hardware (a TEE).
- Trigger prices and the number of steps are public. Anyone who knows the step size and the fleet's covered gallons could infer amounts. The gallons are not published.
- Depositing tUSD into a private balance (the public onramp) reveals the deposit amount.

## How CostShield uses Gemini Prediction Markets

Endpoints (public, no key): `GET /v1/prediction-markets/events?status=active&category=…` and `GET /v1/book/{instrumentSymbol}`. Used at analysis time, live:

- **Discovery.** Every active Commodities and Economics event is mapped to a cost driver (diesel, natural gas, interest rates) or to nothing, with the reason shown.
- **Hedge suitability.** Each related market is scored on index match, 12-month fit to the business's cost, tenor against a 12-month cover period, displayed depth against one pool-month, and quote presence. There is no diesel market on Gemini today. The Brent ladders are the closest, and they fail: Brent explains 77% of 12-month retail diesel moves against 96% for ULSD, the ladders expire in days, and depth covers about one fleet. They are reported as "signal only".
- **Implied volatility.** A ladder of "Brent above K" binaries is a survival curve. The engine fits a lognormal to the two-sided quotes and annualises the slope. That implied volatility is the default volatility input to the cap price, replacing an options data feed the project cannot license.
- **Ladder replication.** The engine sizes the binary ladder that would replicate one fleet-month of cap, walks each ask book, and reports cost and unfilled size.

CostShield places no orders and Gemini markets do not settle the program.

## Economic design and risk assumptions

- **Product.** A purchase-linked diesel cap. The index is the EIA regional weekly retail diesel price, averaged over the month. The strike `K` is the index at inception plus $0.50. Covered gallons are the business's own purchases times the share not already billed under a fuel surcharge, capped per month. The model and replay use the linear cap: `max(0, index mean - K) x covered gallons`.
- **Steps on chain.** The program cannot read encrypted amounts, so it cannot compute a linear payout. The cap is split into steps of `D` = $0.25 per gallon. Step `i` (1-based) triggers when the monthly mean is at or above `K + i x D` and pays `D x covered gallons`. Steps run up to `K + $2.00`, so 8 steps. The stepped payout is the linear cap rounded down to the step: `D x min(8, floor((index mean - K) / D)) x covered gallons`. The payout screen shows both numbers.
- **Collateral.** The underwriter funds every step's private vault in advance, so a triggered step is already paid for. Funding amounts are encrypted, so the program cannot check them. The fleet (or its lender) checks them by decrypting. Untriggered steps go back to the underwriter after the term. A real programme would hedge the pool with ULSD options and hold capital only against the retail-to-wholesale basis.
- **Correlation.** Every policy on one index pays at the same time. A diesel pool is one large short option, not a diversified book. Pooling here is for hedge sizing (one ULSD contract is 42,000 gallons, about 15 fleets of this size per contract-month), not for diversification.
- **Basis risk.** The index is not the business's pump price. The engine measures the gap from ledger gallons and shows it. An index cover cannot remove it. Steps add a little more: a month just below the next trigger pays up to $0.25 a gallon less than the linear cap.
- **Pricing.** Black-76 on EIA spot with a flat forward curve, one volatility, mid-month expiries and a 30% load. No skew, no bid/offer. Real cost would be higher. Pricing uses the linear cap, which slightly overstates the stepped cover's value.
- **Oracle.** One trusted key. The server recomputes the monthly mean from its own EIA data, ignores prices sent by the browser, and posts the mean on chain with the data file's sha256. This is a trusted oracle, disclosed as such.
- **Money.** tUSD devnet test dollars at 1 tUSD = $1. No real funds.

More in [docs/MODEL.md](docs/MODEL.md) and [docs/LIMITATIONS.md](docs/LIMITATIONS.md).

## Data provenance

| Data | Source | Status |
| --- | --- | --- |
| Diesel, ULSD and Brent price history | U.S. EIA public series, fetched by `scripts/fetch_eia.py` into `lib/data/` | Real |
| Prediction market quotes and books | Gemini public API, read live | Real |
| Sample ledger | `scripts/generate-ledger.ts`, fixed seed, fuel prices built on the EIA Midwest index | Synthetic |
| Shock sizes, fit statistics, backtest | Calculated by the engine from the data above | Calculated |
| Volatility | Implied from the Gemini Brent ladder, or 40% if Gemini is unreachable | Signal or assumption |
| Premium | Model price | Assumption |
| Oracle report on chain | Monthly mean recomputed by the server from the EIA snapshot, posted with the file's sha256 by one oracle key | Real data, trusted reporter |
| Settlement transactions | Solana devnet program and Helius Privacy Rings, test dollars (tUSD) | Real, devnet |
| Policy, fleet wallet | Nobody sold the policy; the fleet wallet is a demo wallet the server controls | Simulated |

## Earlier work: the Arc vault

CostShield was first built to settle on Arc testnet. `contracts/src/CostShieldVault.sol` (a fully collateralised USDC vault, 15 Foundry tests) and `scripts/chain.ts` remain in the repo for reference. That vault is no longer the settlement path.

## Repository map

`app/` pages (including `app/lender`) and API routes · `components/` screens · `lib/engine/` risk engine · `lib/chain/` Solana and Privacy Rings access · `solana/program/` settlement program (Rust, Pinocchio) · `deployments/` public addresses · `contracts/` earlier Arc vault and Foundry tests · `scripts/` data, ledger and chain tools · `tests/` engine tests and a recorded Gemini fixture · `docs/` product, model, submission, limitations and the Solana port decision.

Built during the UBC 2026 hackathon. MIT licence.
