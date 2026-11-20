# Port: settlement on Solana with Helius Privacy Rings

Decided 2026-11-20 by the team. The product and engine stay the same (ledger import, classification, exposure, pools, Gemini evaluation, pricing, backtest, simulator). Only settlement moves from Arc testnet to Solana devnet, and payouts become private.

## Why

- **Private by default, provable on demand.** A fleet's covered gallons reveal its volume and lanes; a payout reveals margin stress. Shippers, brokers and competitors would like to know both. With Privacy Rings, step amounts, premiums and payouts are encrypted on chain. The fleet can share a read-only viewing key with its lender or factoring company to prove it is protected and was paid; the key cannot spend.
- **Distinct from other UBC entries.** Parametric USDC cover on Arc already exists in the field; this is on Solana, with privacy and lender disclosure.
- Chain award: Best use of Solana (was Best use of Arc). Main track (DeFi) and the Gemini bounty are unchanged.

## Contract

`lib/chain/types.ts` is the shared contract between the server and the UI. Do not change its shapes without updating both sides.

## Cap to steps

The program cannot read encrypted amounts, so the monthly cap pays in steps. Strike `K = inception monthly mean + strikeOffset`. Step size `D` ($/gal, default 0.25; use 0.50 if transaction size limits force fewer steps). Step `i` triggers when the attested monthly mean is at or above `K + i*D` and pays `D * coveredGallons` tUSD. Steps run up to `K + 2.00` (the Arc version's per-gallon limit). Payout is the linear cap rounded down to the step size; show both numbers.

## Program changes (from Equity Floor)

Equity Floor was our first idea for this hackathon, written during the event and set aside on Nov 20. Its code is not in this repo. Starting point: the Equity Floor program (Pinocchio; `init_step`, write-once `report_index` with a source sha256, `release` with a CPI into Rings signed by the vault PDA, `reclaim`). Changes: a direction flag per step (pay when the index is at or above the trigger), monthly periods (YYYYMM), an index id for the EIA regional diesel series, price units of 1/1000 $/gal. Deploy a new program to devnet.

## Keys and config

Never commit secrets. Local secrets live in `.env.local` and `.solana-keys/` (both gitignored). Public addresses go in `deployments/solana-devnet.json` (committed). Reuse the Equity Floor devnet wallets, tUSD mint (`FQKedE1cBThwLvc1FJ1xr5b3DPYGVwRNVKrQVSHmCfv8`, Rings asset 427) and Helius devnet key where possible.

## Honesty

Everything is devnet with test dollars. The oracle is one trusted key that recomputes the EIA monthly mean on the server and posts it with the data file's sha256. The demo server holds every party's keys. Helius's prover sees plaintext amounts inside attested hardware. The program cannot verify a step's encrypted funding amount; the fleet (or its lender) verifies it by decrypting.
