/**
 * Helius Privacy Rings operations: private balances, private transfers, and
 * spending a step vault's private balance through the program (release/reclaim).
 * Uses @heliuslabs/spr 0.9.0-alpha (experimental), as the archived Equity Floor did.
 */
import type { Address, TransactionSigner } from "@solana/kit";
import { ViewingKey, Wallet, syncWallet, type ShieldedAddress, type ShieldedKeypair } from "@heliuslabs/spr";
import { LocalKeys, atSlot } from "@heliuslabs/spr/client";
import { encodeTransactInstructionData, transactInstruction } from "@heliuslabs/spr/interface";
import { ProgramOwner, ShieldedPda, transactCpiAccounts } from "@heliuslabs/spr/program";
import { ConfidentialTransfer, LocalShieldedKeys, ProofInputUtxo, decryptToBalances } from "@heliuslabs/spr/transaction";
import { addrBytes, getClient, hex, latestSlot, programAddress, registry, send, unhex } from "./program";
import type { Role } from "./keys";
import { fromBase } from "./config";

// ---------------------------------------------------------------- mutex
let chainLock: Promise<unknown> = Promise.resolve();
/** Serialize settlement runs: private note selection must not race. */
export function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chainLock.then(fn, fn);
  chainLock = run.catch(() => undefined);
  return run;
}

// ------------------------------------------------------- private balances
async function syncedWallet(kp: ShieldedKeypair): Promise<Wallet> {
  const client = await getClient();
  const { registry: reg } = registry();
  const w = new Wallet({ identity: kp.shieldedAddress(), registry: reg.clone() });
  const slot = latestSlot();
  await syncWallet({ wallet: w, keys: LocalShieldedKeys.fromKeypair(kp), client, config: { pageLimit: 100, ...(slot > 0n ? { requireSlot: slot } : {}) } } as any);
  return w;
}

/** A role's private tUSD balance, decrypted with its own key (base units). */
export async function privateBalance(role: Role): Promise<bigint> {
  const { mint } = registry();
  return (await syncedWallet(role.shielded)).balance(mint).amount;
}

/** Private transfer from a role's own balance to shielded recipients (one Rings transaction). */
export async function privateSend(from: Role, outputs: { to: ShieldedAddress; amount: bigint }[], label: string) {
  const client = await getClient();
  const { mint, registry: reg } = registry();
  const w = await syncedWallet(from.shielded);
  const total = outputs.reduce((n, o) => n + o.amount, 0n);
  const utxos = [...w.balance(mint).utxos].sort((a: any, b: any) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0));
  const single = [...utxos].reverse().find((u: any) => u.amount >= total);
  const inputs: any[] = single ? [single] : [];
  if (!single) {
    let acc = 0n;
    for (const u of utxos.slice(0, 4) as any[]) { inputs.push(u); acc += u.amount; if (acc >= total) break; }
    if (acc < total) throw new Error(`${from.name} private balance too low for ${fromBase(total)} tUSD (have ${fromBase(w.balance(mint).amount)}); run npm run solana:setup`);
  }
  const tx = new ConfidentialTransfer(from.shielded.shieldedAddress(), inputs.map((u) => ProofInputUtxo.fromKeypair(u, from.shielded)), from.address);
  for (const o of outputs) tx.send(o.to, mint, o.amount);
  const proofInputs = tx.sign(from.shielded, reg.clone());
  const keys = LocalKeys.fromKeypair(from.shielded, client.proofService);
  try {
    const data = await client.proveTransact(proofInputs, keys);
    const ix = await transactInstruction({ payer: from.signer, ownerSigners: [from.signer], inputTree: client.tree, outputTree: client.tree, data });
    return await send(from.signer, [ix], { label });
  } finally {
    (keys as any).destroy?.();
  }
}

// ------------------------------------------------------------ step vaults
export const vaultOwner = (step: Address) => ProgramOwner.find(["vault", addrBytes(step)], programAddress());
const vaultView = (owner: ProgramOwner, keyHex: string) => ShieldedPda.withViewingKey(owner.pda, ProgramOwner.nullifierKey(), ViewingKey.fromBytes(unhex(keyHex) as never));

