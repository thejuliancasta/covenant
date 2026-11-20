/**
 * npm run solana:checks -- on-chain enforcement and privacy checks for the Covenant
 * steps program on Solana devnet (adapted from the checks for Equity Floor, our first
 * idea for this hackathon, written during the event and set aside on Nov 20).
 * Lands deliberately invalid transactions (skipPreflight) and asserts the program's
 * custom error codes, scans public transaction bytes and logs for amounts, and
 * exercises release and reclaim. Uses small odd amounts so a leak would be unambiguous.
 */
import { loadEnvLocal } from "./solana-env";

loadEnvLocal();

async function main() {
  const { generateKeyPairSigner, address } = await import("@solana/kit");
  type Instruction = import("@solana/kit").Instruction;
  type Address = import("@solana/kit").Address;
  const { randomBytes, createHash } = await import("node:crypto");
  const { RINGS_PROGRAM_ID, EXPLORER, INDEXES, toMilli } = await import("../lib/chain/config");
  const { roles } = await import("../lib/chain/keys");
  const P = await import("../lib/chain/program");
  const { newVaultKey, privateSend, proveVaultSpend } = await import("../lib/chain/rings");
  const { SERIES, monthlyMean } = await import("../lib/engine/series");
  const { txUrl } = await import("../lib/chain/types");

  const r = roles();
  if (!r.underwriter || !r.oracle || !r.fleet) throw new Error("keys missing: run npm run solana:setup");
  const { underwriter, oracle, fleet } = r as Required<{ [K in keyof typeof r]: NonNullable<(typeof r)[K]> }>;
  const client = await P.getClient();
  const results: { check: string; expected: string; got: string; ok: boolean; url?: string }[] = [];

  async function fetchTx(sig: string): Promise<any> {
    for (let i = 0; i < 20; i++) {
      const tx = await (client.solanaRpc as any).getTransaction(sig, { encoding: "base64", maxSupportedTransactionVersion: 1, commitment: "confirmed" }).send();
      if (tx) return tx;
      await new Promise((res) => setTimeout(res, 1000));
    }
    throw new Error(`tx ${sig} not found`);
  }

  /** Land a transaction that must fail on chain with `code` (custom error) or any error. */
  async function expectFail(check: string, payer: import("@solana/kit").TransactionSigner, ixs: Instruction[], code?: number) {
    let sig: string | undefined;
    try { sig = (await P.send(payer, ixs, { skipPreflight: true, label: check })).signature; }
    catch (e) { sig = (e as InstanceType<typeof P.ChainError>).signature; if (!sig) throw e; }
    const tx = await fetchTx(sig);
    const err = tx.meta?.err;
    const custom = err?.InstructionError?.[1]?.Custom;
    const got = err ? (custom !== undefined ? `Custom(${custom})` : JSON.stringify(err)) : "success";
    const ok = Boolean(err) && (code === undefined || Number(custom) === code);
    results.push({ check, expected: code === undefined ? "any error" : `Custom(${code})`, got, ok, url: txUrl(EXPLORER, sig) });
    console.log(`  ${ok ? "OK  " : "FAIL"} ${check}: ${got}  ${txUrl(EXPLORER, sig)}`);
  }

  async function leakScan(label: string, sig: string, amounts: bigint[]) {
    const tx = await fetchTx(sig);
    const raw = Buffer.from(tx.transaction[0], "base64");
    const logs: string[] = tx.meta?.logMessages ?? [];
    const inner = JSON.stringify(tx.meta?.innerInstructions ?? []);
    const leaks = amounts.filter((a) => raw.includes(Buffer.from(P.u64le(a))) || logs.some((l) => l.includes(a.toString())) || inner.includes(a.toString()));
    const ok = leaks.length === 0;
    results.push({ check: `privacy: ${label}`, expected: "amount not in public tx", got: ok ? "not found" : `found ${leaks}`, ok, url: txUrl(EXPLORER, sig) });
    console.log(`  ${ok ? "OK  " : "FAIL"} privacy ${label}: ${amounts.map((a) => Number(a) / 1e6).join("/")} tUSD ${ok ? "not present" : "PRESENT"} in ${raw.length} tx bytes + logs`);
  }

  const pass = (check: string, ok: boolean, got: string, url?: string) => { results.push({ check, expected: "ok", got, ok, url }); console.log(`  ${ok ? "OK  " : "FAIL"} ${check}: ${got}${url ? "  " + url : ""}`); };

  // Reports: the oracle posts the real PADD2 means for 2026-08 and 2026-09 (write-once; reuse if present).
  const index = INDEXES.PADD2;
  const means = monthlyMean(SERIES.diesel_padd2_weekly.points);
  const sha = createHash("sha256").update(JSON.stringify(SERIES.diesel_padd2_weekly)).digest();
  async function ensureReport(period: number, ym: string) {
    const addr = await P.reportPda(index.id, period);
    if (!(await P.fetchProgramAccount(addr))) await P.send(oracle.signer, [P.reportIndexIx(oracle.signer, oracle.signer, addr, index.id, period, toMilli(means.get(ym)!), sha)], { cu: 100_000, label: `report ${period}` });
    return { addr, value: P.decodeReport((await P.fetchProgramAccount(addr))!).valueMilli };
  }
  const R08 = await ensureReport(202608, "2026-08");
  const R09 = await ensureReport(202609, "2026-09");
  console.log(`reports: 202608 = ${Number(R08.value) / 1000}, 202609 = ${Number(R09.value) / 1000}`);

  /** Open a policy of steps (one tx) and fund each vault privately (one tx). */
  async function openPolicy(first: number, last: number, steps: { trigger: number; amount: bigint }[]) {
    const pid = Uint8Array.from(randomBytes(8));
    const accounts: Address[] = [];
    for (let i = 0; i < steps.length; i++) accounts.push(await P.stepPda(fleet.address, pid, i + 1));
    const open = await P.send(underwriter.signer, steps.map((s, i) => P.initStepIx(underwriter.signer, accounts[i], fleet.signer, underwriter.signer, {
      policyId: pid, index: i + 1, indexId: index.id, firstPeriod: first, lastPeriod: last, direction: 0, triggerMilli: toMilli(s.trigger),
    })), { cu: 300_000, label: "open" });
    const keys = await Promise.all(accounts.map((a) => newVaultKey(a)));
    const fund = await privateSend(underwriter, keys.map((k, i) => ({ to: k.to, amount: steps[i].amount })), "fund");
    return { pid: P.hex(pid), accounts, keys, open: open.signature, fund: fund.signature };
  }

  console.log("\n[1] policy A for 2026-09: step 1 trigger $6.000 (hit), step 2 $7.000 (not hit), step 3 $6.200 (hit)");
  const amtA = [1_234_567n, 2_345_678n, 3_456_789n];
  const A = await openPolicy(202609, 202609, [{ trigger: 6.0, amount: amtA[0] }, { trigger: 7.0, amount: amtA[1] }, { trigger: 6.2, amount: amtA[2] }]);
  console.log(`  policy ${A.pid}  open ${txUrl(EXPLORER, A.open)}\n  fund ${txUrl(EXPLORER, A.fund)}`);

  console.log("\n[2] attacks on release");
  const s2 = (await proveVaultSpend(A.accounts[1], A.keys[1].keyHex, fleet.shielded.shieldedAddress(), fleet.signer))!;
  await expectFail("release step 2 ($7.000) with 202609 = $6.350", fleet.signer, [P.releaseIx(A.accounts[1], R09.addr, fleet.signer, s2.sppAccounts, s2.transactData)], 6001);
  const s1 = (await proveVaultSpend(A.accounts[0], A.keys[0].keyHex, fleet.shielded.shieldedAddress(), fleet.signer))!;
  const attacker = await generateKeyPairSigner();
  await expectFail("release step 1 signed by a non-fleet key", fleet.signer, [P.releaseIx(A.accounts[0], R09.addr, attacker, s1.sppAccounts, s1.transactData)], 6008);
  await expectFail("release step 1 with the 202608 report (outside the term)", fleet.signer, [P.releaseIx(A.accounts[0], R08.addr, fleet.signer, s1.sppAccounts, s1.transactData)], 6009);
  await expectFail("bypass the program: Rings transact spending the vault directly", fleet.signer, [
    { programAddress: address(RINGS_PROGRAM_ID), accounts: s1.sppAccounts as never, data: P.concat(Uint8Array.of(16), s1.transactData) },
  ]);
  await expectFail("reclaim step 3, which triggered in the term", underwriter.signer, [P.reclaimIx(A.accounts[2], underwriter.signer, [R09.addr], s1.sppAccounts, s1.transactData)], 6014);
  await expectFail("reclaim step 2 signed by a non-underwriter key", fleet.signer, [P.reclaimIx(A.accounts[1], fleet.signer, [R09.addr], s2.sppAccounts, s2.transactData)], 6013);

  console.log("\n[3] attacks on report_index");
  const fake = await generateKeyPairSigner();
  await expectFail("report_index signed by a non-oracle key", fleet.signer, [P.reportIndexIx(fleet.signer, fake, await P.reportPda(index.id, 209912), index.id, 209912, 9_999n, new Uint8Array(32))], 6002);
  await expectFail("report_index overwriting 202609", oracle.signer, [P.reportIndexIx(oracle.signer, oracle.signer, R09.addr, index.id, 202609, 9_999n, new Uint8Array(32))], 6011);

  console.log("\n[4] valid release of step 1, then a replay");
  const rel1 = await P.send(fleet.signer, [P.releaseIx(A.accounts[0], R09.addr, fleet.signer, s1.sppAccounts, s1.transactData)], { label: "release step 1" });
  pass("release step 1 lands", true, "success", txUrl(EXPLORER, rel1.signature));
  await expectFail("release step 1 again after it was paid", fleet.signer, [P.releaseIx(A.accounts[0], R09.addr, fleet.signer, s1.sppAccounts, s1.transactData)], 6007);
  const st1 = P.decodeStep((await P.fetchProgramAccount(A.accounts[0]))!);
  pass("step 1 account shows paid in 202609", st1.status === "paid" && st1.settledPeriod === 202609, `${st1.status} ${st1.settledPeriod}`);

  console.log("\n[5] privacy scan of public transaction data");
  await leakScan("fund (underwriter -> 3 vaults)", A.fund, [...amtA, amtA[0] + amtA[1] + amtA[2]]);
  await leakScan("release step 1 (vault -> fleet)", rel1.signature, [amtA[0]]);

  console.log("\n[6] reclaim: policy B for 2026-08..2026-09 with one step at $9.000 (never hit)");
  const amtB = 4_567_891n;
  const B = await openPolicy(202608, 202609, [{ trigger: 9.0, amount: amtB }]);
  const sb = (await proveVaultSpend(B.accounts[0], B.keys[0].keyHex, underwriter.shielded.shieldedAddress(), underwriter.signer))!;
  await expectFail("reclaim with only the 202609 report (202608 missing)", underwriter.signer, [P.reclaimIx(B.accounts[0], underwriter.signer, [R09.addr], sb.sppAccounts, sb.transactData)], 6015);
  const rcB = await P.send(underwriter.signer, [P.reclaimIx(B.accounts[0], underwriter.signer, [R08.addr, R09.addr], sb.sppAccounts, sb.transactData)], { label: "reclaim B" });
  const stB = P.decodeStep((await P.fetchProgramAccount(B.accounts[0]))!);
  pass("reclaim with both reports lands; step shows reclaimed", stB.status === "reclaimed", stB.status, txUrl(EXPLORER, rcB.signature));
  await leakScan("reclaim (vault -> underwriter)", rcB.signature, [amtB]);

  console.log("\n[7] cleanup: release step 3, reclaim step 2");
  const s3 = (await proveVaultSpend(A.accounts[2], A.keys[2].keyHex, fleet.shielded.shieldedAddress(), fleet.signer))!;
  const rel3 = await P.send(fleet.signer, [P.releaseIx(A.accounts[2], R09.addr, fleet.signer, s3.sppAccounts, s3.transactData)], { label: "release step 3" });
  pass("release step 3 lands", true, "success", txUrl(EXPLORER, rel3.signature));
  const s2u = (await proveVaultSpend(A.accounts[1], A.keys[1].keyHex, underwriter.shielded.shieldedAddress(), underwriter.signer))!;
  const rc2 = await P.send(underwriter.signer, [P.reclaimIx(A.accounts[1], underwriter.signer, [R09.addr], s2u.sppAccounts, s2u.transactData)], { label: "reclaim step 2" });
  pass("reclaim untriggered step 2 lands", true, "success", txUrl(EXPLORER, rc2.signature));

  console.log("\nRESULTS");
  for (const x of results) console.log(`  ${x.ok ? "OK  " : "FAIL"} ${x.check} (expected ${x.expected}, got ${x.got})`);
  const failed = results.filter((x) => !x.ok).length;
  console.log(`${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error("\nFAILED:", e instanceof Error ? e.message : e); process.exit(1); });
