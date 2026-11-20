"use client";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { STAGES, type Analysis } from "@/lib/engine/pipeline";
import { int, pct } from "@/lib/format";
import { Arrow, Button, Card, CardTitle, Note, Tag, cx, display, surfaceHover } from "./ui";
import { PressureHero } from "./fx/pressure-hero";
import { LogoMark } from "./brand/logo";
import { CountUp, TickText } from "./fx/count";
import { SPRING_FLUID, SPRING_UI, STAGGER } from "./fx/motion";

export interface StageView { status: "running" | "done" | "error"; ms?: number; detail?: string }

/** Settle in place without hiding: used for content that may start below the fold. */
const settle = { hidden: { y: 12 }, show: { y: 0, transition: { duration: 0.4, ease: [0.2, 0.8, 0.2, 1] as const } } };
const rise = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.2, 0.8, 0.2, 1] as const } } };

export function Welcome({ onStart, onSample }: { onStart: () => void; onSample: () => void }) {
  const steps = [
    ["Connect your books", "Sign in to QuickBooks, Xero, Zoho Books or FreshBooks, or upload a CSV. We read expense lines, vendors and amounts."],
    ["See what moves your costs", "We measure how much of your spending follows a market price, and how hard a bad year would hit your profit."],
    ["Know what can be protected", "For each risk we check whether a real financial instrument tracks it. If nothing does, we say so."],
    ["Watch a payout settle", "Replay a real price shock and see a funded test payout arrive in seconds."],
  ];
  return (
    <div>
      <section className="grid items-center gap-10 lg:grid-cols-[0.94fr_1.06fr] lg:gap-12">
        <motion.div initial="hidden" animate="show" transition={{ staggerChildren: STAGGER }} className="max-w-xl">
          <motion.h1 variants={rise} className={cx("text-[34px] leading-[1.04] sm:text-[48px] sm:leading-[1.0]", display)}>
            Protect your business from rising costs and unexpected economic shocks.
          </motion.h1>
          <motion.p variants={rise} className="mt-5 max-w-[52ch] text-[16px] leading-[1.6] text-muted sm:text-[17px]">
            Large companies have treasury teams to hedge fuel, energy and rates. CostShield reads your accounting records, finds the costs a market controls, and shows what protection would pay when prices jump.
          </motion.p>
          <motion.div variants={rise} className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button onClick={onStart} size="lg">Analyze my business<Arrow /></Button>
            <Button onClick={onSample} variant="secondary" size="lg">Explore a sample company</Button>
          </motion.div>
          <motion.p variants={rise} className="mt-4 text-[13px] leading-5 text-faint">No account needed. The sample is a synthetic 10-truck fleet built on real diesel prices.</motion.p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12, ease: [0.2, 0.8, 0.2, 1] }} className="min-w-0">
          <PressureHero />
        </motion.div>
      </section>
      <motion.ol initial="hidden" whileInView="show" viewport={{ once: true, margin: "0px 0px -60px 0px" }} transition={{ staggerChildren: STAGGER }} className="mt-20 grid gap-x-10 gap-y-10 sm:mt-28 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(([t, d], i) => (
          <motion.li key={t} variants={settle}>
            <div>
              <p className="num text-[13px] font-semibold text-jade">{String(i + 1).padStart(2, "0")}</p>
              <p className="mt-3 text-[16px] font-medium leading-6 tracking-[-0.01em] text-ink">{t}</p>
              <p className="mt-2 max-w-[34ch] text-[14px] leading-[1.6] text-muted">{d}</p>
            </div>
          </motion.li>
        ))}
      </motion.ol>
    </div>
  );
}

interface LedgerProvider { id: string; name: string; reads: string; configured: boolean; missing?: string[] }

/** Your books joined to CostShield. Solid when the server holds keys; broken when it does not. */
function LinkGlyph({ ready }: { ready: boolean }) {
  return (
    <span aria-hidden className={cx("inline-flex shrink-0 items-center gap-1 transition-opacity duration-200", ready ? "opacity-100" : "opacity-45")}>
      <svg width="34" height="20" viewBox="0 0 34 20">
        <path d="M2 4.5h9a2 2 0 0 1 2 2v9H4a2 2 0 0 1-2-2v-9Z" fill="none" stroke={ready ? "rgb(var(--ink2) / .6)" : "rgb(var(--faint) / .6)"} strokeWidth="1.2" />
        <path d="M5 8.5h5M5 11.5h3.5" stroke={ready ? "rgb(var(--ink2) / .7)" : "rgb(var(--faint) / .6)"} strokeWidth="1.2" strokeLinecap="round" />
        {ready
          ? <path d="M16 10h16" stroke="rgb(var(--jade))" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="3 2.4" className="transition-[stroke-dashoffset] duration-500 ease-out group-hover:[stroke-dashoffset:-10.8]" />
          : <path d="M16 10h5M27 10h5" stroke="rgb(var(--faint) / .6)" strokeWidth="1.6" strokeLinecap="round" />}
      </svg>
      <LogoMark size={18} />
    </span>
  );
}

