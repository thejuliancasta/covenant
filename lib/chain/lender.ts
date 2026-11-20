/**
 * Lender (or factoring company) view of a policy. Uses ONLY what the fleet
 * shared, the per-step viewing keys, plus public step accounts on chain.
 * No spending key is loaded here: a viewing key decrypts a vault's history but cannot move it.
 */
import { address, isAddress } from "@solana/kit";
import { decodeStep, fetchProgramAccount } from "./program";
import { viewVault } from "./rings";
import { fromBase, fromMilli } from "./config";
import type { LenderShare, LenderView } from "./types";

export function validShare(s: unknown): s is LenderShare {
  const x = s as LenderShare;
  return !!x && typeof x.policyId === "string" && /^[0-9a-f]{16}$/.test(x.policyId) && typeof x.region === "string" && Number.isInteger(x.period)
    && Array.isArray(x.steps) && x.steps.length > 0 && x.steps.length <= 16
    && x.steps.every((st) => Number.isInteger(st.index) && isAddress(st.account) && isAddress(st.vault) && /^[0-9a-f]{64}$/.test(st.viewingKey));
}

export async function lenderView(share: LenderShare): Promise<LenderView> {
  // The public RPC and Rings indexer can throttle concurrent reads. Fetch each
  // vault in order, retrying only transport failures; malformed shares still
  // fail immediately instead of being mistaken for a temporary indexer lag.
  const steps: LenderView["steps"] = [];
  for (const st of share.steps) {
    let entry: LenderView["steps"][number] | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const data = await fetchProgramAccount(address(st.account));
        if (!data) throw new Error(`Step account ${st.account} was not found under the program.`);
        const onchain = decodeStep(data);
        if (onchain.policyId !== share.policyId || onchain.stepIndex !== st.index) throw new Error(`Step account ${st.account} is not step ${st.index} of policy ${share.policyId}.`);
        const { funded, unspent } = await viewVault(address(st.account), st.vault, st.viewingKey);
        entry = { index: st.index, triggerPrice: fromMilli(onchain.triggerMilli), funded: fromBase(funded), unspent: fromBase(unspent), status: onchain.status, paid: onchain.status === "paid" };
        break;
      } catch (e) {
        const transient = e instanceof Error && /fetch failed|429|timeout|temporarily unavailable/i.test(e.message);
        if (!transient || attempt === 2) throw e;
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    steps.push(entry!);
  }
  steps.sort((a, b) => a.index - b.index);
  const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
  const totalFunded = r6(steps.reduce((n, s) => n + s.funded, 0));
  const totalPaid = r6(steps.filter((s) => s.paid).reduce((n, s) => n + Math.max(0, s.funded - s.unspent), 0));
  return {
    policyId: share.policyId, region: share.region, period: share.period, steps, totalFunded, totalPaid, checkedAt: new Date().toISOString(),
    note: "Decrypted funding and remaining balances with the step viewing keys the fleet shared; status flags read from public step accounts. The released amount is what left paid step vaults, not proof of the recipient. The fleet must independently decrypt its own incoming transfers to prove receipt. Viewing keys cannot spend.",
  };
}
