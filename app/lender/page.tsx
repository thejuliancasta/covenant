"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DEFAULT_EXPLORER, type LenderShare, type LenderView } from "@/lib/chain/types";
import { monthLabel, ppg } from "@/lib/format";
import { Button, Card, Note, PageHead, Row, Stat, Table, Tag } from "@/components/ui";
import { AddrLink, Encrypted, LockIcon, REGION_LABEL, ShieldMark, decodeShare, periodYm, tusd } from "@/components/chain";

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
  const region = share ? REGION_LABEL[share.region] ?? share.region : "";
  const period = share ? monthLabel(periodYm(share.period), true) : "";

  return (
    <div className="min-h-screen bg-paper">
      <div className="border-b border-amber-line bg-amber-soft px-4 py-1.5 text-center text-[12px] text-amber">
        Simulation. Not an offer of insurance or derivatives. No real premiums, orders or payouts. Devnet test dollars only.
      </div>
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2" aria-label="CostShield home">
            <ShieldMark />
            <span className="font-display text-[22px] leading-none tracking-tight">CostShield</span>
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted"><LockIcon className="text-slate" />Lender view · read-only</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
        {state.kind === "reading" ? <p className="text-[13px] text-muted">Reading the shared link…</p>

          : state.kind === "none" ? (<>
            <PageHead eyebrow="Lender view" title="No coverage share found." lede="This page shows a fleet's diesel cover and payouts to its lender or factoring company. Open the link the fleet shared with you: it ends in # followed by a long code that carries read-only viewing keys." />
            <Card className="max-w-3xl">
              <p className="text-[13px] leading-relaxed text-muted">A fleet creates the link on CostShield&apos;s payout screen after a settlement, under &quot;Share with your lender&quot;. The viewing keys let you read each protection step&apos;s funded amount and whether it paid. They cannot move money.</p>
              <div className="mt-4"><Link href="/" className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-black">Go to CostShield</Link></div>
            </Card>
          </>)

          : state.kind === "bad" ? (<>
            <PageHead eyebrow="Lender view" title="This link cannot be read." lede="Ask the fleet to copy the link again from the payout screen. Links are long, and chat apps sometimes cut them off." />
            <div className="max-w-3xl"><Note tone="warn" title="The shared code is damaged">{state.message}</Note></div>
          </>)

          : (<>
            <PageHead eyebrow={`Lender view · policy ${state.share.policyId}`}
              title={state.kind === "ok" ? <>Diesel cover for {period}: {tusd(state.view.totalPaid, 0)} paid.</> : state.kind === "error" ? <>The diesel cover for {period} could not be checked.</> : <>Checking the diesel cover for {period}.</>}
              lede={<>A fleet shared read-only viewing keys for {state.share.steps.length} protection steps on the {region} diesel index. Amounts are encrypted on Solana devnet. These keys decrypt them; they cannot spend them.</>} />

            {state.kind === "loading" && (
              <Card className="max-w-3xl">
                <p className="flex items-center gap-3 text-[13px] text-muted"><span className="h-5 w-5 shrink-0 animate-pulse rounded-full bg-ink" />Decrypting {state.share.steps.length} step balances on Solana devnet…</p>
              </Card>
            )}

            {state.kind === "error" && (
              <div className="max-w-3xl space-y-3">
                <Note tone="warn" title="The coverage could not be checked">{state.message} Nothing on this page has been verified.</Note>
                <Button variant="secondary" onClick={() => check(state.share)}>Try again</Button>
              </div>
            )}

            {state.kind === "ok" && <Verified share={state.share} view={state.view} />}

            <Card className="mt-6">
              <h2 className="text-[15px] font-medium">What this link can and cannot do</h2>
              <div className="mt-3 grid gap-x-10 gap-y-1.5 text-[13px] md:grid-cols-2">
                <ul className="space-y-1.5">
                  <li className="flex gap-2"><span className="text-shield" aria-hidden>✓</span>Decrypt each step&apos;s private balance: how much was funded and whether it paid.</li>
                  <li className="flex gap-2"><span className="text-shield" aria-hidden>✓</span>Check the public step accounts on Solana Explorer: trigger prices and paid status.</li>
                </ul>
                <ul className="space-y-1.5">
                  <li className="flex gap-2"><span className="text-rust" aria-hidden>✕</span>Spend or move any funds. A viewing key is not a spending key.</li>
                  <li className="flex gap-2"><span className="text-rust" aria-hidden>✕</span>See the fleet&apos;s other balances or transfers.</li>
                </ul>
              </div>
              <p className="mt-4 text-xs text-faint">The keys travel in the part of the link after #, which browsers do not send when loading this page. To decrypt, this page sends them to the CostShield server, which reads the balances on Solana devnet. Anyone with the link can read these amounts. The program cannot check encrypted funding amounts itself; this decryption is that check.</p>
            </Card>
          </>)}
      </main>

      <footer className="border-t border-line px-4 py-6 text-center text-xs text-faint">
        CostShield is a hackathon prototype built for UBC 2026. Price data: U.S. Energy Information Administration. Settlement: Solana devnet with Helius Privacy Rings.
      </footer>
    </div>
  );
}

