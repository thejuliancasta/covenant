"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { MotionConfig, motion } from "motion/react";
import { DEFAULT_EXPLORER, type LenderShare, type LenderView } from "@/lib/chain/types";
import { monthLabel, ppg } from "@/lib/format";
import { Button, CardTitle, Note, PageHead, Row, Stat, Tag, cx } from "@/components/ui";
import { Panel as Card } from "@/components/settle/surface";
import { AddrLink, Encrypted, LockIcon, REGION_LABEL, decodeShare, periodYm, tusd } from "@/components/chain";
import { CipherGlyphs, DecodeText } from "@/components/settle/cipher";
import { useCountUp } from "@/components/settle/rolling";
import { DrawCheck } from "@/components/settle/tx";
import { Logo } from "@/components/brand/logo";
import { STAGGER } from "@/components/settle/motion";

type State =
  | { kind: "reading" }
  | { kind: "none" }
  | { kind: "bad"; message: string }
  | { kind: "loading"; share: LenderShare }
  | { kind: "error"; share: LenderShare; message: string }
  | { kind: "ok"; share: LenderShare; view: LenderView };

const isView = (v: unknown): v is LenderView => {
  const x = v as Partial<LenderView>;
  return !!x && Array.isArray(x.steps) && typeof x.totalFunded === "number" && typeof x.totalPaid === "number";
};

