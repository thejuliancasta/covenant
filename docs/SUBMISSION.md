# Submission materials

## Devpost fields

**Project name:** CostShield

**Short description:** Upload your books, find the costs a market controls, and see a private payout settle on Solana when prices spike, provable to your lender. Cost protection for small businesses, starting from the ledger.

**Main track:** DeFi and Onchain Applications. **Chain award:** Best use of Solana. **Bounty:** Gemini Prediction Markets.

**What did you build?**
A working pipeline from accounting data to a private onchain payout. A small business uploads a QuickBooks export. Sign-in for QuickBooks, Xero, Zoho Books and FreshBooks is written but not verified against a live account and not switched on in the demo; Judge mode shows its exact status. CostShield classifies every expense with deterministic rules, measures how much of the spending follows a market price, assigns the business to a risk pool, and tests live whether any real instrument hedges the risk. For a 10-truck fleet it prices and backtests a diesel price cap on 11 years of EIA data, then settles a replayed September 2026 price shock on Solana devnet. The cover is a ladder of steps funded in advance by the underwriter. With Helius Privacy Rings, step amounts, the payout and balances are encrypted on chain. The fleet can share a read-only link with its lender, who sees the cover and the payout but cannot spend.

**What problem does it solve?**
A bad diesel year costs a small fleet several times its annual profit. Large carriers hedge fuel. Small ones cannot size the exposure, find an instrument that tracks their cost, or meet contract minimums. Existing tools start from a list of prediction markets and ask the owner to pick. CostShield starts from the ledger and tells the owner what is worth protecting, what is not, and why. And a fleet's cover and payouts are sensitive: gallons reveal volume, a payout reveals margin stress. A public chain would show both to shippers, brokers and competitors.

**How does it work?**
A TypeScript risk engine runs server-side: CSV import, rule-based classification, an OLS fit of the price paid per gallon against the EIA regional diesel index, a shock table, a six-criterion pool classifier, Black-76 pricing of a 12-month call strip, and a 131-cohort backtest. It reads Gemini Prediction Markets live, maps each market to a cost driver, and scores it as a hedge. Gemini lists no diesel market, so the Brent ladders are rejected as a hedge on tenor, depth and fit, and used for what they are good at: the engine fits a lognormal to the ladder and uses the implied volatility to price the cap.

Settlement runs on Solana devnet. A Pinocchio program stores each step's public terms (index, month, trigger price). Each step's money is a Privacy Rings private balance owned by a program-derived vault, funded in advance by the underwriter. An oracle key posts the EIA monthly mean with the sha256 of its data file; reports are write-once. The program cannot read encrypted amounts, so the cap pays in $0.25-per-gallon steps: each step whose trigger the index reached can be released by the fleet, and the program signs for the vault so Privacy Rings pays the fleet privately. The program refuses reports from anyone but the oracle, releases of untriggered steps, releases by anyone but the fleet, and double releases. The fleet decrypts its balance with its own key; a lender decrypts the step vaults with read-only viewing keys.

**What makes it unique?**
It can say no. The engine rejects hedges that do not track the customer's cost, labels every number as verified, calculated, estimated or assumed, and shows which licensed entity would have to owe a payout and that none has agreed to. It turns a prediction-market ladder into an implied volatility input, a use of event contracts that does not depend on their thin depth. Cover is private by default: the trigger condition is public and enforced by the program, while amounts, payouts and balances are encrypted. And it is provable to your lender: one link gives a lender or factoring company read-only proof that the fleet is protected and was paid.

**What would you build next?**
Fuel-card integration so gallons are measured, verifying the four ledger sign-ins (QuickBooks, Xero, Zoho Books, FreshBooks) against live accounts, a multi-publisher oracle, decryption in the lender's browser instead of on our server, wallets where each party holds its own keys, natural gas as a second priced risk, and a conversation with a surplus-lines carrier about who would owe the payout.

**Technologies:** Next.js, React, TypeScript, Tailwind CSS, Solana devnet, Rust and Pinocchio, @solana/kit, Helius Privacy Rings (@heliuslabs/spr), tUSD devnet test dollars, Gemini Prediction Markets API, U.S. EIA open data, Vitest. Earlier work in the repo, archived: a Solidity vault with Foundry tests, written for Arc testnet and not deployed.

## Demo video script (2 to 3 minutes)