function Verified({ share, view }: { share: LenderShare; view: LenderView }) {
  const accounts = new Map(share.steps.map((s) => [s.index, s]));
  const backed = view.steps.filter((s) => s.funded > 0 || s.paid).length;
  const checked = new Date(view.checkedAt);
  return (
    <div className="space-y-6 animate-rise">
      <Card className="border-shield-line">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <Stat label="Funded across all steps" value={tusd(view.totalFunded, 0)} sub="decrypted with the shared keys" />
          <Stat label="Paid to the fleet" value={<span className="text-shield">{tusd(view.totalPaid, 0)}</span>} sub={`${view.steps.filter((s) => s.paid).length} of ${view.steps.length} steps released`} />
          <Stat label="Steps funded or paid" value={`${backed} of ${view.steps.length}`} sub={backed < view.steps.length ? `${view.steps.length - backed} with no balance and no payout` : "every step holds funds or has paid"} />
          <Stat label="Checked" value={<span className="text-[22px] sm:text-[24px]">{Number.isNaN(checked.getTime()) ? view.checkedAt : checked.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>} sub={`on Solana devnet · ${REGION_LABEL[view.region] ?? view.region}, ${monthLabel(periodYm(view.period), true)}`} />
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-[15px] font-medium">Protection steps</h2><span className="text-xs text-faint">public on chain: trigger and status · private: amount</span></div>
        <div className="mt-3">
          <Table align={["l", "r", "r", "l", "l"]} head={["Step", "Pays at or above", "Funded", "Status", "Accounts"]} rows={view.steps.map((s) => {
            const acct = accounts.get(s.index);
            return [
              `Step ${s.index}`, ppg(s.triggerPrice),
              <span key="f" className="inline-flex items-center justify-end gap-2">{tusd(s.funded)}<Encrypted label="decrypted" /></span>,
              s.paid ? <Tag key="p" tone="good">paid</Tag> : <Tag key="p">open</Tag>,
              acct ? <span key="a" className="inline-flex flex-wrap gap-x-3"><span>terms <AddrLink addr={acct.account} explorer={DEFAULT_EXPLORER} className="text-[11px]" /></span><span>vault <AddrLink addr={acct.vault} explorer={DEFAULT_EXPLORER} className="text-[11px]" /></span></span> : <span key="a" className="text-faint">not in the link</span>,
            ];
          })} />
        </div>
        <div className="mt-2">
          <Row label="Total funded">{tusd(view.totalFunded)}</Row>
          <Row label="Total paid">{tusd(view.totalPaid)}</Row>
          <Row label="Policy" hint="Solana devnet, tUSD test dollars (1 tUSD = $1)">{view.policyId}</Row>
        </div>
      </Card>

      {view.note && <Note tone="info" title="Note from the server">{view.note}</Note>}
      <p className="text-xs text-faint">Balances read from Solana devnet at {view.checkedAt}.</p>
    </div>
  );
}
