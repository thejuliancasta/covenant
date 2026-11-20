"use client";
import { useEffect, useRef, useState } from "react";
import { STAGES } from "@/lib/engine/pipeline";
import { Button, Card, Eyebrow, Note, Tag, cx } from "./ui";

export interface StageView { status: "running" | "done" | "error"; ms?: number; detail?: string }

export function Welcome({ onStart, onSample }: { onStart: () => void; onSample: () => void }) {
  const steps = [
    ["Connect your books", "Sign in to QuickBooks, Xero, Zoho Books or FreshBooks, or upload a CSV. We read expense lines, vendors and amounts."],
    ["See what moves your costs", "We measure how much of your spending follows a market price, and how hard a bad year would hit your profit."],
    ["Know what can be protected", "For each risk we check whether a real financial instrument tracks it. If nothing does, we say so."],
    ["Watch a payout settle", "Replay a real price shock and see a funded test payout arrive in seconds."],
  ];
  return (
    <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
      <div className="animate-rise pt-4 lg:pt-12">
        <Eyebrow>Cost protection for small businesses</Eyebrow>
        <h1 className="mt-3 font-display text-[44px] leading-[1.02] tracking-tight sm:text-[64px]">Protect your business from rising costs and unexpected economic shocks.</h1>
        <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted">Large companies have treasury teams to hedge fuel, energy and rates. CostShield reads your accounting records, finds the costs a market controls, and shows what protection would pay when prices jump.</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button onClick={onStart} className="px-6 py-3 text-[15px]">Analyze my business</Button>
          <Button onClick={onSample} variant="secondary" className="px-6 py-3 text-[15px]">Explore a sample company</Button>
        </div>
        <p className="mt-4 text-xs text-faint">No account needed. The sample is a synthetic 10-truck fleet built on real diesel prices.</p>
      </div>
      <Card className="animate-rise self-start lg:mt-12" pad={false}>
        <ol>
          {steps.map(([t, d], i) => (
            <li key={t} className="flex gap-4 border-b border-line/70 p-5 last:border-0">
              <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-shield-soft text-[13px] font-semibold text-shield-dark">{i + 1}</span>
              <div><p className="text-[15px] font-medium">{t}</p><p className="mt-1 text-[13px] leading-relaxed text-muted">{d}</p></div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

interface LedgerProvider { id: string; name: string; reads: string; configured: boolean; missing?: string[] }

export function Connect({ onRun, connectError }: { onRun: (csv: string, region: string, label: string) => void; connectError?: string | null }) {
  const [region, setRegion] = useState("PADD2");
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState<string | null>(connectError ?? null);
  const [ledgers, setLedgers] = useState<LedgerProvider[] | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { setErr(connectError ?? null); }, [connectError]);
  useEffect(() => {
    fetch("/api/connect/status").then((r) => r.json()).then((body) => setLedgers(body.providers ?? [])).catch(() => setLedgers([]));
  }, []);

  const connect = (id: string) => {
    if (!consent) return setErr("Confirm you have the right to share this data before connecting.");
    window.location.assign(`/api/connect/${id}?region=${encodeURIComponent(region)}`);
  };

  const take = async (file: File) => {
    setErr(null);
    if (!consent) return setErr("Confirm you have the right to share this data before uploading.");
    if (!/\.(csv|txt)$/i.test(file.name)) return setErr("Upload a .csv file. In QuickBooks: Reports, then Transaction Detail by Account, then Export, then Export to CSV.");
    if (file.size > 4_000_000) return setErr("That file is larger than 4 MB. Export a shorter date range (24 months is plenty).");
    onRun(await file.text(), region, file.name);
  };
  const sample = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/sample/johns-trucking.csv");
      if (!res.ok) throw new Error(`Could not load the sample file (HTTP ${res.status}).`);
      onRun(await res.text(), "PADD2", "Sample company (synthetic)");
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-7 animate-rise">
        <Eyebrow>Step 1</Eyebrow>
        <h1 className="mt-2 font-display text-[40px] leading-tight tracking-tight">Connect your accounting records</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-muted">We need 12 to 24 months of expense transactions. Sign in, or upload an export.</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="flex flex-col">
          <div className="flex items-center justify-between"><p className="text-[15px] font-medium">Sign in to the books</p><Tag tone="info">Read only</Tag></div>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">The owner logs in at their own software and approves access. We pull 24 months of lines and analyze them in this session. The login is not stored.</p>
          <ul className="mt-4 divide-y divide-line/70">
            {(ledgers ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{p.configured ? p.reads : `Set ${(p.missing ?? []).join(" and ") || "the client id and secret"} on the server.`}</p>
                </div>
                <Button variant="secondary" disabled={!p.configured} onClick={() => connect(p.id)} className="shrink-0 px-3 py-2 text-[13px]">{p.configured ? "Connect" : "Needs keys"}</Button>
              </li>
            ))}
            {ledgers === null && <li className="py-3 text-[13px] text-muted">Checking which connections are configured…</li>}
          </ul>
          <p className="mt-2 text-[12px] leading-relaxed text-faint">Each app needs a redirect URL of <span className="text-ink">/api/connect/quickbooks/callback</span>, and the same path with xero, zoho, or freshbooks. QuickBooks Desktop has no cloud sign-in, so use a CSV. Wave does not return historical ledger lines.</p>
        </Card>
        <div className="grid content-start gap-4">
        <Card className={cx("flex flex-col transition-colors", drag && "border-shield bg-shield-soft")}>
          <div className="flex items-center justify-between"><p className="text-[15px] font-medium">Upload an export</p><Tag tone="good">Works now</Tag></div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) take(f); }}
            className="mt-3 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-line px-3 py-6 text-center">
            <p className="text-[13px] text-muted">Drop a CSV here</p>
            <p className="mt-1 text-xs text-faint">QuickBooks, Xero or any export with date, vendor, account and amount columns</p>
          </div>
          <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) take(f); e.target.value = ""; }} />
          <Button onClick={() => input.current?.click()} className="mt-4 w-full">Choose file</Button>
        </Card>
        <Card className="flex flex-col">
          <div className="flex items-center justify-between"><p className="text-[15px] font-medium">Sample company</p><Tag tone="info">Synthetic</Tag></div>
          <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted">John&apos;s Trucking LLC: 10 trucks in the Midwest, 3,315 transactions over 24 months. The ledger is generated, but its fuel prices follow the real EIA Midwest diesel index. It goes through the same importer as an upload.</p>
          <Button variant="secondary" onClick={sample} disabled={busy} className="mt-4 w-full">{busy ? "Loading…" : "Use sample company"}</Button>
        </Card>
        </div>
      </div>
      {err && <div role="alert" className="mt-4 rounded-xl border border-rust-line bg-rust-soft px-4 py-3 text-[13px] text-rust">{err}</div>}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <p className="text-[15px] font-medium">Before you continue</p>
          <label className="mt-3 block text-[13px] text-muted" htmlFor="region">Where do you buy most of your fuel?</label>
          <select id="region" value={region} onChange={(e) => setRegion(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm">
            <option value="PADD2">Midwest (EIA PADD 2)</option>
            <option value="US">Other / U.S. average</option>
          </select>
          <p className="mt-1 text-xs text-faint">Sets the price index your costs are compared with. Two regions are bundled in this prototype.</p>
          <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-[13px] text-ink">
            <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setErr(null); }} className="mt-0.5 h-4 w-4 accent-[#0B5D4B]" />
            <span>These are my company&apos;s records, or I have permission to share them.</span>
          </label>
        </Card>
        <Card>
          <p className="text-[15px] font-medium">What we read and what happens to it</p>
          <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-muted">
            <li><span className="text-ink">Read:</span> transaction date, type, vendor or customer name, account, memo and amount.</li>
            <li><span className="text-ink">Not read:</span> bank passwords, card numbers, or payroll tax forms.</li>
            <li><span className="text-ink">Storage:</span> the sign-in token is discarded after the pull. The lines are analyzed in this session and are not saved to a database.</li>
            <li><span className="text-ink">Sharing:</span> nothing from your file is sent to a market, an insurer or a blockchain.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

