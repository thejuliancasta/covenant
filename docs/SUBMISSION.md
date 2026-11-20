# Submission materials

## Devpost fields

**Project name:** Covenant

**Short description:** A price cap on your biggest bill, set up from your books, that pays you back on its own.

**Main track:** DeFi and Onchain Applications. **Chain award:** Best use of Solana. **Bounty:** Gemini Prediction Markets.

**Hook (first line of the description):**
"When fuel spikes, airlines are fine and small trucking companies go under. The difference is that big companies buy protection in advance. Covenant gives every small business that protection, straight from its books, and it pays out by itself."

Covenant is a simulation in devnet test dollars. Nothing is for sale, and no insurer or backer has signed up.

**What problem does it solve?**
Our sample company is a 10-truck Midwest fleet (a synthetic ledger built on real diesel prices). It keeps about $6,841 a year after every bill. It spends $581,354 a year on diesel, a price it does not control. A bad diesel year, the kind that comes about once every 20 years, costs it $56,018: 8.2 times its yearly profit.

Airlines and big shippers buy protection against fuel spikes in advance. Small businesses never do: it is complex, it has minimum sizes, and nobody offers it to them. And protection on a public blockchain would expose the business: its gallons show its volume, and a payout shows when its margins are under stress.

**What did you build?**
Covenant does three things:

1. **Reads the books.** The business uploads an accounting export. Covenant sorts every transaction with fixed rules, reads the gallons off each fuel receipt and measures what a spike would cost after the fuel surcharges customers already pay. No AI model guesses any number; each one traces to a line in the books or a public dataset. Sign-in for QuickBooks Online, Xero, Zoho Books and FreshBooks is built and unit-tested but switched off in the demo.
2. **Prices protection on the cost that could sink it.** Protection pays when the official diesel price from the U.S. Energy Information Administration, averaged over the month for the business's region, goes above a line. For the sample fleet, protection bought in November 2025 starts at $4.36 a gallon and has a model price of about $361 a month.
3. **Pays the business back on its own.** The backer sets the money aside in advance on Solana. When the official price is above the line, the business signs once and the program pays: no claim, no adjuster, no waiting. Replayed on real prices, the sample fleet's protection would have paid back $25,952 from November 2025 to October 2026.

It also says no. Payroll, insurance and leases cannot be protected this way, and the app says so. Every Gemini market it tests is shown as rejected or "signal only", with the reason.

**What makes it different?**
Most cover for small businesses pays for a bad day: a rained-out Saturday, a cold morning. Covenant protects against a bad year: the one cost that can close the business.

- **Measured, not guessed.** The loss comes from the business's own books (3,315 transactions for the sample fleet, the gallons on every receipt, less what fuel surcharges already pass on), not from a sentence the owner types. No AI model estimates any number.
- **Business-sized.** A prediction-market contract can only cover as much as its order book holds, often a few hundred dollars, and it ends within days. Covenant covers a $56,018 bad year for a full 12-month term, because the risk sits with a backer whose money is locked on Solana before cover starts, not with whoever is selling on an order book that day.
- **Private.** On a public chain, a business's payouts reveal its volume and when its margins are under stress. With Helius Privacy Rings the amounts are encrypted, the public sees only that the rules were followed, and the business can prove its cover to a lender with a read-only viewing key.
- **Tested on history.** Replayed on every 12-month period since 2015 and on real prices from November 2025 to October 2026, with the 25-cent-step trade-off shown next to the exact figure ($5,070 paid in 7 of 8 steps against $5,776 for September 2026).
- **Prediction markets for what they do best.** Covenant reads Gemini's live oil markets to price the protection, and is honest that they can't carry the risk yet.

**How does it work?**
A TypeScript engine on the server does the analysis: it imports the CSV, sorts transactions with fixed rules, fits the price the business paid per gallon against the official regional price, sizes a 1-in-5 and a 1-in-20 year from EIA history, prices the protection with a standard options model (Black-76), and replays it over 131 rolling 12-month periods from 2015.

