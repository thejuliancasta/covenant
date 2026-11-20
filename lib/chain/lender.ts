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
  const steps = await Promise.all(share.steps.map(async (st) => {
    const data = await fetchProgramAccount(address(st.account));
    if (!data) throw new Error(`Step account ${st.account} was not found under the program.`);
    const onchain = decodeStep(data);
    if (onchain.policyId !== share.policyId || onchain.stepIndex !== st.index) throw new Error(`Step account ${st.account} is not step ${st.index} of policy ${share.policyId}.`);
    const { funded } = await viewVault(address(st.account), st.vault, st.viewingKey);
    return { index: st.index, triggerPrice: fromMilli(onchain.triggerMilli), funded: fromBase(funded), paid: onchain.status === "paid" };
  }));
  steps.sort((a, b) => a.index - b.index);
  const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
  const totalFunded = r6(steps.reduce((n, s) => n + s.funded, 0));
  const totalPaid = r6(steps.filter((s) => s.paid).reduce((n, s) => n + s.funded, 0));
  return {
    policyId: share.policyId, region: share.region, period: share.period, steps, totalFunded, totalPaid, checkedAt: new Date().toISOString(),
    note: "Decrypted with the step viewing keys the fleet shared; paid flags read from the public step accounts. A paid step releases its whole vault to the fleet. Viewing keys cannot spend.",
  };
}