/** A fresh viewing key for a step vault, and the vault's shielded address under it. */
export async function newVaultKey(step: Address): Promise<{ keyHex: string; to: ShieldedAddress; vault: Address }> {
  const vk = ViewingKey.generate();
  const owner = await vaultOwner(step);
  return { keyHex: hex(vk.secretBytes()), to: owner.address(vk.publicKey()), vault: owner.pda as Address };
}

/** Shielded transactions that touched a vault, from the indexer (by the vault's public owner tag). */
async function vaultTransactions(owner: ProgramOwner): Promise<any[]> {
  const client = await getClient();
  const slot = latestSlot();
  const r = await client.getShieldedTransactionsByTags({ tags: [owner.ownerTag()], limit: 50 } as any, slot > 0n ? atSlot(slot) : undefined);
  return (r as any).data as any[];
}

/** The vault's unspent private balance, decrypted with the step viewing key. */
async function vaultBalance(step: Address, keyHex: string) {
  const { mint, registry: reg } = registry();
  const owner = await vaultOwner(step);
  const view = vaultView(owner, keyHex);
  for (let attempt = 0; attempt < 6; attempt++) {
    const txs = (await vaultTransactions(owner)).flatMap((i: any) => i.events);
    const bal = (await decryptToBalances({ keypair: view as never, registry: reg, transactions: txs })).balance(mint);
    if (bal.amount > 0n || attempt === 5) return { owner, view, bal };
    await new Promise((r) => setTimeout(r, 1500)); // indexer lag right after funding
  }
  throw new Error("unreachable");
}

/**
 * Prove a spend of the whole vault balance to `to`, for the program to sign as the
 * vault PDA (release or reclaim). Returns null if the vault holds nothing.
 */
export async function proveVaultSpend(step: Address, keyHex: string, to: ShieldedAddress, payer: TransactionSigner) {
  const client = await getClient();
  const { mint, registry: reg } = registry();
  const { owner, view, bal } = await vaultBalance(step, keyHex);
  if (bal.amount === 0n || bal.utxos.length === 0) return null;
  const transfer = new ConfidentialTransfer(owner.address(view.viewingPublicKey()), bal.utxos.map((u: any) => ProofInputUtxo.fromKeypair(u, view as never)), payer.address);
  transfer.send(to, mint, bal.amount);
  const data = await client.proveTransact(transfer.sign(view as never, reg.clone()), [view as never] as never);
  const sppAccounts = await transactCpiAccounts({ payer, inputTree: client.tree, outputTree: client.tree, ownerSigners: [], data, signerPdas: [owner.pda] } as any);
  return { sppAccounts: sppAccounts as readonly any[], transactData: encodeTransactInstructionData(data), amount: bal.amount as bigint };
}

/** What `kp` received in one transaction, decrypted with its own key (base units). */
export async function receivedIn(signature: string, kp: ShieldedKeypair): Promise<bigint> {
  const client = await getClient();
  const { mint, registry: reg } = registry();
  const resp = await client.getShieldedTransactionsBySignature(signature as never);
  const txs = (resp as any).transactions.map((t: any) => t.transaction);
  return (await decryptToBalances({ keypair: kp, registry: reg, transactions: txs })).balance(mint).amount;
}

/**
 * Read-only view of a step vault with ONLY its viewing key: the total ever funded
 * (sum of outputs it received, decrypted transaction by transaction) and what is
 * still unspent. A viewing key cannot spend.
 */
export async function viewVault(step: Address, vault: string, keyHex: string): Promise<{ funded: bigint; unspent: bigint }> {
  const { mint, registry: reg } = registry();
  const owner = await vaultOwner(step);
  if (owner.pda !== vault) throw new Error(`vault ${vault} does not belong to step ${step}`);
  const view = vaultView(owner, keyHex);
  const items = await vaultTransactions(owner);
  let funded = 0n;
  for (const it of items) funded += (await decryptToBalances({ keypair: view as never, registry: reg, transactions: it.events })).balance(mint).amount;
  const unspent = (await decryptToBalances({ keypair: view as never, registry: reg, transactions: items.flatMap((i: any) => i.events) })).balance(mint).amount;
  return { funded, unspent };
}