function ProviderTile({ p, onConnect }: { p: LedgerProvider; onConnect: () => void }) {
  return (
    <li className={cx("group flex min-w-0 flex-col rounded-[10px] border border-line/[0.08] bg-panel/60 p-4 shadow-[inset_0_1px_0_rgb(255_255_255/0.03)]", p.configured && surfaceHover)}>
      <div className="flex items-center justify-between gap-3">
        <LinkGlyph ready={p.configured} />
        <Tag tone={p.configured ? "good" : "neutral"}>{p.configured ? "Ready" : "Not set up yet"}</Tag>
      </div>
      <p className={cx("mt-3 text-[15px] font-medium leading-6", p.configured ? "text-ink" : "text-ink2")}>{p.name}</p>
      <p className="mt-1 flex-1 text-[12.5px] leading-[1.5] text-muted">
        {p.configured ? p.reads : "Not switched on in this demo. Upload a file or try the sample fleet."}
      </p>
      {p.configured
        ? <Button variant="secondary" size="sm" onClick={onConnect} className="mt-4 self-start">Connect<Arrow /></Button>
        : <p className="mt-4 text-[13px] leading-8 text-faint">Needs keys</p>}
    </li>
  );
}

/** A CSV sheet. On drag-over it lifts off the tray and its rows spread, ready to be read. */
function SheetGlyph({ drag }: { drag: boolean }) {
  return (
    <svg width="72" height="64" viewBox="0 0 72 64" aria-hidden className="mx-auto">
      <motion.rect x="10" y="50" width="52" height="8" rx="4" initial={false}
        animate={{ fill: drag ? "rgb(var(--jade) / .35)" : "rgb(var(--well))", opacity: 1 }} transition={SPRING_UI} />
      <motion.g initial={false} animate={{ y: drag ? -6 : 0, rotate: drag ? -3 : 0 }} transition={SPRING_UI} style={{ originX: 0.5, originY: 1 }}>
        <rect x="18" y="6" width="36" height="42" rx="5" fill="rgb(var(--panel))" stroke={drag ? "rgb(var(--jade) / .8)" : "rgb(var(--line) / .22)"} />
        {[0, 1, 2, 3].map((r) => (
          <motion.g key={r} initial={false} animate={{ y: drag ? r * 1.6 : 0 }} transition={{ ...SPRING_UI, delay: drag ? r * 0.03 : 0 }}>
            <rect x="23" y={13 + r * 7} width="9" height="2.4" rx="1.2" fill="rgb(var(--ink2) / .45)" />
            <rect x="35" y={13 + r * 7} width="14" height="2.4" rx="1.2" fill={drag ? "rgb(var(--jade) / .7)" : "rgb(var(--ink2) / .25)"} />
          </motion.g>
        ))}
      </motion.g>
    </svg>
  );
}

const kb = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);

