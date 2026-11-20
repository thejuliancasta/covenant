# Messaging: what CostShield is, and what each piece of the stack does

The source of truth for product copy on the landing page, in the app, in the README and on Devpost. Every claim here was checked against the code on Nov 20, 2026. If the code changes, change this file in the same commit.

## The idea in three lines

- **The problem:** a 10-truck fleet keeps about $6,841 a year after every bill. It spends $581,354 a year on diesel, a price it does not control. A bad diesel year (the kind that comes about once every 20 years) costs it $56,018, more than eight years of profit.
- **Why it happens:** airlines and big shippers buy protection against fuel spikes in advance. Small businesses never do: it is complex, it has minimum sizes, and nobody offers it to them.
- **What CostShield does:** it reads a small business's books, finds the cost that could sink it, prices protection on that cost, and pays the business back on its own when the official price goes above a line. No claim, no adjuster, no waiting.

One-liner: **A price cap on your biggest bill, set up from your books, that pays you back on its own.**

Hook for a pitch: *"When fuel spikes, airlines are fine and small trucking companies go under. The difference is that big companies buy protection in advance. CostShield gives every small business that protection, straight from its books, and it pays out by itself."*

## How we stand out

Positioning line: **"Other cover pays for a bad day. CostShield protects you from a bad year: the cost that can close your business, measured from your books, backed by money locked on Solana, and private."**

Never name other teams or products. Compare against "cover for a bad day" (event cover bought on prediction markets) in general:

| | Cover for a bad day | CostShield |
| --- | --- | --- |
| What it covers | One event (a cold morning, a rained-out Saturday) | The cost that can close you, month after month, for a year |
| How the loss is found | The owner guesses it in a sentence | Measured from the books, net of surcharges already passed on |
| How big | Capped by an order book's depth, often a few hundred dollars | Sized to the business ($56,018 bad year, 8× profit) |
| Who pays | Whoever is selling on the order book that day | A backer whose money is locked on Solana before cover starts |
| Who sees it | Payouts and exposures are public | Encrypted with Helius Privacy Rings; lender proof with a viewing key |
| Proof | The next event | Replayed on every 12-month period since 2015 |

Facts behind the Gemini claims: Gemini lists no diesel market; the closest ladder is Brent crude, which expires within days; its depth covers one fleet, not a pool (`lib/engine/pipeline.ts`, market notes).

## What each piece does (say it this specifically)

| Piece | What it does for the business | Plain claim we can make | Do not claim |
| --- | --- | --- | --- |
| **Your books** (CSV export; sign-in code for QuickBooks Online, Xero, Zoho Books, FreshBooks) | Finds the costs a market controls and measures them | CostShield sorts every transaction, reads the gallons off each fuel receipt and measures what a spike costs after the fuel surcharges customers already pay. Every number traces to a line in the books or a public dataset; no AI guesses in the numbers | That sign-in works live (it is built and unit-tested, not switched on in the demo); "read-only access" (we say "we only read your books and never change them") |
| **U.S. Energy Information Administration** | Sets the line the protection pays on | Protection pays on the official weekly diesel price for the region, averaged per month, not on anyone's say-so | That the pump price will match (we show how closely it has followed, from the business's own receipts) |
| **Solana program** (devnet, Pinocchio) | Makes the payout certain and automatic | Before cover starts, the backer locks the full amount the protection could ever pay, in 25-cent steps, in vaults only the program can open. Each month the official price is posted once, with a fingerprint (sha256) of the government data file. If it is above a step's line, the business signs once and the program releases that step. The backer cannot block it or take it back. Unused money goes back to the backer only after every month of the term has been posted below the line. Each step pays once, only to its business | That the program checks the government file itself (it stores the fingerprint; one price-reporting key posts the price); that anything is on mainnet |
| **Helius Privacy Rings** | Keeps the amounts private, and lets a lender check them | The money in each vault and every payout are encrypted balances. The program enforces the rules without seeing the amounts. The public can see that a step paid, not how much, so a competitor or customer cannot work out the business's gallons or margins. The business can give its lender a read-only viewing key: it can read the amounts and cannot move money | That nobody at all can see amounts (Helius's prover sees them to build the proof; in this demo the server holds the test keys). Say "hidden from the public" |
| **The 25-cent steps** (a consequence of privacy) | The honest trade-off | The program cannot read encrypted amounts, so it pays in whole 25-cent steps. September 2026: $5,070 paid in 7 of 8 steps against $5,776 by the exact formula; the last $706 did not fill a step | Hiding this gap |
| **Gemini Prediction Markets** (live public API) | Tells us how big a move traders expect, which sets today's price | CostShield reads Gemini's live oil-price markets (yes/no contracts on where Brent crude will be) and turns their prices into the size of move traders expect. That sets today's price of protection: a jumpier market makes protection cost more. It also tests every live Gemini market as a way to carry the risk, and today none qualifies (no diesel market, and they expire in days), so the app says so instead of pretending | That providers hedge on Gemini; that Gemini prices the November 2025 replay (that uses an assumed 35% volatility); that a Gemini market is a hedge |
| **Lender link** (`/lender`) | Proof of cover for a loan | A shared link shows each step's line, how much was set aside and whether it paid, read with the viewing key | That a lender has used it |

## Honesty rules (from AGENTS.md and docs/DECISIONS.md, unchanged)

- It is a simulation in devnet test dollars. Nothing is for sale; no insurer or backer has signed up. Replayed months "would have paid". "Settled" only for the real devnet run.
- Keep every "not available", "rejected" and "signal only" label.
- Prices are "model prices" or "estimates", never quotes.
- No hackathon framing in product copy (no "built for UBC", no "judges"). It should read as a product. The simulation notice stays.

## Words

Use the right column (see also docs/PLAIN_LANGUAGE.md): "protection starts at $4.36" (not strike), "25-cent steps" (not plates or ladder), "backer" (not underwriter) on owner screens, "money set aside in advance" (not collateral), "the official diesel price" (not index), "what protection costs" (not premium), "money back" (not payout) in headlines. Name the technology where it does something: "on Solana", "encrypted with Helius Privacy Rings", "from Gemini's live oil markets".