export default function LenderPage() {
  const [state, setState] = useState<State>({ kind: "reading" });

  const check = useCallback(async (share: LenderShare) => {
    setState({ kind: "loading", share });
    try {
      const res = await fetch("/api/lender", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(share), cache: "no-store" });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error ?? (res.status === 404 ? "This server has no lender endpoint, so it cannot decrypt the shared steps." : `The server could not read the shared steps (HTTP ${res.status}).`));
      if (!isView(j)) throw new Error("The server answered, but not with a coverage view.");
      setState({ kind: "ok", share, view: j });
    } catch (e) {
      setState({ kind: "error", share, message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(() => {
    const read = () => {
      const frag = window.location.hash.replace(/^#/, "").trim();
      if (!frag) { setState({ kind: "none" }); return; }
      let share: LenderShare;
      try { share = decodeShare(frag); } catch (e) { setState({ kind: "bad", message: e instanceof Error ? e.message : String(e) }); return; }
      check(share);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [check]);

  const share = "share" in state ? state.share : null;
  // The region in plain words: "Midwest (PADD 2)" becomes "Midwest".
  const region = share ? (REGION_LABEL[share.region] ?? share.region).replace(/\s*\(PADD \d+\)/, "") : "";
  const period = share ? monthLabel(periodYm(share.period), true) : "";

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-bg">
        <p className="flex items-center justify-center gap-2 bg-sunken px-4 py-2 text-center text-[12px] leading-4 text-muted">
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="hidden shrink-0 text-heat sm:block"><path d="M5 1.2 9 8.6H1L5 1.2Z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" /><path d="M5 4.2v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
          Simulation. Not an offer of insurance or derivatives. No real premiums, orders or payouts. Devnet test dollars only.
        </p>
        <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md backdrop-saturate-150">
          <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-[var(--page-gutter)]">
            <Link href="/" className="-ml-2 flex min-h-10 items-center gap-2.5 rounded-control px-2 transition-transform duration-150 ease-out active:scale-[0.98]" aria-label="CostShield home">
              <Logo />
            </Link>
            <span className="inline-flex items-center gap-2 whitespace-nowrap text-[13px] font-medium text-cipher">
              <LockIcon />Payout proof, read-only
            </span>
          </div>
        </header>

        <main className="mx-auto max-w-[1200px] px-[var(--page-gutter)] pb-24 pt-8 sm:pt-12">
          {state.kind === "reading" ? <p className="text-[13px] text-muted">Reading the shared link…</p>

            : state.kind === "none" ? (<>
              <PageHead eyebrow="Payout proof" title="No payout proof found." lede="This page lets a lender or factoring company check a business's diesel protection: how much money was locked on Solana to pay it, and what was paid. Open the link the business shared with you: it ends in # followed by a long code that carries read-only viewing keys." />
              <Card className="max-w-3xl">
                <p className="max-w-[70ch] text-[13.5px] leading-[1.6] text-muted">A business creates the link on CostShield&apos;s Payouts screen after a settlement, under &quot;Proof for your lender&quot;. The amounts on Solana are encrypted with Helius Privacy Rings; the viewing keys let you read how much was set aside for each step and whether it paid. They cannot move money.</p>
                <div className="mt-5">
                  <Link href="/" className="group/btn inline-flex min-h-10 items-center justify-center gap-2 rounded-control bg-jade px-[18px] py-2.5 text-sm font-medium text-jade-ink transition-[background-color,transform] duration-150 ease-out hover:bg-jade/90 active:scale-[0.98]">
                    Go to CostShield
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="-mr-0.5 transition-transform duration-150 ease-out group-hover/btn:translate-x-0.5"><path d="M3 8h9.2M8.6 4.2 12.4 8l-3.8 3.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </Link>
                </div>
              </Card>
            </>)

            : state.kind === "bad" ? (<>
              <PageHead eyebrow="Payout proof" title="This link cannot be read." lede="Ask the business to copy the link again from the Payouts screen. Links are long, and chat apps sometimes cut them off." />
              <div className="max-w-3xl"><Note tone="warn" title="The shared code is damaged">{state.message}</Note></div>
            </>)

            : (<>
              <PageHead eyebrow={`Read-only, policy ${state.share.policyId}`}
                title={state.kind === "ok" ? <>Payout proof: <span className="num">{tusd(state.view.totalPaid, 0)}</span> paid for {period}</> : state.kind === "error" ? <>This payout proof could not be checked.</> : <>Payout proof for {period}</>}
                lede={<>A business protected its diesel bill with CostShield. A backer locked money for {state.share.steps.length} steps in vaults on Solana devnet that only the program can open; each step pays the business when the official {region} diesel price is above its line. The amounts are encrypted with Helius Privacy Rings, hidden from the public. This link&apos;s read-only viewing keys let you read them. They cannot move money.</>} />

              {state.kind === "loading" && <Pending share={state.share} />}

              {state.kind === "error" && (
                <div className="max-w-3xl space-y-3">
                  <Note tone="warn" title="The coverage could not be checked">{state.message} Nothing on this page has been verified.</Note>
                  <Button variant="secondary" onClick={() => check(state.share)}>Try again</Button>
                </div>
              )}

              {state.kind === "ok" && <Verified share={state.share} view={state.view} />}

              <Card className="mt-6">
                <CardTitle>What this link can and cannot do</CardTitle>
                <div className="mt-4 grid gap-x-10 gap-y-2.5 text-[13.5px] leading-[1.55] md:grid-cols-2">
                  <ul className="space-y-2.5">
                    <li className="flex gap-2.5 text-ink2"><Mark ok />Read each step&apos;s encrypted balance: how much was set aside and whether it paid.</li>
                    <li className="flex gap-2.5 text-ink2"><Mark ok />Check the public step accounts on Solana Explorer: the price each step pays at, and whether it paid.</li>
                  </ul>
                  <ul className="space-y-2.5">
                    <li className="flex gap-2.5 text-ink2"><Mark />Spend or move any funds. A viewing key is not a spending key.</li>
                    <li className="flex gap-2.5 text-ink2"><Mark />See the business&apos;s other balances or transfers.</li>
                  </ul>
                </div>
                <p className="mt-5 max-w-[90ch] text-[12px] leading-[1.6] text-faint">The keys travel in the part of the link after #, which browsers do not send when loading this page. To decrypt, this page sends them to the CostShield server, which reads the balances on Solana devnet. Anyone with the link can read these amounts. The program cannot check encrypted funding amounts itself; this decryption is that check.</p>
              </Card>
            </>)}
        </main>

        <footer className="mx-auto max-w-[1200px] px-[var(--page-gutter)] pb-10 text-center text-[12px] leading-[1.6] text-faint">
          <p className="mx-auto max-w-[80ch]">Price data: U.S. Energy Information Administration. Settlement: Solana devnet with Helius Privacy Rings.</p>
        </footer>
      </div>
    </MotionConfig>
  );
}

function Mark({ ok }: { ok?: boolean }) {
  return ok
    ? <svg width="16" height="16" viewBox="0 0 16 16" aria-label="Can" role="img" className="mt-[2px] shrink-0 text-jade"><path d="m3.5 8.3 2.9 2.8 6-6.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
    : <svg width="16" height="16" viewBox="0 0 16 16" aria-label="Cannot" role="img" className="mt-[2px] shrink-0 text-rust"><path d="m4.5 4.5 7 7m0-7-7 7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}

/** One protection step as a plate. On narrow screens each cell carries its own label. */
const PLATE_GRID = "sm:grid-cols-[84px_minmax(0,1fr)_minmax(0,1.5fr)_96px_minmax(0,1.7fr)] sm:items-center";

function PlateHead() {
  return (
    <div aria-hidden className={cx("hidden gap-4 px-4 pb-2 text-[12px] text-faint sm:grid", PLATE_GRID)}>
      <span>Step</span><span className="text-right">Pays when price ≥</span><span className="text-right">Set aside in advance</span><span>Status</span><span>Accounts</span>
    </div>
  );
}

function Cell({ label, children, className, bare }: { label: string; children: ReactNode; className?: string; bare?: boolean }) {
  return (
    <div className={cx("flex min-w-0 items-center justify-between gap-3 sm:block", className)}>
      <span className={cx("text-[12px] text-faint", bare ? "sr-only" : "sm:sr-only")}>{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Accounts({ acct }: { acct?: { account: string; vault: string } }) {
  if (!acct) return <span className="text-faint">not in the link</span>;
  return (
    <span className="inline-flex flex-wrap justify-end gap-x-3 gap-y-1 text-[12px] text-muted sm:justify-start">
      <span className="inline-flex items-center gap-1.5">terms <AddrLink addr={acct.account} explorer={DEFAULT_EXPLORER} className="text-[11.5px]" /></span>
      <span className="inline-flex items-center gap-1.5">vault <AddrLink addr={acct.vault} explorer={DEFAULT_EXPLORER} className="text-[11.5px]" /></span>
    </span>
  );
}

/** Real pending state: the request is out; amounts are still cipher. No progress is invented. */
function Pending({ share }: { share: LenderShare }) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>Protection steps</CardTitle>
        <p className="flex items-center gap-2.5 text-[13px] text-muted" role="status">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0 animate-spin text-cipher [animation-duration:1.1s]"><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity=".22" strokeWidth="1.6" /><path d="M14 8a6 6 0 0 0-6-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          Decrypting {share.steps.length} step balances on Solana devnet…
        </p>
      </div>
      <div className="mt-4"><PlateHead /></div>
      <ul className="space-y-2">
        {share.steps.map((s) => (
          <li key={s.index} className={cx("grid gap-2 py-3.5 sm:gap-4 sm:px-4", PLATE_GRID)}>
            <Cell label="Step" bare><span className="num text-[13.5px] font-medium text-ink">Step {s.index}</span></Cell>
            <Cell label="Pays when price ≥" className="sm:text-right"><span className="text-[13px] text-faint">reading…</span></Cell>
            <Cell label="Set aside in advance" className="sm:text-right"><CipherGlyphs length={8} seed={`${share.policyId}-${s.index}`} className="text-[15px]" label="Encrypted, not yet decrypted" /></Cell>
            <Cell label="Status"><span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-cipher"><LockIcon />encrypted</span></Cell>
            <Cell label="Accounts"><Accounts acct={s} /></Cell>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DelayedDecode({ text, delay, seed, className }: { text: string; delay: number; seed: string; className?: string }) {
  const [play, setPlay] = useState(false);
  useEffect(() => { const t = setTimeout(() => setPlay(true), delay); return () => clearTimeout(t); }, [delay]);
  return <DecodeText text={text} play={play} seed={seed} className={className} />;
}

function Verified({ share, view }: { share: LenderShare; view: LenderView }) {
  const accounts = new Map(share.steps.map((s) => [s.index, s]));
  const backed = view.steps.filter((s) => s.funded > 0 || s.paid).length;
  const checked = new Date(view.checkedAt);
  const funded = useCountUp(view.totalFunded, true);
  const paid = useCountUp(view.totalPaid, true);
  const decodeEnd = view.steps.length * STAGGER * 1000;
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}>
        <Card>
          <div className="grid grid-cols-2 gap-x-5 gap-y-6 md:grid-cols-4">
            <Stat label="Set aside in advance" value={tusd(funded, 0)} sub="read with the shared keys" />
            <Stat label="Paid to the business" value={<span className="text-jade">{tusd(paid, 0)}</span>} sub={`${view.steps.filter((s) => s.paid).length} of ${view.steps.length} steps released`} />
            <Stat label="Steps set aside or paid" value={`${backed} of ${view.steps.length}`} sub={backed < view.steps.length ? `${view.steps.length - backed} with no balance and no payout` : "every step holds funds or has paid"} />
            <Stat label="Checked" value={<span className="text-[22px] sm:text-[24px]">{Number.isNaN(checked.getTime()) ? view.checkedAt : checked.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>} sub={`on Solana devnet · ${(REGION_LABEL[view.region] ?? view.region).replace(/\s*\(PADD \d+\)/, "")}, ${monthLabel(periodYm(view.period), true)}`} />
          </div>
        </Card>
      </motion.div>

      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle>Protection steps</CardTitle>
          <span className="text-[12px] text-faint">public on Solana: the price each step pays at, and whether it paid · encrypted: the amount</span>
        </div>
        <div className="mt-4"><PlateHead /></div>
        <ul className="space-y-2">
          {view.steps.map((s, i) => {
            const acct = accounts.get(s.index);
            return (
              <motion.li key={s.index} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: i * STAGGER, ease: [0.2, 0.8, 0.2, 1] }}
                className={cx("grid gap-2 py-3.5 sm:gap-4 sm:px-4", PLATE_GRID)}>
                <Cell label="Step" bare><span className="num text-[13.5px] font-medium text-ink">Step {s.index}</span></Cell>
                <Cell label="Pays when price ≥" className="sm:text-right"><span className="num text-[13.5px] text-ink2">{ppg(s.triggerPrice)}</span></Cell>
                <Cell label="Set aside in advance" className="sm:text-right">
                  <span className="inline-flex items-center gap-2 sm:justify-end">
                    <DelayedDecode text={tusd(s.funded)} delay={i * STAGGER * 1000} seed={`${share.policyId}-${s.index}`} className="text-[13.5px] font-medium text-ink" />
                    <Encrypted label="decrypted" className="sm:hidden lg:inline-flex" />
                  </span>
                </Cell>
                <Cell label="Status">{s.paid ? <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink2"><DrawCheck size={12} className="text-muted" />paid</span> : <span className="text-[13px] text-muted">open</span>}</Cell>
                <Cell label="Accounts"><Accounts acct={acct} /></Cell>
              </motion.li>
            );
          })}
        </ul>
        <p className="mt-3 hidden items-center gap-1.5 text-[12px] text-faint sm:flex lg:hidden"><LockIcon className="text-cipher" />Funded amounts are encrypted on chain and were decrypted with the shared keys.</p>
        <div className="mt-4">
          <Row label="Total funded">{tusd(view.totalFunded)}</Row>
          <Row label="Total paid"><span className="text-jade">{tusd(view.totalPaid)}</span></Row>
          <Row label="Policy" hint="Solana devnet, test dollars (1 test dollar = $1)"><span className="font-mono text-[12.5px]">{view.policyId}</span></Row>
        </div>
      </Card>

      {view.note && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, delay: decodeEnd / 1000 }}><Note tone="info" title="Note from the server">{view.note}</Note></motion.div>}
      <p className="text-[12px] text-faint">Balances read from Solana devnet at <span className="num">{view.checkedAt}</span>.</p>
    </div>
  );
}