export function Analyzing({ stages, error, source, onBack }: { stages: Record<string, StageView>; error: string | null; source: string; onBack: () => void }) {
  const done = STAGES.filter((s) => stages[s.id]?.status === "done").length;
  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6 animate-rise">
        <Eyebrow>{source}</Eyebrow>
        <h1 className="mt-2 font-display text-[40px] leading-tight tracking-tight">{error ? "We could not finish the analysis" : done === STAGES.length ? "Analysis complete" : "Analyzing your records"}</h1>
        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-line"><div className="h-1 rounded-full bg-shield transition-all duration-300" style={{ width: `${(done / STAGES.length) * 100}%` }} /></div>
      </header>
      <Card pad={false}>
        <ol>
          {STAGES.map((s) => {
            const v = stages[s.id];
            return (
              <li key={s.id} className={cx("flex items-start gap-3 border-b border-line/70 px-5 py-3.5 last:border-0", !v && "opacity-45")}>
                <span className={cx("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] text-white", v?.status === "done" ? "bg-shield" : v?.status === "error" ? "bg-rust" : v ? "animate-pulse bg-ink" : "border border-line bg-surface")}>{v?.status === "done" ? "✓" : v?.status === "error" ? "✕" : ""}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{s.label}</p>
                  {v?.detail && <p className={cx("mt-0.5 text-[13px]", v.status === "error" ? "text-rust" : "text-muted")}>{v.detail}</p>}
                </div>
                {v?.ms !== undefined && <span className="num shrink-0 font-mono text-[11px] text-faint">{v.ms < 10 ? v.ms.toFixed(1) : Math.round(v.ms)} ms</span>}
              </li>
            );
          })}
        </ol>
      </Card>
      <p className="mt-3 text-xs text-faint">Each line is a real stage of the server pipeline, with its measured run time and its actual result. The display pauses briefly between stages so the results can be read.</p>
      {error && (
        <div className="mt-5 space-y-3">
          <Note tone="warn" title="What went wrong">{error}</Note>
          <Button onClick={onBack} variant="secondary">Back to import</Button>
        </div>
      )}
    </div>
  );
}
