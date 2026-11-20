/**
 * Arc testnet admin script. Reads keys from .env.local (never committed).
 *   npm run chain -- deploy          deploy the vault, fund oracle gas, deposit collateral
 *   npm run chain -- status          print balances and vault state
 *   npm run chain -- deposit [usdc]  deposit more collateral from the underwriter
 *   npm run chain -- recycle         sweep the demo beneficiary's balance back into the vault
 *   npm run chain -- demo            run one full settlement and record it as evidence
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
for (const line of existsSync(".env.local") ? readFileSync(".env.local", "utf8").split("\n") : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

async function main() {
  const { createWalletClient, http, parseUnits, formatUnits, parseEther } = await import("viem");
  const { vaultAbi, vaultBytecode } = await import("../lib/chain/arc/abi");
  const { arcTestnet, USDC_ADDRESS, erc20Abi, EXPLORER } = await import("../lib/chain/arc/config");
  const { publicClient, roles, chainStatus, runSettlement } = await import("../lib/chain/arc/server");
  const cmd = process.argv[2] ?? "status";
  const r = roles();
  if (!r.underwriter || !r.oracle || !r.beneficiary) throw new Error("Set UNDERWRITER_PRIVATE_KEY, ORACLE_PRIVATE_KEY and BENEFICIARY_PRIVATE_KEY in .env.local");
  const file = "deployments/arc-testnet.json";
  const dep = JSON.parse(readFileSync(file, "utf8"));
  const save = () => {
    writeFileSync(file, JSON.stringify(dep, null, 2) + "\n");
    // Keep the README's deployment section in step with the deployment file.
    const readme = readFileSync("README.md", "utf8");
    const a = (x: string) => `[\`${x}\`](${EXPLORER}/address/${x})`;
    const block = [
      "### Deployed contract", "",
      "| | |", "| --- | --- |",
      `| Network | Arc testnet, chain ID ${dep.chainId} |`,
      `| CostShieldVault | ${a(dep.vault)} |`,
      `| USDC | ${a(USDC_ADDRESS)} |`,
      `| Owner and underwriter | ${a(dep.owner)} |`,
      `| Oracle | ${a(dep.oracle)} |`,
      `| Beneficiary (demo wallet) | ${a(dep.beneficiary)} |`,
      `| Deployment transaction | [\`${dep.deployTx}\`](${EXPLORER}/tx/${dep.deployTx}) |`,
      "", "Recorded transactions:", "",
      ...dep.evidence.map((e: { label: string; tx: string; note: string }) => `- ${e.label}: [\`${e.tx}\`](${EXPLORER}/tx/${e.tx}). ${e.note}.`),
    ].join("\n");
    writeFileSync("README.md", readme.replace(/<!-- DEPLOYMENT:START -->[\s\S]*<!-- DEPLOYMENT:END -->/, `<!-- DEPLOYMENT:START -->\n${block}\n<!-- DEPLOYMENT:END -->`));
  };
  const w = createWalletClient({ account: r.underwriter, chain: arcTestnet, transport: http() });
  const bal = async (a: `0x${string}`) => formatUnits(await publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [a] }), 6);
  const wait = (hash: `0x${string}`) => publicClient.waitForTransactionReceipt({ hash });
  const vault = (process.env.VAULT_ADDRESS || dep.vault) as `0x${string}` | null;

  if (cmd === "deploy") {
    console.log(`underwriter ${r.underwriter.address} has ${await bal(r.underwriter.address)} USDC`);
    const hash = await w.deployContract({ abi: vaultAbi, bytecode: vaultBytecode, args: [USDC_ADDRESS, r.oracle.address] });
    const rc = await wait(hash);
    if (!rc.contractAddress) throw new Error("deployment failed");
    Object.assign(dep, { vault: rc.contractAddress, deployTx: hash, deployedAt: new Date().toISOString(), owner: r.underwriter.address, oracle: r.oracle.address, beneficiary: r.beneficiary.address, evidence: [] });
    save();
    console.log(`vault ${rc.contractAddress}\n${EXPLORER}/address/${rc.contractAddress}`);
    // Gas money (native USDC, 18 decimals) for the oracle and the demo beneficiary.
    for (const a of [r.oracle.address, r.beneficiary.address]) await wait(await w.sendTransaction({ to: a, value: parseEther("0.3") }));
    const total = await publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [r.underwriter.address] });
    const amount = total - parseUnits("1", 6); // keep 1 USDC for the underwriter's own gas
    if (amount <= 0n) throw new Error("underwriter has too little USDC to fund the vault");
    await wait(await w.writeContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: "approve", args: [rc.contractAddress, amount] }));
    const depTx = await w.writeContract({ address: rc.contractAddress, abi: vaultAbi, functionName: "deposit", args: [amount] });
    await wait(depTx);
    dep.evidence.push({ label: "Collateral deposit", tx: depTx, note: `${formatUnits(amount, 6)} testnet USDC from the underwriter` });
    save();
    console.log(`deposited ${formatUnits(amount, 6)} USDC. The address is saved in deployments/arc-testnet.json; commit that file.`);
  } else if (cmd === "deposit") {
    if (!vault) throw new Error("no vault deployed");
    const amount = parseUnits(process.argv[3] ?? "5", 6);
    await wait(await w.writeContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: "approve", args: [vault, amount] }));
    console.log("deposit tx", await w.writeContract({ address: vault, abi: vaultAbi, functionName: "deposit", args: [amount] }));
  } else if (cmd === "recycle") {
    if (!vault) throw new Error("no vault deployed");
    const b = createWalletClient({ account: r.beneficiary, chain: arcTestnet, transport: http() });
    const total = await publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [r.beneficiary.address] });
    const amount = total - parseUnits("0.2", 6);
    if (amount <= 0n) return console.log("nothing to recycle");
    await wait(await b.writeContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: "approve", args: [vault, amount] }));
    console.log("recycled", formatUnits(amount, 6), "USDC, tx", await b.writeContract({ address: vault, abi: vaultAbi, functionName: "deposit", args: [amount] }));
  } else if (cmd === "demo") {
    for await (const ev of runSettlement({ region: "PADD2", inceptionMonth: "2025-11", settleMonth: "2026-09", strikeOffset: 0.5, coveredGallons: 2897, maxCoveredGallons: 3676 })) {
      if (ev.type === "step" && ev.status !== "running") console.log(`[${ev.status}] ${ev.label}${ev.tx ? ` ${ev.tx}` : ""}${ev.detail ? ` :: ${ev.detail}` : ""}`);
      if (ev.type === "error") throw new Error(ev.message);
      if (ev.type === "result") {
        const x = ev.result;
        dep.evidence.push({ label: `Policy #${x.policyId} opened`, tx: x.txs.open, note: "Limit reserved from free collateral" });
        dep.evidence.push({ label: `Settlement, period ${x.period}`, tx: x.txs.settle, note: `Index $${x.indexMean} vs strike $${x.strike}, ${x.quantityMilli} milli-gallons: ${x.payoutUsdc} USDC paid to ${x.beneficiary}` });
        dep.evidence.push({ label: `Policy #${x.policyId} closed`, tx: x.txs.close, note: "Unused reserve released" });
        save();
        console.log(JSON.stringify(x, null, 2));
      }
    }
  }
  console.log(await chainStatus());
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
