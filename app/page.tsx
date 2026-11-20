"use client";
import { useCallback, useState } from "react";
import type { Analysis, PipelineEvent, StageId } from "@/lib/engine/pipeline";
import { readNdjson } from "@/lib/format";
import { cx } from "@/components/ui";
import { Welcome, Connect, Analyzing, type StageView } from "@/components/onboarding";
import { Overview, Protection } from "@/components/results";
import { Simulator, Payout } from "@/components/simulate";
import { Judge } from "@/components/judge";

type Step = "welcome" | "connect" | "analyzing" | "overview" | "protection" | "simulate" | "payout";
const NAV: { id: Step; label: string }[] = [
  { id: "connect", label: "Connect" }, { id: "overview", label: "Your risks" }, { id: "protection", label: "Protection" },
  { id: "simulate", label: "Simulate" }, { id: "payout", label: "Payout" },
];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Home() {
  const [step, setStep] = useState<Step>("welcome");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [stages, setStages] = useState<Record<string, StageView>>({});
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [judge, setJudge] = useState(false);

  const go = useCallback((s: Step) => { setStep(s); setJudge(false); window.scrollTo({ top: 0 }); }, []);

  const run = useCallback(async (csv: string, region: string, label: string) => {
    setError(null); setStages({}); setAnalysis(null); setSource(label); go("analyzing");
    try {
      const res = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ csv, region }) });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? `Analysis failed (HTTP ${res.status}).`);
      let result: Analysis | null = null, failed: string | null = null;
      await readNdjson<PipelineEvent>(res, async (ev) => {
        if (ev.type === "stage") {
          setStages((s) => ({ ...s, [ev.id as StageId]: { status: ev.status, ms: ev.ms, detail: ev.detail } }));
          if (ev.status !== "running") await sleep(380); // pacing only, so each real stage result can be read
        } else if (ev.type === "result") result = ev.analysis;
        else failed = ev.message;
      });
      if (failed) throw new Error(failed);
      if (!result) throw new Error("The analysis ended without a result.");
      setAnalysis(result);
      await sleep(500);
      go("overview");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [go]);

  const hasResult = !!analysis;
  return (
    <div className="min-h-screen bg-paper">
      <div className="border-b border-amber-line bg-amber-soft px-4 py-1.5 text-center text-[12px] text-amber">
        Simulation. Not an offer of insurance or derivatives. No real premiums, orders or payouts. Devnet test dollars only.
      </div>
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <button onClick={() => go("welcome")} className="flex items-center gap-2" aria-label="CostShield home">
            <svg width="22" height="24" viewBox="0 0 22 24" aria-hidden><path d="M11 1 2 4.5v6.8c0 5.3 3.6 9.6 9 11.7 5.4-2.1 9-6.4 9-11.7V4.5L11 1Z" fill="#0B5D4B" /><path d="M6.5 13.5 9.6 10l2.6 2.2L15.8 8" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="font-display text-[22px] leading-none tracking-tight">CostShield</span>
          </button>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Steps">
            {NAV.map((n, i) => {
              const enabled = n.id === "connect" || hasResult, active = step === n.id || (n.id === "connect" && step === "analyzing");
              return (
                <button key={n.id} disabled={!enabled} onClick={() => go(n.id)} className={cx("flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] transition-colors", active && !judge ? "bg-ink text-white" : enabled ? "text-muted hover:text-ink" : "cursor-not-allowed text-faint/60")}>
                  <span className={cx("num text-[11px]", active && !judge ? "text-white/60" : "text-faint")}>{i + 1}</span>{n.label}
                </button>
              );
            })}
          </nav>
          <button disabled={!hasResult} onClick={() => { setJudge((j) => !j); window.scrollTo({ top: 0 }); }} className={cx("rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors", judge ? "border-ink bg-ink text-white" : hasResult ? "border-line text-muted hover:border-ink/40 hover:text-ink" : "cursor-not-allowed border-line text-faint/60")} title={hasResult ? "Technical view for judges" : "Run an analysis first"}>
            Judge mode
          </button>
        </div>
        {hasResult && (
          <nav className="flex gap-1 overflow-x-auto border-t border-line px-3 py-1.5 md:hidden" aria-label="Steps">
            {NAV.map((n) => <button key={n.id} onClick={() => go(n.id)} className={cx("whitespace-nowrap rounded-full px-3 py-1 text-[12px]", step === n.id && !judge ? "bg-ink text-white" : "text-muted")}>{n.label}</button>)}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
        {judge && analysis ? <Judge a={analysis} source={source} />
          : step === "welcome" ? <Welcome onStart={() => go("connect")} onSample={async () => { const csv = await (await fetch("/sample/johns-trucking.csv")).text(); run(csv, "PADD2", "Sample company (synthetic)"); }} />
          : step === "connect" ? <Connect onRun={run} />
          : step === "analyzing" ? <Analyzing stages={stages} error={error} source={source} onBack={() => go("connect")} />
          : analysis && step === "overview" ? <Overview a={analysis} onNext={() => go("protection")} />
          : analysis && step === "protection" ? <Protection a={analysis} onNext={() => go("simulate")} />
          : analysis && step === "simulate" ? <Simulator a={analysis} onNext={() => go("payout")} />
          : analysis && step === "payout" ? <Payout a={analysis} />
          : <Welcome onStart={() => go("connect")} onSample={() => go("connect")} />}
      </main>
      <footer className="border-t border-line px-4 py-6 text-center text-xs text-faint">
        CostShield is a hackathon prototype built for UBC 2026. Price data: U.S. Energy Information Administration. Market data: Gemini Prediction Markets public API. Settlement: Solana devnet with Helius Privacy Rings.
      </footer>
    </div>
  );
}
