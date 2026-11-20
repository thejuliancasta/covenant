# CostShield: agent context

Read this first. It is short on purpose. Details live in the files it points to.

## What this is

CostShield is our entry in the UBC 2026 Hackathon (University Blockchain Conference, UT Austin). A small business brings its accounting ledger; CostShield classifies the expenses, measures which costs follow a public market price, tests whether anything really hedges them, prices and backtests a diesel price cap, and settles a replayed price shock as a private payout on Solana devnet. Everything is a simulation with devnet test dollars.

Team: Julian Castaneda (`thejuliancasta`) and Aabis (`GitBolt`).

## Where things are

| Path | What |
| --- | --- |
| `app/`, `components/` | Next.js 15 app. One page flow in `app/page.tsx`, lender page in `app/lender`, API routes in `app/api` |
| `lib/engine/` | The risk engine: ingest, classify, exposure, pool, Gemini evaluation, pricing, backtest, payout |
| `lib/ledger/` | CSV import and ledger sign-in for QuickBooks, Xero, Zoho Books, FreshBooks |
| `lib/chain/` | Solana settlement with Helius Privacy Rings. `lib/chain/arc` is the archived Arc version |
| `solana/program/` | The settlement program (Rust, Pinocchio) |
| `contracts/` | Archived Arc vault (Solidity, Foundry). Not the settlement path |
| `tests/` | Vitest tests for the engine and ledger |
| `deployments/` | Public addresses only. `solana-devnet.json` is read by the app |

## Docs to read before acting

| If you are touching | Read |
| --- | --- |
| Anything | `docs/DECISIONS.md` (what is settled, what is open) |
| Submission, tracks, deadline, rules | `docs/HACKATHON_GUIDE.md`, `docs/SUBMISSION.md` |
| Product behaviour or scope | `docs/PRODUCT.md`, `docs/CONCEPT.md` |
| Engine maths | `docs/MODEL.md` |
| Settlement or the program | `docs/SOLANA_PORT.md`, `docs/LIMITATIONS.md` |
| Screens, copy, colours | `design/README.md` and `design/SPEC.md` if present (they live on the `design/ui-ux-proposal` branch until merged) |

## Commands

```bash
npm install
npm run dev            # http://localhost:3000, works with no keys
npm test               # Vitest
npm run build
npm run solana:checks  # needs .env.local and .solana-keys/
npm run solana:e2e     # one devnet settlement end to end
```

## Rules that always apply

1. **Honesty over polish.** Never present a simulation, estimate or devnet payout as real. Label it. If a hedge does not track the cost, the product says no. Do not weaken a "not available" or "rejected" state to make a demo look better.
2. **Docs must match code.** If you change behaviour, update `README.md`, `docs/PRODUCT.md` and `docs/LIMITATIONS.md` in the same change. A judge will check claims against the repo.
3. **Secrets.** Never print, copy, move or commit `.env.local`, `.solana-keys/` or any private key. Only public addresses go in `deployments/`.
4. **No LLM in the pipeline.** Classification and every number are deterministic. Do not add a model call to the engine.
5. **Stack is fixed until submission.** Next.js, React, TypeScript, Tailwind, Vitest, `@solana/kit`, Privacy Rings. No new dependencies and no restructuring without asking.
6. **Git.** Do not commit or push unless asked. Commit as the person you are working for, with their own git identity. Do not add AI co-author or session lines to commits or PRs. Never force-push `main`.
7. **Hackathon rule: all code must be written during the event.** Do not paste in code from older projects or outside repos. See `docs/HACKATHON_GUIDE.md`.
8. **Record decisions.** When the team settles something, add a dated line to `docs/DECISIONS.md`.
