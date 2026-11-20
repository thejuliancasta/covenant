# Archived: the Arc vault

Earlier work from this hackathon, kept for reference. It is not the settlement path: CostShield settles on Solana devnet (`solana/program`, `lib/chain`).

`src/CostShieldVault.sol` is a fully collateralised USDC vault written for Arc testnet, with 15 Foundry tests in `test/` (`npm run test:contracts`, needs Foundry). It was not deployed: `deployments/arc-testnet.json` holds no addresses. The `chain` and `abi` npm scripts, `scripts/chain.ts` and `lib/chain/arc/` belong to this archive.