*How we use Solana.* A Pinocchio program on Solana devnet (`DnKV9uZ32G2NdrmKuDKL1mLKRAed9MKvw5jHtUu3R114`) makes the payout certain and automatic. Before cover starts, the backer locks the full amount the protection could pay, in 25-cent steps (25 cents a gallon each, 8 steps up to $2.00 above the line), in vaults that only the program can open. Each step's public terms (region, month, line) sit in their own account. Each month one price-reporting key posts the official price once, with the sha256 fingerprint of the government data file; a second report for the same month is refused. If the price is at or above a step's line, the business signs once and the program releases that step. The backer cannot block it or take it back. Unused money goes back to the backer only after every month of the term has been posted below the line, and each step pays once, only to its business. We funded and settled September 2026 on devnet on Nov 20 (the devnet run funds one month): the [price report](https://explorer.solana.com/tx/3FYhzywtKP1hmRxN1Y1BmsBaaoW3YWiKugKndctb5A8NcbVKVcT7M1jAPKwoFvgHqkczNYVmhsCPSues4wca8a2Z?cluster=devnet) ($6.350 a gallon with the file's sha256), the [first payout](https://explorer.solana.com/tx/2wTYb5MjiCKCWLNA6FVrnufXAWsfmhyCBhAimbWnjFXFCQnXrEsm61zHstiz5z6ZvgiXycqujN2HRQKngPC7pC9S?cluster=devnet), a [report from a stranger refused](https://explorer.solana.com/tx/2GRvp8F1S2AVJoZhw7XLoKwsgJsh9ZqZgdZx8n1eT5symcAqEgriXvrZEovqNKXrVvbKzLdRcMsUY8ju99pD7qn7?cluster=devnet) and a [duplicate report refused](https://explorer.solana.com/tx/LxKHWJZW1JbRhmbYUPC9LmK9pjy7XMQ9sTwrDo87obrgmDQgbR9nSeNXUzamvxtpTi9HEkfQbfd76fa9sbiSEqZ?cluster=devnet). Limits, stated plainly: the program stores the file's fingerprint and does not read the file itself, the price comes from one trusted key, and nothing is on mainnet.

*How we use Helius Privacy Rings.* The money in each step's vault and every payout are encrypted balances, owned by a program-derived address and spent by the program through Privacy Rings. The program enforces the rules without seeing the amounts. The public can see that a step paid, not how much, so a competitor or customer cannot work out the business's gallons or margins. The business can give its lender a read-only viewing key: the lender's page (`/lender`) shows each step's line, how much was set aside and whether it paid, and the key cannot move money. The honest trade-off: because the program cannot read encrypted amounts, it pays in whole 25-cent steps. In September 2026 the official Midwest price averaged $6.35 against a line of $4.357, so 7 of 8 steps paid, $5,070, against $5,776 by the exact formula; the last $706 did not fill a step, and the app shows both numbers. Amounts are hidden from the public, not from everyone: Helius's prover sees them to build the proof (inside attested hardware), and in this demo our server holds the test keys and does the lender's decryption.

*How we use Gemini Prediction Markets.* At every analysis Covenant calls Gemini's public Prediction Markets API live (`/v1/prediction-markets/events` and `/v1/book/{symbol}`). It reads the oil-price ladder (yes/no contracts on whether Brent crude will be above each price), treats the prices as the odds of each level, and turns that curve into the size of move traders expect. That expected move sets today's price of protection: a jumpier market makes protection cost more. It also screens every live Commodities and Economics market as a way to carry the risk. Markets with no link to a cost in the books are rejected with that reason; the related ones get five checks: does it settle on the price the business pays, does it track that cost over 12 months, does it last at least half the 12-month cover, are enough contracts on offer to cover a month for a group of fleets, and is it quoted both ways. Today none passes: Gemini lists no diesel market, Brent explains 77% of 12-month diesel moves against 96% for wholesale diesel, the oil markets expire in days, and the displayed size covers about one fleet. So the app labels the Brent ladder "signal only", not a hedge, and shows what building the cap from it would cost and how much could not be filled. Covenant places no orders on Gemini, and the November 2025 price uses an assumed 35% volatility, not Gemini.

**What makes it unique?**
It starts from the books, not from a list of markets: the owner learns what is worth protecting, what is not, and why. It can say no: it rejects hedges that do not track the cost and labels every number as verified, calculated, estimated or assumed. It uses prediction markets for what they are good at (reading what traders expect) instead of pretending they are a hedge. The rule for paying is public and enforced by the program, while the amounts stay private. And one link gives a lender or factoring company read-only proof that the business is protected and was paid.

**What would you build next?**
Fuel-card integration so gallons are measured, verifying the four ledger sign-ins (QuickBooks, Xero, Zoho Books, FreshBooks) against live accounts, a multi-publisher oracle, decryption in the lender's browser instead of on our server, wallets where each party holds its own keys, natural gas as a second priced risk, and a conversation with a surplus-lines carrier about who would owe the payout.

**Technologies:** Next.js, React, TypeScript, Tailwind CSS, Solana devnet, Rust and Pinocchio, @solana/kit, Helius Privacy Rings (@heliuslabs/spr), tUSD devnet test dollars, Gemini Prediction Markets API, U.S. EIA open data, Vitest. Earlier work in the repo, archived: a Solidity vault with Foundry tests, written for Arc testnet and not deployed.

## Demo video script (2 to 3 minutes)

| Time | Screen | Say |
| --- | --- | --- |
| 0:00 | Landing page (`/`) | "A bad diesel year costs a small trucking fleet many times its profit. Big carriers hedge. Small ones can't. Covenant starts from their books." |
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

- Repository: https://github.com/thejuliancasta/covenant
- Program (Solana devnet): `DnKV9uZ32G2NdrmKuDKL1mLKRAed9MKvw5jHtUu3R114`, https://explorer.solana.com/address/DnKV9uZ32G2NdrmKuDKL1mLKRAed9MKvw5jHtUu3R114?cluster=devnet
- Live demo: https://trycovenant.app (no keys on the host, so private settlement is not enabled there)
- Video: _add your video link_

## Finalist presentation (5 minutes)

1. **Problem (40s).** One number: a 1-in-20 diesel year is about 8 times this fleet's annual profit. 2026 was worse than that.
2. **Insight (40s).** Most small-business costs cannot be hedged and we say so. Diesel can, because the cost is a quoted price with a liquid hedge. A product that can say no is more credible than one that sells everything.
3. **Live demo (2m 30s).** Sample company, risks, protection, the Gemini rejection and implied volatility, then the private Solana payout with the two refused attempts, the two views, and the lender link. The payout needs the Solana keys on the presenting machine; without them, show the replay and the Explorer transactions from the README.
4. **Why Solana and Privacy Rings (30s).** The trigger should be public and enforced by a program. The money should not be public: gallons reveal volume and a payout reveals stress. Program-owned private balances on Solana give both, and a viewing key lets the fleet prove cover to its lender without publishing it.
5. **What is not real (30s).** No carrier, modelled options, trusted oracle, synthetic ledger, devnet test dollars, and a demo server that holds every key. Say it before a judge asks.
6. **Next (20s).** Fuel-card data, a carrier conversation, a second risk.

Likely questions: who owes the payout (a licensed insurer, none yet); why not hedge on prediction markets (tenor, depth, fit, shown live); why fund every step in advance (removes counterparty risk in a demo; a real pool hedges with options); is this insurance or a swap (unsettled; purchase-linked payouts are the form insurance law favours); why private (covered gallons reveal a fleet's volume and a payout reveals margin stress, which shippers, brokers and competitors would use); how does a lender verify (it opens the shared link; read-only viewing keys decrypt each step's vault, showing funded and paid amounts; the keys cannot spend, and in this demo our server does the decryption); why steps instead of the linear formula (the program cannot read encrypted amounts, so each step is a fixed amount released on a public condition; the payout is the linear cap rounded down to $0.25 a gallon).
