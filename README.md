# Covenant

**A price cap on your biggest bill, set up from your books, that pays you back on its own.**

Other cover pays for a bad day. Covenant protects a small business from a bad year: the cost that can close it, measured from its books, backed by money locked on Solana, and private.

> This is a simulation. It is not an offer of insurance or derivatives. Nothing is for sale, and no insurer or backer has signed up. It takes no real premiums, places no orders and pays no real money. Devnet test dollars only.

| | |
| --- | --- |
| Main track | DeFi and Onchain Applications |
| Chain award | Best use of Solana |
| Bounty | Gemini Prediction Markets |
| Live demo | [trycovenant.app](https://trycovenant.app) (the hosted demo holds no keys, so private settlement is not enabled there; the devnet evidence is under [Deployed program](#deployed-program)) |
| Demo video | _add your video link_ |

## The problem

Our sample company is a 10-truck Midwest fleet (a synthetic ledger built on real diesel prices).

- It keeps about **$6,841 a year** after every bill.
- It spends **$581,354 a year on diesel**, a price it does not control.
- A bad diesel year, the kind that comes about once every 20 years, costs it **$56,018: 8.2 times its yearly profit**.

Airlines and big shippers buy protection against fuel spikes in advance. Small businesses never do: it is complex, it has minimum sizes, and nobody offers it to them.

## What Covenant does

1. **Reads your books.** Upload an accounting export. Covenant sorts every transaction, finds the cost a market controls (for the fleet, diesel) and measures what a spike would cost the business.
2. **Prices protection on that cost.** Protection pays when the official diesel price for the region goes above a line. For the sample fleet, protection bought in November 2025 starts at $4.36 a gallon and has a model price of about $361 a month.
3. **Pays you back on its own.** Money is set aside in advance on Solana. When the official monthly price is above the line, the business signs once and the program pays. No claim, no adjuster, no waiting. Replayed on real prices, the sample fleet's protection would have paid back $25,952 from November 2025 to October 2026.

## What each piece does

**Your books.** Covenant reads an accounting export (QuickBooks Online "Transaction Detail" or any CSV with Debit/Credit columns), sorts every transaction with fixed rules, reads the gallons off each fuel receipt and measures what a spike costs after the fuel surcharges customers already pay. Every number traces to a line in the books or a public dataset; no AI model guesses any number. Sign-in for QuickBooks Online, Xero, Zoho Books and FreshBooks is built and unit-tested but switched off in the demo; it only reads the books and never changes them. Code: `lib/engine/pipeline.ts` (with `ingest.ts`, `classify.ts`, `exposure.ts`), `lib/ledger/`.

**The U.S. Energy Information Administration (EIA) price.** Protection pays on the official weekly diesel price for the business's region, averaged per month, not on anyone's say-so. The price at your pump will not match it exactly, so Covenant shows how closely it has followed, from the business's own receipts. Code: `lib/data/` (EIA snapshots, each with its source and fetch time), `lib/engine/exposure.ts`.

**The Solana program.** The devnet run funds the maximum payout for **one demonstrated month** in 25-cent steps (8 steps up to $2.00 above the line), in private vaults owned by program-derived addresses. The program checks a write-once report from one trusted price-publishing key against each public trigger and lets the fleet release triggered steps; it refuses early reclaim by the backer. Unused steps return to the backer once every month in that step's term has been reported below the trigger. The program stores a fingerprint (sha256) of the EIA file but cannot verify the file itself. It also cannot inspect encrypted funding amounts; the fleet or lender verifies them with a viewing key. The 12-month replay is **not** a funded full-year policy. Code: `solana/program/src/lib.rs`, `lib/chain/server.ts`. Transactions: [Deployed program](#deployed-program).

**Backer economics are shown, not implemented as a pool.** Judge mode calculates the full 12-month maximum liability as the lesser of the aggregate cap and the sum of monthly maximum payouts. It shows the model premium, the historical replay payout and the backer's hypothetical gross result. The devnet run only funds one month, takes no premium, and has no LP deposits or share accounting. A production 12-month offer would need full-term capital or a verified external hedge before sale.

**Helius Privacy Rings.** The money in each vault and every payout are encrypted balances, and the program enforces the rules without seeing the amounts. The public can see that a step paid, not how much, so a competitor or customer cannot work out the business's gallons or margins. The business can give its lender a read-only viewing key that reads the amounts and cannot move money. Amounts are hidden from the public, not from everyone: Helius's prover sees them to build the proof, and in this demo our server holds the test keys. Code: `lib/chain/rings.ts`.

**The trade-off: 25-cent steps.** Because the program cannot read encrypted amounts, it cannot work out an exact payout, so it pays in whole steps. In September 2026 the official Midwest price averaged $6.35 against a line of $4.357: 7 of 8 steps paid, $5,070, against $5,776 by the exact formula. The last $706 did not fill a step. The payout screen shows both numbers.

**Gemini Prediction Markets.** Covenant reads Gemini's live oil-price markets (yes/no contracts on whether Brent crude will be above a price) and turns their prices into the size of move traders expect. That sets today's price of protection: a jumpier market makes protection cost more. It also tests every live Gemini market as a way to carry the risk, and today none qualifies (there is no diesel market, and the oil markets expire in days against a 12-month cover), so the app says so instead of pretending. The November 2025 price uses an assumed 35% volatility, not Gemini, and Covenant places no orders. Code: `lib/engine/gemini.ts`, `evaluateMarkets` in `lib/engine/pipeline.ts`.

**The lender link.** After a settlement, the business can send its lender a link to `/lender` that carries read-only viewing keys. The page shows each step's line, how much was set aside and whether it paid; the keys can read the amounts and cannot move money. No lender has used it yet, and in this demo our server does the decryption. Code: `app/lender`, `lib/chain/lender.ts`.

## The pipeline in detail

Terms used from here on: the *trigger* or *strike* is the line, in dollars a gallon, above which protection pays; the *underwriter* is the backer; *collateral* is the money set aside in advance; the *oracle* is the one key that posts the official price on chain; the *premium* is what protection costs.

1. **Import.** A real CSV importer reads QuickBooks Online "Transaction Detail" exports (including the report rows above the header) and generic exports with Debit/Credit columns. Unreadable rows are counted and reported.
2. **Classify.** Ordered, deterministic rules map vendor, account and memo to cost categories and risk factors. There is no LLM in the pipeline. Unmatched lines stay "unclassified".
3. **Measure.** Spend shares, monthly volatility, concentration, a shock table computed from EIA history, and a regression of the price the business paid per gallon against its regional diesel index.
4. **Pool.** A pool is cost driver x region x cover period. Six explicit criteria produce a membership status and a confidence score. Joining a pool does not mean protection is available.
5. **Evaluate hedges.** NYMEX ULSD options are modelled with Black-76. Gemini Prediction Markets are read live and scored against the business's cost. They are rejected as a hedge when they fail on index, tenor, depth or fit.
6. **Price and backtest.** 131 rolling 12-month cohorts on real prices, 2015 to 2026.
7. **Settle privately.** A program on Solana devnet holds the cover as a ladder of steps. The underwriter funds each step in advance from its private balance. An oracle key posts the EIA monthly mean with the data file's sha256. The program lets the fleet release every step whose trigger the index reached, and Privacy Rings pays the fleet in encrypted test dollars (tUSD). Amounts, payouts and balances are encrypted on chain.
8. **Share with a lender.** The fleet sends its lender a link that carries read-only viewing keys. The lender's page shows each step's trigger, funded amount and whether it paid. The key can decrypt, not spend.

The demo company is a synthetic 10-truck Midwest fleet. Its result: diesel is 26% of revenue, a 1-in-20 price year costs about 8 times annual operating profit after surcharges, and a cap bound in November 2025 would have paid $25,952 through October 2026 under the linear cap formula. On chain the cap pays in $0.25-per-gallon steps, so a settled month pays the linear amount rounded down to the step.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
npm test               # engine, ledger and backer-economics tests
npm run test:contracts # earlier work: 15 Foundry tests for the Arc vault (needs Foundry)
```

The app works without any keys: analysis, Gemini evaluation, pricing, backtest and the replay all run. Only private settlement and the lender page need the Solana setup below. Without it, the payout screen shows no settle button; for the sample fleet it links the devnet settlement the team ran on Nov 20 (the transactions under [Deployed program](#deployed-program)), and Judge mode says what the server is missing.

Ledger sign-in (QuickBooks Online, Xero, Zoho Books, FreshBooks) is off unless the server has that provider's client id and secret; `.env.example` lists the variables and redirect URLs. The sign-in code has not been verified against a live provider. CSV upload and the sample company always work.

### Private settlement on Solana devnet

These commands are for the team's machine. They need a Helius devnet API key in `.env.local` (copy `.env.example`) and the team's wallet keys in `.solana-keys/`. Do not run `solana:setup` without those keys: it creates new wallets and can overwrite `deployments/solana-devnet.json`, and the deployed program still accepts reports only from the team's oracle key. To settle with your own keys, set `ORACLE` in `solana/program/src/lib.rs` to your oracle wallet, build with `npm run solana:build` and deploy your own program.

```bash
npm run solana:setup   # idempotent: wallets, devnet SOL, tUSD mint and Rings registration, private deposits
npm run solana:e2e     # one settlement end to end; prints Explorer links
npm run solana:verify-latest # read-only lender verification of the last local policy
```

Secrets live in `.env.local` (Helius devnet API key) and `.solana-keys/` (wallet keypairs). Both are gitignored. Never commit them. Public addresses (program id, mint, role wallets) are written to `deployments/solana-devnet.json`, which is committed and read by the app.

<!-- DEPLOYMENT:START -->
### Deployed program

All addresses are also in [`deployments/solana-devnet.json`](deployments/solana-devnet.json). Solana devnet only.

- Covenant program: [`DnKV9uZ32G2NdrmKuDKL1mLKRAed9MKvw5jHtUu3R114`](https://explorer.solana.com/address/DnKV9uZ32G2NdrmKuDKL1mLKRAed9MKvw5jHtUu3R114?cluster=devnet)
- Helius Privacy Rings program: `ring1GaLCuJnkUMVkX2JeZLTTX17wKsV4fZmPVzXANW`
- tUSD test mint (6 decimals, Rings asset 427): `FQKedE1cBThwLvc1FJ1xr5b3DPYGVwRNVKrQVSHmCfv8`
- Oracle `2RECf7GfWRSw8U73tyWJ1ZhTJ5U21FRHPjEaXxTa7EsH` · underwriter `D4VUvtQh3ad8j1FF48ZNNAc9fN1oZC8F241pcuQMEUua` · fleet `2gfZPF6tSUkUbEApUNzZNFxh1fqcMhMoCybKR1VSVY8N`

Evidence on devnet, Nov 20, 2026 (times Central). Amounts and payouts are encrypted: Explorer shows the signers, the accounts and that a Privacy Rings transfer happened, not how much was paid.

| When | What | Transaction |
| --- | --- | --- |
| 3:05 AM | Program deployed | [`535eqFpm…`](https://explorer.solana.com/tx/535eqFpmsfF5iJV9gTHm9MJJwPThenfqjv5pQzRvHzq1p5pV1awntFM53EeC1KfrrD1y7uKfEig8FQs3iyZzzqi1?cluster=devnet) |
| 3:12 AM | Open 8 steps for September 2026, triggers from $4.607 a gallon, signed by fleet and underwriter | [`5EcVnVPw…`](https://explorer.solana.com/tx/5EcVnVPwuLLKudQEhm5p4nErLGkFS29vx7Jo6thwrHDR1nJuWGPDS5xKrPHzF5EaQHLjgDg8hxK2ZDBenrF5Y7jL?cluster=devnet) |
| 3:12 AM | Oracle report: Midwest diesel, September 2026 mean $6.350 a gallon, with the sha256 of `lib/data/diesel_padd2_weekly.json` | [`3FYhzywt…`](https://explorer.solana.com/tx/3FYhzywtKP1hmRxN1Y1BmsBaaoW3YWiKugKndctb5A8NcbVKVcT7M1jAPKwoFvgHqkczNYVmhsCPSues4wca8a2Z?cluster=devnet) |
| 3:12 AM | First payout: the fleet releases a triggered step and Privacy Rings pays it privately | [`2wTYb5Mj…`](https://explorer.solana.com/tx/2wTYb5MjiCKCWLNA6FVrnufXAWsfmhyCBhAimbWnjFXFCQnXrEsm61zHstiz5z6ZvgiXycqujN2HRQKngPC7pC9S?cluster=devnet) |
| 3:12 AM | Unused step reclaimed by the underwriter | [`3zZyVtP2…`](https://explorer.solana.com/tx/3zZyVtP2HHdRU5am7YRaddypcjYYebUfpF3KgHy26tUWT3V71iPPTi9rbar4L8gNwuABrnMaxiNyJEL3LKftHP7j?cluster=devnet) |
| 3:16 AM | Refused: report from a non-oracle wallet, error 6002 (`ERR_BAD_ORACLE`, shown as `0x1772`) | [`2GRvp8F1…`](https://explorer.solana.com/tx/2GRvp8F1S2AVJoZhw7XLoKwsgJsh9ZqZgdZx8n1eT5symcAqEgriXvrZEovqNKXrVvbKzLdRcMsUY8ju99pD7qn7?cluster=devnet) |
| 3:16 AM | Refused: duplicate report for the same month, error 6011 (`ERR_ALREADY_REPORTED`, shown as `0x177b`) | [`LxKHWJZW…`](https://explorer.solana.com/tx/LxKHWJZW1JbRhmbYUPC9LmK9pjy7XMQ9sTwrDo87obrgmDQgbR9nSeNXUzamvxtpTi9HEkfQbfd76fa9sbiSEqZ?cluster=devnet) |

The $6.350 on chain is the mean of the four September 2026 weeks in the committed EIA snapshot ($6.3505). A judge cannot re-run settlement against this program: it accepts reports only from the oracle key above, which the team holds.

**Fresh devnet verification, 11:29 AM CT November 20.** The team ran the full one-month path again with its local demo keys: [open eight steps](https://explorer.solana.com/tx/37iJ44Axmm4xsHcAgraGjLGa36WsXrnMWfp6USbUAm7VSu2eebGoZHhdte2fsAtymuMHQPoKNsrpAijFRdGWuGtB?cluster=devnet), [fund their private vaults](https://explorer.solana.com/tx/24maW13oEKH5sJ6FYJXs481bKYFKEmXBmUM4GpkUHEYmvKMbTZtW14rkDoTyewr8DNKT2KGqyLGZ5QdXZMhnJ7Mk?cluster=devnet), [release the first triggered step](https://explorer.solana.com/tx/5trnbs4cPhqVmYVT3wLxih9sArEGvgThR1fTgmkmjQmQ3VzEr2wSvw6Azd4c1bbomjWHArvmN3fYBvgZdfpHeMGq?cluster=devnet), and [reclaim the untriggered eighth step](https://explorer.solana.com/tx/4NMCxUk81vNG1d15dcGzyUJGjyRa9jhpiyqBhqGmxmeYU6vX41XXG6YkR1ifvzYaCspLVgwDsnyWy9WgAKoNoqTj?cluster=devnet). Seven steps paid 5,070.22 tUSD as decrypted by the fleet, against 5,776.43 by the exact linear formula. The first lender verification attempt failed on a network fetch after all transfers completed; the read-only recheck then decrypted 5,794.53 tUSD funded and 5,070.22 tUSD paid, matching 7 of 8 public paid flags. `npm run solana:checks` also passed 18/18 on-chain enforcement and privacy checks. These checks do not prove full-year funding or independent oracle correctness.
<!-- DEPLOYMENT:END -->

## Architecture

```
Browser (Next.js, React, Tailwind)
  /      landing page (figures computed at build time by the real engine on the sample fleet)
  /app   books (connect) -> analysis -> risks -> protection -> what if -> payouts   + judge mode
  /lender#<share>   read-only lender view (key in the URL fragment)
        |  POST /api/analyze (NDJSON stream of real pipeline stages)
        |  GET  /api/chain   (program, mint, roles, decrypted demo balances)
        |  POST /api/settle  (NDJSON stream of settlement steps on Solana devnet)
        |  POST /api/lender  (decrypts step balances with the shared viewing keys)
        |  GET  /api/connect/status, /api/connect/<provider>, /api/connect/<provider>/callback
        |       (ledger sign-in; off unless the server has that provider's keys)
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
  lib/ledger/   ledger sign-in for QuickBooks Online, Xero, Zoho Books and FreshBooks: signed state,
                token exchange, a 24-month pull, converted to the CSV the importer reads
                (unit-tested against mocked responses, not verified against a live provider)
  lib/data/     EIA snapshots (scripts/fetch_eia.py), each with source URL and fetch time
  lib/chain/    Solana devnet access, Privacy Rings transfers, settlement flow
                (types.ts is the shared contract with the UI)
        |                                  |
        v                                  v
Gemini public REST API            Solana devnet
(events, order books)               Covenant program (solana/program, Pinocchio)
                                      step accounts, oracle reports, release, reclaim
                                    Helius Privacy Rings
                                      encrypted tUSD balances, step vaults owned by the program
```

No database. An uploaded file is processed in memory for the request and is not stored.

## How Covenant uses Solana

The settlement program is a Pinocchio program on Solana devnet, adapted from Equity Floor, our first idea for this hackathon, written during the event and set aside on Nov 20 (`solana/program`). It keeps public terms and private money apart:

- **Step accounts (public).** Each policy month is a ladder of steps. A step account stores the terms only: the fleet, the underwriter, the index id (EIA regional diesel), the period (YYYYMM), and the trigger price in 1/1000 $ per gallon. Both parties sign when the steps are created. No amount is stored.
- **Step vaults (private).** Each step's money sits in a Privacy Rings private balance owned by a program-derived address `["vault", step]`. Only the program can sign for it. The underwriter funds all steps in advance in one private transfer.
- **Oracle reports (public, write-once).** One oracle key posts the EIA monthly mean for a period together with the sha256 of the data file it used. A second report for the same index and period is refused.
- **Release.** The fleet signs `release` for a step. The program checks that the report is a genuine report account posted by the oracle key (it does not read the EIA file; it stores the file's sha256), matches the step's index and period, and is at or above the trigger, then signs for the vault and calls Privacy Rings, which pays the fleet privately. The step is marked paid.
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

- The key travels in the URL fragment, which browsers do not send with page requests. In this demo, though, the `/lender` page posts the share to the Covenant server, which does the decryption. A production version would decrypt in the lender's browser.
- The demo server holds every party's keys and all step viewing keys. It decrypts the fleet's and underwriter's balances for display.
- Helius's prover sees plaintext amounts inside attested hardware (a TEE).
- Trigger prices and the number of steps are public. Anyone who knows the step size and the fleet's covered gallons could infer amounts. The gallons are not published.
- Depositing tUSD into a private balance (the public onramp) reveals the deposit amount.

## How Covenant uses Gemini Prediction Markets

Endpoints (public, no key): `GET /v1/prediction-markets/events?status=active&category=…` and `GET /v1/book/{instrumentSymbol}`. Used at analysis time, live:

- **Discovery.** Every active Commodities and Economics event is mapped to a cost driver (diesel, natural gas, interest rates) or to nothing, with the reason shown.
- **Hedge suitability.** Each related market is scored on index match, 12-month fit to the business's cost, tenor against a 12-month cover period, displayed depth against one pool-month, and quote presence. There is no diesel market on Gemini today. The Brent ladders are the closest, and they fail: Brent explains 77% of 12-month retail diesel moves against 96% for ULSD, the ladders expire in days, and depth covers about one fleet. They are reported as "signal only".
- **Implied volatility.** A ladder of "Brent above K" binaries is a survival curve. The engine fits a lognormal to the two-sided quotes and annualises the slope. That implied volatility is the volatility input to today's cap price, replacing an options data feed the project cannot license. If Gemini cannot be reached or lists no usable ladder, today's price uses an assumed 40%. The November 2025 price in the replay always uses an assumed 35%, not Gemini.
- **Ladder replication.** The engine sizes the binary ladder that would replicate one fleet-month of cap, walks each ask book, and reports cost and unfilled size.

Covenant places no orders and Gemini markets do not settle the program.

## Economic design and risk assumptions

- **Product.** A purchase-linked diesel cap. The index is the EIA regional weekly retail diesel price, averaged over the month. The strike `K` is the index at inception plus $0.50. Covered gallons are the business's own purchases times the share not already billed under a fuel surcharge, capped per month. The model and replay use the linear cap: `max(0, index mean - K) x covered gallons`.
- **Steps on chain.** The program cannot read encrypted amounts, so it cannot compute a linear payout. The cap is split into steps of `D` = $0.25 per gallon. Step `i` (1-based) triggers when the monthly mean is at or above `K + i x D` and pays `D x covered gallons`. Steps run up to `K + $2.00`, so 8 steps. The stepped payout is the linear cap rounded down to the step: `D x min(8, floor((index mean - K) / D)) x covered gallons`. The payout screen shows both numbers.
- **Collateral.** The underwriter funds every step's private vault in advance, so a triggered step is already paid for. Funding amounts are encrypted, so the program cannot check them. The fleet (or its lender) checks them by decrypting. Untriggered steps go back to the underwriter after the term. A real programme would hedge the pool with ULSD options and hold capital only against the retail-to-wholesale basis.
- **Correlation.** Every policy on one index pays at the same time. A diesel pool is one large short option, not a diversified book. Pooling here is for hedge sizing (one ULSD contract is 42,000 gallons, about 15 fleets of this size per contract-month), not for diversification.
- **Basis risk.** The index is not the business's pump price. The engine measures the gap from ledger gallons and shows it. An index cover cannot remove it. Steps add a little more: a month just below the next trigger pays up to $0.25 a gallon less than the linear cap.
- **Pricing.** Black-76 on EIA spot with a flat forward curve, one volatility, mid-month expiries and a 30% load. No skew, no bid/offer. Real cost would be higher. Pricing uses the linear cap, which slightly overstates the stepped cover's value.
- **Oracle.** One trusted key. The server recomputes the monthly mean from its own EIA data, ignores prices sent by the browser, and posts the mean on chain with the data file's sha256. This is a trusted oracle, disclosed as such.
- **Premium and who pays whom.** No premium is collected, on chain or off. The program has no premium instruction, the fleet pays nothing, and the underwriter funds the steps with its own test dollars. The premium on screen is a model price. Its 30% load is the only allowance for a carrier's costs and margin, and no fee for Covenant is modelled. In a real programme the fleet would pay the premium to a licensed carrier, and none has agreed to that.
- **Maximum loss.** The underwriter's loss on a policy month is capped at the 8 funded steps: $2.00 per gallon times covered gallons. A month above `K + $2.00` pays no more. The on-chain demo policy funds one month's steps.
- **Upgrade authority.** The program is upgradeable. One team wallet, the one that deployed it (`84ZgVXHPfpYML8E3o63aLqMo69Z4A6o4cxUY4r7xuWRE`), can replace its code. A production program would give that up or put it behind a multisig.
- **Unfinished runs.** Nothing on chain expires. If a settlement run stops midway, the remaining steps stay open and funded. One devnet policy (`2c7cb8f46c1f57c2`) was in that state when read at 4:25 AM Central on Nov 20: 3 steps paid, 5 open. Releasing or reclaiming them needs each step's vault key, which the server that ran the settlement keeps on its own disk. There is no recovery tool.
- **Money.** tUSD devnet test dollars at 1 tUSD = $1. No real funds.

More in [docs/MODEL.md](docs/MODEL.md) and [docs/LIMITATIONS.md](docs/LIMITATIONS.md).

## Data provenance

| Data | Source | Status |
| --- | --- | --- |
| Diesel, ULSD and Brent price history | U.S. EIA public series, fetched by `scripts/fetch_eia.py` into `lib/data/` | Real |
| Prediction market quotes and books | Gemini public API, read live | Real |
| Sample ledger | `scripts/generate-ledger.ts`, fixed seed, fuel prices built on the EIA Midwest index | Synthetic |
| Shock sizes, fit statistics, backtest | Calculated by the engine from the data above | Calculated |
| Volatility | Today's price: implied from the Gemini Brent ladder, or 40% if Gemini is unreachable. November 2025 price: 35% | Signal or assumption |
| Premium | Model price | Assumption |
| Oracle report on chain | Monthly mean recomputed by the server from the EIA snapshot, posted with the file's sha256 by one oracle key | Real data, trusted reporter |
| Settlement transactions | Solana devnet program and Helius Privacy Rings, test dollars (tUSD) | Real, devnet |
| Policy, fleet wallet | Nobody sold the policy; the fleet wallet is a demo wallet the server controls | Simulated |

## Earlier work: the Arc vault

Covenant was first built to settle on Arc testnet. That work is archived, not the settlement path, and the vault was not deployed: `deployments/arc-testnet.json` holds no addresses. What remains in the repo for reference:

- `contracts/src/CostShieldVault.sol`, a fully collateralised USDC vault with 15 Foundry tests (`npm run test:contracts`).
- `lib/chain/arc/`, `scripts/chain.ts` and `scripts/export-abi.cjs`, with the `chain` and `abi` npm scripts. `viem` is a dependency only for these.

Do not run `npm run chain`: its `deploy` and `demo` commands overwrite the "Deployed program" section above with Arc details.

## Repository map

`app/` pages (landing at `app/page.tsx`, the app at `app/app`, `app/lender`) and API routes · `components/` screens (the earlier single-page UI is kept on the `classic-ui` branch) · `design/` mockups for a phone layout and a provider workspace: reference material, not shipped code · `lib/engine/` risk engine · `lib/ledger/` ledger sign-in for four accounting providers · `lib/chain/` Solana and Privacy Rings access (`lib/chain/arc/` is the archived Arc version) · `solana/program/` settlement program (Rust, Pinocchio) · `deployments/` public addresses · `contracts/` archived Arc vault and Foundry tests · `scripts/` data, ledger and chain tools · `tests/` engine and ledger tests and a recorded Gemini fixture · `docs/` product, model, submission, limitations and the Solana port decision.

Built during the UBC 2026 hackathon. MIT licence.