function Alert({ text }: { text: string | null }) {
  return (
    <AnimatePresence initial={false}>
      {text && (
        <motion.div role="alert" key={text} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }} className="overflow-hidden">
          <div className="mt-4 flex gap-3 text-[13.5px] leading-[1.55] text-rust">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="mt-0.5 shrink-0"><circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" strokeOpacity=".55" strokeWidth="1.2" /><path d="M8 4.6v4.2M8 11.2v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            {text}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Connect({ onRun, connectError }: { onRun: (csv: string, region: string, label: string) => void; connectError?: string | null }) {
  const [region, setRegion] = useState("PADD2");
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState<string | null>(connectError ?? null);
  const [errAt, setErrAt] = useState<"top" | "upload">("top");
  const [ledgers, setLedgers] = useState<LedgerProvider[] | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [chip, setChip] = useState<{ name: string; size: number; ok: boolean } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const shake = useAnimationControls();
  const consentRef = useRef<HTMLLabelElement>(null);
  useEffect(() => { setErr(connectError ?? null); }, [connectError]);
  useEffect(() => {
    fetch("/api/connect/status").then((r) => r.json()).then((body) => setLedgers(body.providers ?? [])).catch(() => setLedgers([]));
  }, []);

  const refuse = (message: string, at: "top" | "upload" = "top") => {
    setErr(message); setErrAt(at);
    const el = consentRef.current, r = el?.getBoundingClientRect();
    if (el && r && at === "top" && /Confirm/.test(message) && (r.top < 64 || r.bottom > window.innerHeight)) {
      el.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
    shake.start({ x: [0, -5, 5, -3, 0], transition: { duration: 0.32 } });
  };
  const connect = (id: string) => {
    if (!consent) return refuse("Confirm you have the right to share this data before connecting.");
    window.location.assign(`/api/connect/${id}?region=${encodeURIComponent(region)}`);
  };

  const take = async (file: File) => {
    setErr(null);
    const reject = (m: string) => { setChip({ name: file.name, size: file.size, ok: false }); refuse(m, "upload"); };
    if (!consent) return reject("Confirm you have the right to share this data before uploading.");
    if (!/\.(csv|txt)$/i.test(file.name)) return reject("Upload a .csv file. In QuickBooks: Reports, then Transaction Detail by Account, then Export, then Export to CSV.");
    if (file.size > 4_000_000) return reject("That file is larger than 4 MB. Export a shorter date range (24 months is plenty).");
    setChip({ name: file.name, size: file.size, ok: true });
    const [text] = await Promise.all([file.text(), new Promise((r) => setTimeout(r, 420))]); // pacing only, so the file chip can be read
    onRun(text, region, file.name);
  };
  const sample = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/sample/johns-trucking.csv");
      if (!res.ok) throw new Error(`Could not load the sample file (HTTP ${res.status}).`);
      onRun(await res.text(), "PADD2", "Sample company (synthetic)");
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setErrAt("top"); setBusy(false); }
  };

  const dragProps = {
    onDragEnter: (e: DragEvent) => { e.preventDefault(); depth.current++; setDrag(true); },
    onDragOver: (e: DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; },
    onDragLeave: () => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setDrag(false); },
    onDrop: (e: DragEvent) => { e.preventDefault(); depth.current = 0; setDrag(false); const f = e.dataTransfer.files[0]; if (f) take(f); },
  };

  return (
    <div className="mx-auto max-w-5xl">
      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }} className="mb-8">
        <h1 className={cx("text-[28px] leading-[1.1] sm:text-[34px] sm:leading-[1.08]", display)}>Connect your books</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-[1.6] text-muted sm:text-base">We only read your books and never change them. Uploaded files aren't stored.</p>
      </motion.header>

      <Card className="mb-4">
        <div className="grid gap-5 md:grid-cols-[0.9fr_1.1fr] md:items-end md:gap-8">
          <div>
            <CardTitle>Before you continue</CardTitle>
            <label className="mt-3 block text-[13px] leading-5 text-muted" htmlFor="region">Where do you buy most of your fuel?</label>
            <div className="relative mt-1.5">
              <select id="region" value={region} onChange={(e) => setRegion(e.target.value)}
                className="min-h-10 w-full cursor-pointer appearance-none rounded-control border border-line/[.14] bg-well py-2.5 pl-3.5 pr-10 text-sm text-ink transition-[border-color] duration-150 hover:border-line/25">
                <option value="PADD2">Midwest (EIA PADD 2)</option>
                <option value="US">Other / U.S. average</option>
              </select>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"><path d="m4.5 6.5 3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <p className="mt-1.5 text-[12px] leading-[1.45] text-faint">Sets the price index your costs are compared with. Two regions are bundled in this prototype.</p>
          </div>
          <motion.label ref={consentRef} animate={shake} className={cx("flex min-h-11 cursor-pointer items-start gap-3 py-2 text-[14px] leading-5 transition-[color] duration-150",
            consent ? "text-ink" : err && /Confirm/.test(err) ? "text-rust" : "text-ink2 hover:text-ink")}>
            <span className="relative mt-px h-5 w-5 shrink-0">
              <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setErr(null); }}
                className="peer absolute inset-0 h-5 w-5 cursor-pointer appearance-none rounded-[6px] border border-line/30 bg-well transition-[background-color,border-color] duration-150 checked:border-jade checked:bg-jade" />
              <svg viewBox="0 0 20 20" className="pointer-events-none absolute inset-0 h-5 w-5" aria-hidden>
                <motion.path d="m5.5 10.4 3 3 6-6.6" fill="none" stroke="rgb(var(--jade-ink))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  initial={false} animate={{ pathLength: consent ? 1 : 0, opacity: consent ? 1 : 0 }} transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }} />
              </svg>
            </span>
            <span>These are my company&apos;s records, or I have permission to share them.</span>
          </motion.label>
        </div>
        <Alert text={errAt === "top" ? err : null} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="flex flex-col">
          <div className="flex items-center justify-between gap-3"><CardTitle>Connect your accounting software</CardTitle><Tag tone="info">We only read</Tag></div>
          <p className="mt-2 text-[13.5px] leading-[1.55] text-muted">The owner logs in at their own software and approves access. We pull 24 months of lines and analyze them in this session. The login is not stored.</p>
          {ledgers === null
            ? <p className="mt-5 text-[13px] text-muted">Checking which connections are configured…</p>
            : <motion.ul initial="hidden" animate="show" transition={{ staggerChildren: 0.06 }} className="mt-4 grid gap-3 sm:grid-cols-2">
                {ledgers.map((p) => <motion.div key={p.id} variants={rise} className="flex"><ProviderTile p={p} onConnect={() => connect(p.id)} /></motion.div>)}
              </motion.ul>}
          
        </Card>

        <div className="grid content-start gap-4">
          <Card className="flex flex-col">
            <div className="flex items-center justify-between gap-3"><CardTitle>Upload a CSV export</CardTitle></div>
            <div {...dragProps} onClick={() => input.current?.click()}
              className={cx("group mt-3 cursor-pointer rounded-[10px] border border-dashed px-4 pb-5 pt-5 text-center transition-[border-color,background-color] duration-150 ease-out", drag ? "border-jade/60 bg-jade/[0.04]" : "border-line/[0.12] bg-bg/40 hover:border-line/[0.2]")}>
              <SheetGlyph drag={drag} />
              <p className={cx("mt-2 text-[13.5px] font-medium transition-colors duration-150", drag ? "text-jade" : "text-ink2")}>{drag ? "Release to upload" : "Drop a CSV here"}</p>
              <p className="mx-auto mt-1 max-w-[34ch] text-[12px] leading-[1.45] text-faint">QuickBooks, Xero or any export with date, vendor, account and amount columns</p>
            </div>
            <AnimatePresence initial={false}>
              {chip && (
                <motion.div key={chip.name + chip.size} initial={{ opacity: 0, x: -14, height: 0, marginTop: 0 }} animate={{ opacity: 1, x: 0, height: "auto", marginTop: 12 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} transition={SPRING_UI}>
                  <div className="flex items-center gap-3 rounded-[8px] border border-line/[0.08] bg-panel/60 px-3 py-2">
                    <svg width="16" height="18" viewBox="0 0 16 18" aria-hidden className={chip.ok ? "text-jade" : "text-rust"}><path d="M3 1.5h6.5L13.5 5.5V16a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5Z M9.5 1.5V5.5h4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{chip.name}</span>
                    <span className="num shrink-0 text-[12px] text-faint">{kb(chip.size)}</span>
                    <Tag tone={chip.ok ? "good" : "bad"}>{chip.ok ? "Reading" : "Not read"}</Tag>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <Alert text={errAt === "upload" ? err : null} />
            <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) take(f); e.target.value = ""; }} />
            <Button onClick={() => input.current?.click()} className="mt-4 w-full">Choose file</Button>
          </Card>
          <Card className="flex flex-col">
            <div className="flex items-center justify-between gap-3"><CardTitle>Try a sample fleet</CardTitle><Tag tone="info">Synthetic data</Tag></div>
            <p className="mt-2 text-[13.5px] leading-[1.55] text-muted">John&apos;s Trucking LLC: 10 trucks in the Midwest, 3,315 transactions over 24 months. The ledger is generated, but its fuel prices follow the real EIA Midwest diesel index. It goes through the same importer as an upload.</p>
            <Button variant="secondary" onClick={sample} disabled={busy} className="mt-4 self-start">{busy ? "Loading…" : <>Try the sample fleet<Arrow /></>}</Button>
          </Card>
        </div>
      </div>


      <Card className="mt-4">
        <CardTitle>What we read and what happens to it</CardTitle>
        <dl className="mt-4 grid gap-x-10 gap-y-4 text-[13.5px] leading-[1.55] sm:grid-cols-2">
          {([
            ["Read", "transaction date, type, vendor or customer name, account, memo and amount."],
            ["Not read", "bank passwords, card numbers, or payroll tax forms."],
            ["Storage", "the sign-in token is discarded after the pull. The lines are analyzed in this session and are not saved to a database."],
            ["Sharing", "nothing from your file is sent to a market, an insurer or a blockchain."],
          ] as const).map(([k, v]) => (
            <div key={k}><dt className="font-medium text-ink">{k}</dt><dd className="mt-0.5 text-muted">{v.charAt(0).toUpperCase() + v.slice(1)}</dd></div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

const MARKET = new Set(["fleet_fuel", "natural_gas", "electricity", "interest"]);

/** Lanes of real classified lines, from the analysis result: expense lines by category plus income lines. */
function useLanes(result: Analysis | null | undefined) {
  return useMemo(() => {
    if (!result) return null;
    const by = new Map<string, { label: string; lines: number; market: boolean }>();
    for (const v of result.vendors) {
      const g = by.get(v.category) ?? { label: v.label, lines: 0, market: MARKET.has(v.category) };
      g.lines += v.lines; by.set(v.category, g);
    }
    const expense = [...by.values()].reduce((s, g) => s + g.lines, 0);
    const total = result.lineCount;
    const all = [...by.entries()].map(([k, g]) => ({ key: k, ...g })).sort((a, b) => b.lines - a.lines);
    const big = all.filter((g) => g.lines / total >= 0.025), rest = all.filter((g) => g.lines / total < 0.025);
    const lanes = [...big];
    if (rest.length) lanes.push({ key: "rest", label: `${rest.length} smaller categories`, lines: rest.reduce((s, g) => s + g.lines, 0), market: false });
    if (total - expense > 0) lanes.push({ key: "income", label: "Income lines", lines: total - expense, market: false });
    return { lanes, total };
  }, [result]);
}

function StatusMark({ v }: { v?: StageView }) {
  const s = v?.status;
  return (
    <svg viewBox="0 0 20 20" className="mt-[1px] h-5 w-5 shrink-0" aria-hidden>
      {!s && <path d="M6.5 10h7" stroke="rgb(var(--faint) / .5)" strokeWidth="1.6" strokeLinecap="round" />}
      {s === "running" && <circle cx="10" cy="10" r="2.6" fill="rgb(var(--ink2) / .8)" />}
      {s === "done" && <motion.path d="m4.5 10.4 3.6 3.5 7.4-8" fill="none" stroke="rgb(var(--jade))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }} />}
      {s === "error" && <path d="m5.5 5.5 9 9M14.5 5.5l-9 9" stroke="rgb(var(--rust))" strokeWidth="2" strokeLinecap="round" />}
    </svg>
  );
}

/** Product wording for each pipeline stage; the server's own wording stays in the docs. */
const STEP_LABEL: Record<string, string> = {
  classify: "Sorting costs", financials: "Measuring where the money goes", exposure: "Matching prices you don't control",
  pool: "Comparing with similar businesses", markets: "Checking live markets", price: "Pricing protection",
};
const PLAIN_DETAIL = new Set(["ingest", "classify", "financials"]);
function stepLabel(id: string, v: StageView | undefined, read: number) {
  if (id === "ingest") return Number.isFinite(read) ? `Reading ${read.toLocaleString("en-US")} transactions` : "Reading transactions";
  return STEP_LABEL[id] ?? id;
}

export function Analyzing({ stages, error, source, onBack, result }: { stages: Record<string, StageView>; error: string | null; source: string; onBack: () => void; result?: Analysis | null }) {
  const done = STAGES.filter((s) => stages[s.id]?.status === "done").length;
  const lanes = useLanes(result);
  const read = stages.ingest?.status === "done" ? Number((stages.ingest.detail ?? "").match(/^([\d,]+)/)?.[1]?.replace(/,/g, "")) : NaN;
  return (
    <div className="mx-auto max-w-3xl">
      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }} className="mb-6">
        <h1 className={cx("text-[28px] leading-[1.1] sm:text-[34px] sm:leading-[1.08]", display)}>{error ? "We could not read this file" : done === STAGES.length ? "Your books are read" : "Reading your books"}</h1>
        <p className="mt-3 text-[14px] leading-5 text-muted">{source}</p>
        <div className="mt-5 flex gap-1" role="progressbar" aria-label="Pipeline stages finished" aria-valuemin={0} aria-valuemax={STAGES.length} aria-valuenow={done}>
          {STAGES.map((s) => {
            const st = stages[s.id]?.status;
            return (
              <span key={s.id} className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-line/10">
                <motion.span className={cx("absolute inset-y-0 left-0 rounded-full", st === "error" ? "bg-rust" : st === "running" ? "bg-ink2/35" : "bg-jade")}
                  initial={false} animate={{ width: st === "done" || st === "error" ? "100%" : st === "running" ? "35%" : "0%" }} transition={SPRING_UI} />
              </span>
            );
          })}
        </div>
      </motion.header>

      <Card>
        <ol className="grid gap-2">
          {STAGES.map((s) => {
            const v = stages[s.id];
            return (
              <li key={s.id} className="grid grid-cols-[20px_1fr_auto] items-start gap-3 py-2.5">
                <StatusMark v={v} />
                <div className="min-w-0">
                  <p className={cx("text-[14px] font-medium leading-5 transition-colors duration-200", v ? "text-ink" : "text-faint")}>{stepLabel(s.id, v, read)}</p>
                  <AnimatePresence initial={false}>
                    {v?.detail && (v.status === "error" || PLAIN_DETAIL.has(s.id)) && (
                      <motion.p key={v.status} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_UI}
                        className={cx("num mt-1 text-[13px] leading-[1.5]", v.status === "error" ? "text-rust" : "text-muted")}>
                        {v.status === "error" ? v.detail : <TickText text={v.detail} />}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                <span className="num min-w-[64px] pt-px text-right text-[12px] leading-5 text-faint">
                  {v?.ms !== undefined ? <><CountUp value={v.ms} duration={0.5} format={(x) => (v.ms! < 10 ? x.toFixed(1) : String(Math.round(x)))} /> ms</> : v?.status === "running" ? "Running" : ""}
                </span>
              </li>
            );
          })}
        </ol>
      </Card>

      {(Number.isFinite(read) || lanes) && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_UI} className="mt-4">
          <Card>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-[14px] font-medium text-ink">{lanes ? "Every line, sorted by category" : "Lines read"}</p>
              <p className="num text-[13px] text-muted"><CountUp value={lanes ? lanes.total : read} /> lines</p>
            </div>
            <div className="mt-3 flex h-10 w-full gap-[3px] overflow-hidden rounded-control" aria-hidden>
              {lanes
                ? lanes.lanes.map((l, i) => (
                    <motion.span key={l.key} className="h-full min-w-[3px] rounded-[4px]"
                      initial={{ width: `${100 / lanes.lanes.length}%`, backgroundColor: "rgb(var(--ink2) / 0.16)" }}
                      animate={{ width: `${(l.lines / lanes.total) * 100}%`, backgroundColor: l.market ? "rgb(var(--heat) / 0.7)" : `rgb(var(--ink2) / ${Math.max(0.12, 0.42 - i * 0.05)})` }}
                      transition={{ ...SPRING_FLUID, delay: i * 0.05 }} />
                  ))
                : <motion.span className="h-full w-full rounded-[4px]" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={SPRING_FLUID} style={{ originX: 0, background: "repeating-linear-gradient(90deg, rgb(var(--ink2) / .22) 0 1px, transparent 1px 4px)" }} />}
            </div>
            {lanes && (
              <motion.ul initial="hidden" animate="show" transition={{ staggerChildren: 0.05, delayChildren: 0.25 }} className="mt-4 grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
                {lanes.lanes.map((l) => (
                  <motion.li key={l.key} variants={rise} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2"><i className={cx("h-2.5 w-2.5 shrink-0 rounded-[3px]", l.market ? "bg-heat/70" : "bg-ink2/30")} /><span className="truncate text-ink2">{l.label}</span></span>
                    <span className="num shrink-0 text-muted">{int(l.lines)} <span className="text-faint">{pct(l.lines / lanes.total)}</span></span>
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </Card>
        </motion.section>
      )}

      <p className="mt-3 text-[12px] leading-[1.55] text-faint">Each step is real work on your file, shown with how long it took.</p>
      {error && (
        <div className="mt-5 space-y-3">
          <Note tone="warn" title="What went wrong">{error}</Note>
          <Button onClick={onBack} variant="secondary">Back to import</Button>
        </div>
      )}
    </div>
  );
}