| Time | Screen | Say |
| --- | --- | --- |
| 0:00 | Landing page (`/`) | "A bad diesel year costs a small trucking fleet many times its profit. Big carriers hedge. Small ones can't. CostShield starts from their books." |
| 0:15 | Books (`/app`) | "You upload a QuickBooks export. Sign-in for four ledgers is written but not switched on in this demo, so I'll use a sample 10-truck fleet: a synthetic ledger built on real diesel prices. It goes through the same importer." |
| 0:25 | Analysis | "These are real pipeline stages with measured run times. Stage six is a live call to Gemini Prediction Markets." |
| 0:40 | Your risks | "3,315 transactions, one risk worth protecting. Fuel is 26% of revenue. A 1-in-20 year costs eight times annual profit after surcharges. Payroll, insurance and leases are 73% of spend and we say plainly that nothing hedges them." |
| 1:05 | Protection | "The candidate is a diesel cap that pays on gallons actually bought. In November 2025 it modelled at about $4,300. Today it is almost five times that. Since 2015 it paid in about a third of the 12-month periods." |
| 1:25 | Hedge test | "Can it be hedged? ULSD options: yes. Gemini: there is no diesel market, and the Brent ladder fails on tenor, depth and fit, so we reject it as a hedge. We use it for what it is good at: the ladder is a probability curve, and we extract an implied volatility, about 48% today, to price the cap." |
| 1:50 | What if | "Diesel up 60 cents. Every number is arithmetic on these inputs." |
| 2:05 | Payouts, then Solana Explorer | "September 2026 was the record month. The cap pays in 25-cent steps because the program can't read encrypted amounts; here is the stepped payout next to the linear one. This machine does not hold the team's keys, so it does not send a new payment. We settled this month on Solana devnet earlier today, and the screen links those transactions on Solana Explorer: the oracle's report of the EIA average with the data file's hash, the fleet's release of a triggered step, a report from a stranger refused, a duplicate report refused. Explorer shows who signed and that a private transfer happened, not how much was paid. A fleet can share a link that lets its lender see the amounts without being able to spend." |
| 2:40 | Judge mode (button in the sidebar) | "Judge mode shows every source, formula, rejected market, the program's safeguards and its trust assumptions: one oracle key, our server holds the demo keys, and Helius's prover sees amounts inside attested hardware. This is devnet with test dollars, and the README says exactly what is real." |

Recording notes:

- The cap price, the "times" figure and the implied volatility move with the live Gemini market. Read them off the screen. At 4:22 AM Central on Nov 20 they were $21,383, 4.9 times and 48%.
- The Payout row above is the version for a machine without the Solana keys. The Explorer links are in the README under "Deployed program". Do not narrate the fleet-and-chain panel or open the lender page: neither appears without a settlement.
- If the keys are available, record the live version instead: "Now settle September 2026, the record month, privately on Solana devnet. The oracle posts the EIA average with the data file's hash. The cap pays in 25-cent steps because the program can't read encrypted amounts; here is the stepped payout next to the linear one. A stranger's attempt is refused. A duplicate is refused. On the left, what the fleet sees after decrypting. On the right, what the public chain shows: the terms and the transactions, but no amounts. One link shares a read-only view with the fleet's lender."

## Links for the Devpost form

- Repository: https://github.com/thejuliancasta/orange-cat
- Program (Solana devnet): `DnKV9uZ32G2NdrmKuDKL1mLKRAed9MKvw5jHtUu3R114`, https://explorer.solana.com/address/DnKV9uZ32G2NdrmKuDKL1mLKRAed9MKvw5jHtUu3R114?cluster=devnet
- Live demo: _add your deployment URL_ (no keys on the host, so private settlement is not enabled there)
- Video: _add your video link_

## Finalist presentation (5 minutes)

1. **Problem (40s).** One number: a 1-in-20 diesel year is about 8 times this fleet's annual profit. 2026 was worse than that.
2. **Insight (40s).** Most small-business costs cannot be hedged and we say so. Diesel can, because the cost is a quoted price with a liquid hedge. A product that can say no is more credible than one that sells everything.
3. **Live demo (2m 30s).** Sample company, risks, protection, the Gemini rejection and implied volatility, then the private Solana payout with the two refused attempts, the two views, and the lender link. The payout needs the Solana keys on the presenting machine; without them, show the replay and the Explorer transactions from the README.
4. **Why Solana and Privacy Rings (30s).** The trigger should be public and enforced by a program. The money should not be public: gallons reveal volume and a payout reveals stress. Program-owned private balances on Solana give both, and a viewing key lets the fleet prove cover to its lender without publishing it.
5. **What is not real (30s).** No carrier, modelled options, trusted oracle, synthetic ledger, devnet test dollars, and a demo server that holds every key. Say it before a judge asks.
6. **Next (20s).** Fuel-card data, a carrier conversation, a second risk.

Likely questions: who owes the payout (a licensed insurer, none yet); why not hedge on prediction markets (tenor, depth, fit, shown live); why fund every step in advance (removes counterparty risk in a demo; a real pool hedges with options); is this insurance or a swap (unsettled; purchase-linked payouts are the form insurance law favours); why private (covered gallons reveal a fleet's volume and a payout reveals margin stress, which shippers, brokers and competitors would use); how does a lender verify (it opens the shared link; read-only viewing keys decrypt each step's vault, showing funded and paid amounts; the keys cannot spend, and in this demo our server does the decryption); why steps instead of the linear formula (the program cannot read encrypted amounts, so each step is a fixed amount released on a public condition; the payout is the linear cap rounded down to $0.25 a gallon).
