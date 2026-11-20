"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import type { SettlementResult } from "@/lib/chain/types";
import { ppg } from "@/lib/format";
import { Row, cx } from "../ui";
import { Panel as Card } from "./surface";
import { LockIcon, shareFragment, tusd } from "../chain";
import { CipherGlyphs, DecodeText } from "./cipher";
import { UI_SPRING } from "./motion";
import { ArrowOut, DrawCheck, TxChip, useCopy } from "./tx";

const amt = (x: number) => x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The same settlement, seen by the business (decoded left to right) and by the public chain (cipher). */
export function TwoViews({ r, company }: { r: SettlementResult; company: string }) {
  const fleetRef = useRef<HTMLDivElement>(null);
  const seen = useInView(fleetRef, { once: true, amount: 0.25 });
  const txs: { label: string; sig: string; priv?: boolean }[] = [
    { label: "Open the policy", sig: r.txs.open },
    ...r.txs.fund.map((sig, i) => ({ label: r.txs.fund.length > 1 ? `Set money aside, part ${i + 1}` : "Set money aside", sig, priv: true })),
    { label: r.txs.reportAlreadyOnChain ? "Post the official price (reused)" : "Post the official price", sig: r.txs.report },
    ...r.txs.releases.map((sig, i) => ({ label: `Payment ${i + 1}`, sig, priv: true })),
    ...(r.txs.reclaim ? [{ label: "Unused money back to the backer", sig: r.txs.reclaim, priv: true }] : []),
  ];
  return (
    <section aria-label="Two views of the same settlement" className="space-y-4">
      <div className="max-w-2xl">
        <h2 className="text-[22px] font-[550] leading-[1.1] tracking-[-0.022em] text-ink sm:text-[26px]">Two views of the same payment</h2>
        <p className="mt-2 text-[14px] leading-[1.5] text-muted">What {company} reads with its own keys, beside what everyone else sees on the blockchain.</p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <Card>
            <div ref={fleetRef}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-[15px] font-medium leading-6 tracking-[-0.01em] text-ink">What {company} sees</h3>
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink2"><LockIcon className="text-cipher" />Decrypted with its own keys</span>
              </div>
              <p className="mt-1 text-[13px] text-muted">Every amount, readable with its own keys</p>
              <div className="mt-3">
                {r.steps.map((s, i) => (
                  <Row key={s.index} label={`Step ${s.index}, pays at ${ppg(s.triggerPrice)}`} hint={s.paid ? "paid to the business" : s.triggered ? "due" : "price not reached, back to the backer"}>
                    <DecodeText text={tusd(s.amount)} play={seen} seed={`f${s.index}`} delayMs={i * 90} />
                  </Row>
                ))}
                <Row label={<span className="font-medium text-ink">Payout received</span>}><DecodeText text={tusd(r.fleetView.received)} play={seen} delayMs={r.steps.length * 90} className="font-[550] text-jade" /></Row>
                <Row label="Its private balance, before → after"><DecodeText text={`${tusd(r.fleetView.balanceBefore)} → ${tusd(r.fleetView.balanceAfter)}`} play={seen} delayMs={(r.steps.length + 1) * 90} stepMs={26} /></Row>
              </div>
            </div>
          </Card>
          <LenderShareCard r={r} company={company} />
        </div>
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[15px] font-medium leading-6 tracking-[-0.01em] text-ink">What everyone else sees on the blockchain</h3>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-cipher"><LockIcon />Amounts encrypted</span>
          </div>
          <p className="mt-1 text-[13px] text-muted">The terms and what happened, never the amounts</p>
          <div className="mt-3">
            {r.steps.map((s) => <Row key={s.index} label={`Step ${s.index}, pays at ${ppg(s.triggerPrice)}`} hint={s.paid ? "marked paid" : "not paid"}><CipherGlyphs length={8} seed={`${r.policyId}-${s.index}`} label="Encrypted" /></Row>)}
            <Row label="Payout received"><CipherGlyphs length={8} seed={`${r.policyId}-paid`} label="Encrypted" live /></Row>
            <Row label="The business balance"><CipherGlyphs length={10} seed={`${r.policyId}-bal`} label="Encrypted" /></Row>
          </div>
          <div className="mt-5 grid gap-5 text-[13px] sm:grid-cols-2">
            <div>
              <h4 className="text-[13px] font-medium text-ink2">Visible to anyone</h4>
              <ul className="mt-2 space-y-1.5">{r.publicView.visible.map((v) => <li key={v} className="flex gap-2 leading-[1.5] text-muted"><svg viewBox="0 0 14 14" width="12" height="12" aria-hidden className="mt-1 shrink-0 text-jade"><path d="M2.5 7.4 5.6 10.3 11.5 3.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg><span className="min-w-0 break-words">{v}</span></li>)}</ul>
            </div>
            <div>
              <h4 className="text-[13px] font-medium text-ink2">Hidden (encrypted)</h4>
              <ul className="mt-2 space-y-1.5">{r.publicView.hidden.map((v) => <li key={v} className="flex items-start gap-2 leading-[1.5] text-muted"><LockIcon className="mt-1.5 shrink-0 text-cipher" /><span>{v}</span></li>)}</ul>
            </div>
          </div>
          <h4 className="mt-6 text-[13px] font-medium text-ink2">Transactions</h4>
          <ul className="mt-2 space-y-1.5 text-[13px]">
            {txs.map((t) => (
              <li key={t.sig + t.label} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-0.5">
                <span className="flex min-w-0 items-center gap-2 text-ink2">{t.label}{t.priv && <span className="inline-flex items-center gap-1 text-[11.5px] text-cipher"><LockIcon />private</span>}</span>
                <TxChip sig={t.sig} explorer={r.explorer} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </section>
  );
}

export function LenderShareCard({ r, company }: { r: SettlementResult; company: string }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const url = `${origin}${shareFragment(r.lenderShare)}`;
  const { state, copy } = useCopy(url);
  return (
    <Card>
      <h3 className="text-[17px] font-medium leading-6 tracking-[-0.015em] text-ink">Proof for your lender</h3>
      <p className="mt-2 max-w-[60ch] text-[14px] leading-[1.55] text-ink2">Your lender sees what was set aside and what was paid to you. It can&apos;t move money or see your other accounts.</p>
      <p className="mt-2 max-w-[60ch] text-[12.5px] leading-[1.55] text-faint">Your lender or factoring company can read this policy&apos;s coverage and payouts with this link but cannot spend: it carries read-only keys for the {r.lenderShare.steps.length} steps of money set aside, and the keys travel in the part of the URL after #, which browsers do not send when loading a page.</p>
      <div className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-control border border-line/8 bg-bg/40 pl-3 pr-1 transition-[border-color] duration-150 focus-within:border-jade/50">
          <LockIcon className="shrink-0 text-cipher" />
          <span className="sr-only">Lender link for {company}</span>
          <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-muted outline-none" />
        </label>
        <button type="button" onClick={copy}
          className={cx("relative inline-flex h-11 min-w-[188px] shrink-0 items-center justify-center gap-2 overflow-hidden rounded-control px-5 text-[14px] font-medium transition-[background-color,color,transform] duration-150 active:scale-[0.98]",
            state === "no" ? "bg-rust/15 text-rust" : "bg-jade text-jade-ink hover:bg-jade/90")}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={state} className="inline-flex items-center gap-2" initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={UI_SPRING}>
              {state === "yes" ? <><DrawCheck size={14} />Link copied</> : state === "no" ? "Copy failed: select and copy" : "Share read-only proof"}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[52ch] text-xs leading-[1.5] text-faint">Anyone holding the link can read these amounts, so send it only to your lender. The lender page asks the CostShield server to decrypt with the keys in the link.</p>
        <a href={shareFragment(r.lenderShare)} target="_blank" rel="noreferrer"
          className="inline-flex min-h-10 items-center gap-1.5 text-[13.5px] font-medium text-ink2 underline-offset-4 transition-colors duration-150 hover:text-ink hover:underline">
          Open the lender view<ArrowOut />
        </a>
      </div>
      <span className="sr-only" aria-live="polite">{state === "yes" ? "Link copied" : state === "no" ? "Copy failed" : ""}</span>
    </Card>
  );
}

export { amt };
