/**
 * npm run solana:setup -- prepare Solana devnet for Covenant settlement.
 *   1. Reuse or create the underwriter, oracle and fleet wallets (.solana-keys/ or SOLANA_*_KEY).
 *   2. Top up SOL for fees and rent from the payer (.solana-keys/payer.json or SOLANA_PAYER_KEY).
 *   3. Reuse the tUSD mint registered with Privacy Rings (or create and register one).
 *   4. Make sure the underwriter (and the fleet) hold private tUSD (public onramp deposit).
 *   5. Check the program is deployed and write deployments/solana-devnet.json (public addresses only).
 * Never prints secrets.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { loadEnvLocal } from "./solana-env";

loadEnvLocal();

const UNDERWRITER_DEPOSIT = 1_000_000; // tUSD
const FLEET_DEPOSIT = 25_000;
const MIN_UNDERWRITER = 100_000;
const MIN_FLEET = 1_000;
const SOL_TARGETS = { underwriter: 0.4, oracle: 0.1, fleet: 0.15 } as const;
/** The oracle key compiled into solana/program/src/lib.rs (ORACLE). */
const PROGRAM_ORACLE = "2RECf7GfWRSw8U73tyWJ1ZhTJ5U21FRHPjEaXxTa7EsH";

async function main() {
  const kit = await import("@solana/kit");
  const { getCreateAccountInstruction, getTransferSolInstruction } = await import("@solana-program/system");
  const tok = await import("@solana-program/token");
  const { Wallet, syncWallet } = await import("@heliuslabs/spr");
  const { getSplAssetRegistryAddress, getSplAssetVaultAddress } = await import("@heliuslabs/spr/addresses");
  const { getCreateSplInterfaceInstructionAsync } = await import("@heliuslabs/spr/instructions");
  const { DepositAsset, decodeSplAssetRegistry, depositInstruction } = await import("@heliuslabs/spr/interface");
  const { AssetRegistry, LocalShieldedKeys } = await import("@heliuslabs/spr/transaction");
  const { DEPLOYMENT, PROGRAM_ID, RINGS_PROGRAM_ID, TUSD, TUSD_DECIMALS, EXPLORER } = await import("../lib/chain/config");
  const { loadOrCreateRole, loadRole } = await import("../lib/chain/keys");
  const { getClient, send, solBalance } = await import("../lib/chain/program");
  const { txUrl } = await import("../lib/chain/types");
  type Role = import("../lib/chain/keys").Role;

  const client = await getClient();
  const payer = loadRole("payer");
  const underwriter = loadOrCreateRole("underwriter");
  const oracle = loadOrCreateRole("oracle");
  const fleet = loadOrCreateRole("fleet");
  const fmt = (b: bigint) => (Number(b) / Number(TUSD)).toLocaleString("en-US");
  console.log(`payer       ${payer ? `${payer.address} (${(await solBalance(payer.address)).toFixed(4)} SOL)` : "not configured (SOLANA_PAYER_KEY or .solana-keys/payer.json)"}`);
  console.log(`underwriter ${underwriter.address}\noracle      ${oracle.address}\nfleet       ${fleet.address}`);
  if (oracle.address !== PROGRAM_ORACLE) console.warn(`WARNING: the program accepts reports only from ${PROGRAM_ORACLE}; change ORACLE in solana/program/src/lib.rs, rebuild and redeploy.`);

  // 1. SOL for fees and rent.
  const transfers = [];
  for (const role of [underwriter, oracle, fleet]) {
    const have = await solBalance(role.address), want = SOL_TARGETS[role.name as keyof typeof SOL_TARGETS];
    if (have < want / 2) transfers.push({ role, ix: getTransferSolInstruction({ source: payer!.signer, destination: role.address, amount: BigInt(Math.round((want - have) * 1e9)) }) });
  }
  if (transfers.length) {
    if (!payer) throw new Error("wallets need SOL but no payer key is configured");
    const r = await send(payer.signer, transfers.map((t) => t.ix), { cu: 50_000, label: "fund wallets" });
    console.log(`topped up SOL for ${transfers.map((t) => t.role.name).join(", ")}: ${txUrl(EXPLORER, r.signature)}`);
  } else console.log("wallet SOL balances ok");

  // 2. tUSD mint registered with Rings.
  let mint = (process.env.SOLANA_TUSD_MINT?.trim() || DEPLOYMENT.mint) as import("@solana/kit").Address | null;
  let assetId = process.env.SOLANA_TUSD_ASSET_ID?.trim() || DEPLOYMENT.assetId;
  if (!mint) {
    if (!payer) throw new Error("no tUSD mint configured and no payer key to create one");
    const mintKp = await kit.generateKeyPairSigner();
    const rent = await client.solanaRpc.getMinimumBalanceForRentExemption(BigInt(tok.getMintSize())).send();
    const r = await send(payer.signer, [
      getCreateAccountInstruction({ payer: payer.signer, newAccount: mintKp, lamports: rent, space: tok.getMintSize(), programAddress: tok.TOKEN_PROGRAM_ADDRESS }),
      tok.getInitializeMint2Instruction({ mint: mintKp.address, decimals: TUSD_DECIMALS, mintAuthority: payer.address, freezeAuthority: null }),
    ], { cu: 100_000, label: "create tUSD mint" });
    mint = mintKp.address;
    assetId = null;
    console.log(`created tUSD mint ${mint}: ${txUrl(EXPLORER, r.signature)}`);
  } else console.log(`tUSD mint ${mint} (existing)`);
  const pre: import("@solana/kit").Instruction[] = [];
  if (!(await client.getAccount(await getSplAssetVaultAddress(mint)))) {
    if (!payer) throw new Error("tUSD is not registered with Rings and no payer key is configured");
    pre.push(await getCreateSplInterfaceInstructionAsync({ authority: payer.signer, mint, tokenProgram: tok.TOKEN_PROGRAM_ADDRESS }) as never);
  }

  const registryFor = (id: string) => { const r = new AssetRegistry(); r.insert(BigInt(id), mint!); return r; };
  const balanceOf = async (role: Role, id: string) => {
    const w = new Wallet({ identity: role.shielded.shieldedAddress(), registry: registryFor(id) });
    await syncWallet({ wallet: w, keys: LocalShieldedKeys.fromKeypair(role.shielded), client, config: { pageLimit: 100 } } as never);
    return w.balance(mint!).amount as bigint;
  };

  // 3. Private tUSD: mint to the payer and deposit into the underwriter's (and fleet's) private balances.
  const toBase = (x: number) => BigInt(x) * TUSD;
  const deposits: { role: Role; amount: bigint }[] = [];
  if (assetId && !pre.length) {
    const [u, f] = await Promise.all([balanceOf(underwriter, assetId), balanceOf(fleet, assetId)]);
    if (u < toBase(MIN_UNDERWRITER)) deposits.push({ role: underwriter, amount: toBase(UNDERWRITER_DEPOSIT) });
    if (f < toBase(MIN_FLEET)) deposits.push({ role: fleet, amount: toBase(FLEET_DEPOSIT) });
  } else deposits.push({ role: underwriter, amount: toBase(UNDERWRITER_DEPOSIT) }, { role: fleet, amount: toBase(FLEET_DEPOSIT) });
  if (deposits.length) {
    if (!payer) throw new Error("private balances are low and no payer key (mint authority) is configured");
    const owned = await client.solanaRpc.getTokenAccountsByOwner(payer.address, { mint }, { encoding: "base64" }).send();
    let source = owned.value[0]?.pubkey as import("@solana/kit").Address | undefined;
    const ixs: import("@solana/kit").Instruction[] = [...pre];
    if (!source) {
      const tokenKp = await kit.generateKeyPairSigner();
      const rent = await client.solanaRpc.getMinimumBalanceForRentExemption(BigInt(tok.getTokenSize())).send();
      ixs.push(
        getCreateAccountInstruction({ payer: payer.signer, newAccount: tokenKp, lamports: rent, space: tok.getTokenSize(), programAddress: tok.TOKEN_PROGRAM_ADDRESS }) as never,
        tok.getInitializeAccount3Instruction({ account: tokenKp.address, mint, owner: payer.address }) as never,
      );
      source = tokenKp.address;
    }
    const total = deposits.reduce((n, d) => n + d.amount, 0n);
    ixs.push(
      tok.getMintToInstruction({ mint, token: source, mintAuthority: payer.signer, amount: total }) as never,
      await depositInstruction({
        tree: client.tree, depositor: payer.signer,
        deposits: deposits.map((d) => ({
          asset: DepositAsset.spl({ mint: mint!, sourceTokenAccount: source!, tokenProgram: tok.TOKEN_PROGRAM_ADDRESS }),
          viewTag: d.role.shielded.shieldedAddress().confidentialViewTag(), recipientOwnerHash: d.role.shielded.shieldedAddress().ownerHash(), amount: d.amount,
        })),
      } as never) as never,
    );
    const r = await send(payer.signer, ixs, { cu: 600_000, label: "mint + private deposit" });
    console.log(`deposited ${deposits.map((d) => `${fmt(d.amount)} tUSD -> ${d.role.name}`).join(", ")} privately: ${txUrl(EXPLORER, r.signature)}`);
  } else if (pre.length) {
    const r = await send(payer!.signer, pre, { cu: 200_000, label: "create Rings interface" });
    console.log(`registered tUSD with Rings: ${txUrl(EXPLORER, r.signature)}`);
  }
  if (!assetId) {
    const acct = await client.getAccount(await getSplAssetRegistryAddress(mint));
    if (!acct) throw new Error("mint registry missing after interface setup");
    assetId = decodeSplAssetRegistry((acct as { data: Uint8Array }).data).assetId.toString();
    console.log(`tUSD registered with Rings as asset id ${assetId}`);
  }
  const [u, f] = await Promise.all([balanceOf(underwriter, assetId!), balanceOf(fleet, assetId!)]);
  console.log(`underwriter private balance: ${fmt(u)} tUSD\nfleet       private balance: ${fmt(f)} tUSD`);

  // 4. Program.
  let deployed = false;
  if (PROGRAM_ID) deployed = !!(await client.solanaRpc.getAccountInfo(kit.address(PROGRAM_ID), { encoding: "base64" }).send()).value?.executable;
  if (!deployed) console.warn("program not deployed: npm run solana:build, then\n  solana program deploy -u <helius devnet url> --keypair .solana-keys/payer.json --upgrade-authority .solana-keys/payer.json --program-id .solana-keys/program-keypair.json solana/program/target/deploy/costshield_steps.so");
  else console.log(`program ${PROGRAM_ID} deployed`);

  // 5. Public deployment record.
  const file = "deployments/solana-devnet.json";
  const prev = JSON.parse(readFileSync(file, "utf8"));
  const next = { ...prev, network: "solana-devnet", programId: PROGRAM_ID, ringsProgramId: RINGS_PROGRAM_ID, mint, assetId, underwriter: underwriter.address, oracle: oracle.address, fleet: fleet.address, updatedAt: new Date().toISOString() };
  writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
  console.log(`wrote ${file}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error("FAILED:", e instanceof Error ? e.message : e); process.exit(1); });
