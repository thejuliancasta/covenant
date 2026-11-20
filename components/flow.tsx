"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "motion/react";
import type { Analysis, PipelineEvent, StageId } from "@/lib/engine/pipeline";
import { readNdjson } from "@/lib/format";
import { cx } from "@/components/ui";
import { SPRING_UI } from "@/components/fx/motion";
import { Logo } from "@/components/brand/logo";
import { Connect, Analyzing, type StageView } from "@/components/onboarding";
import { Overview, Protection } from "@/components/results";
import { Simulator, Payout } from "@/components/simulate";
import { Judge } from "@/components/judge";

/*
 * The product shell at /app. Linear-style: a slim sidebar (logo, steps with a sliding
 * ember mark, Judge mode, the simulation notice) beside one framed main panel. On narrow
 * screens the sidebar becomes a compact sticky top bar with horizontal steps.
 */

type Step = "welcome" | "connect" | "analyzing" | "overview" | "protection" | "simulate" | "payout";
const NAV: { id: Step; label: string }[] = [
  { id: "connect", label: "Connect" }, { id: "overview", label: "Your risks" }, { id: "protection", label: "Protection" },
  { id: "simulate", label: "Simulate" }, { id: "payout", label: "Payout" },
];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SAMPLE_LABEL = "Sample company (synthetic)";

/** Step list. A short ember mark slides to the active step; steps that need a result say so. */
function StepNav({ step, judge, enabled, go, id, vertical }: { step: Step; judge: boolean; enabled: (s: Step) => boolean; go: (s: Step) => void; id: string; vertical?: boolean }) {
  return (
    <LayoutGroup id={id}>
      {NAV.map((n, i) => {
        const on = enabled(n.id), active = !judge && (step === n.id || (n.id === "connect" && step === "analyzing"));
        return (
          <button
            key={n.id} disabled={!on} onClick={() => go(n.id)} aria-current={active ? "step" : undefined}
            title={on ? undefined : "Run an analysis first"}
            className={cx(
              "relative flex shrink-0 items-center gap-3 rounded-[6px] text-[13px] font-[510] transition-[color,background-color] duration-150 ease-out",
              vertical ? "h-9 w-full px-3" : "h-10 px-3",
              active ? "text-ink" : on ? "text-muted hover:bg-line/[0.04] hover:text-ink2" : "cursor-not-allowed text-faint/60",
            )}
          >
            {active && (
              <motion.span layoutId="mark" transition={SPRING_UI} aria-hidden
                className={cx("absolute rounded-full bg-jade", vertical ? "left-0 top-1/2 h-3.5 w-[2px] -translate-y-1/2" : "bottom-0.5 left-1/2 h-[2px] w-3.5 -translate-x-1/2")} />
            )}
            <span className={cx("num w-3 text-[12px] tabular-nums", active ? "text-jade" : "text-faint")}>{i + 1}</span>
            <span>{n.label}</span>
          </button>
        );
      })}
    </LayoutGroup>
  );
}

function JudgeToggle({ on, disabled, onClick, wide }: { on: boolean; disabled: boolean; onClick: () => void; wide?: boolean }) {
  return (
    <button
      disabled={disabled} onClick={onClick} aria-pressed={on} title={disabled ? "Run an analysis first" : "Technical view for judges"}
      className={cx(
        "flex h-9 shrink-0 items-center gap-2.5 rounded-[6px] px-3 text-[13px] font-[510] transition-[color,background-color] duration-150 ease-out",
        wide && "w-full",
        disabled ? "cursor-not-allowed text-faint/60" : on ? "text-ink" : "text-muted hover:bg-line/[0.04] hover:text-ink2",
      )}
    >
      <motion.span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", on ? "bg-jade" : disabled ? "bg-faint/40" : "bg-muted")} initial={false} animate={{ scale: on ? 1.35 : 1 }} transition={SPRING_UI} />
      Judge mode<span className={cx("ml-auto text-[12px] font-normal", on ? "text-jade" : "text-faint")}>{on ? "On" : "Off"}</span>
    </button>
  );
}

export default function Flow({ initial = "connect" }: { initial?: Step }) {
  const [step, setStep] = useState<Step>(initial === "welcome" ? "connect" : initial);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [stages, setStages] = useState<Record<string, StageView>>({});
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [judge, setJudge] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const imported = useRef(false);
  const mobileNav = useRef<HTMLElement>(null);

  const go = useCallback((s: Step) => { setStep(s === "welcome" ? "connect" : s); setJudge(false); window.scrollTo({ top: 0 }); }, []);

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
      await sleep(1700); // pacing only: the tape sorts the real classified lines into lanes before moving on
      go("overview");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [go]);

  const runSample = useCallback(async () => {
    try {
      const res = await fetch("/sample/johns-trucking.csv");
      if (!res.ok) throw new Error(`Could not load the sample file (HTTP ${res.status}).`);
      run(await res.text(), "PADD2", SAMPLE_LABEL);
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : String(e));
      setStep("connect");
    }
  }, [run]);

  // Entry points: ?sample=1 from the landing page, ?connect_error from a ledger sign-in, or a pulled ledger in sessionStorage.
  useEffect(() => {
    if (imported.current) return;
    const params = new URLSearchParams(window.location.search);
    const failed = params.get("connect_error");
    const wantsSample = params.get("sample") === "1";
    const raw = sessionStorage.getItem("costshield-import");
    if (!failed && !raw && !wantsSample) return;
    imported.current = true;
    window.history.replaceState({}, "", window.location.pathname);
    if (raw) {
      sessionStorage.removeItem("costshield-import");
      try {
        const data = JSON.parse(raw) as { csv: string; region: string; label: string };
        run(data.csv, data.region || "PADD2", data.label);
      } catch {
        setConnectError("The ledger came back in a form this page could not read.");
        setStep("connect");
      }
      return;
    }
    if (failed) { setConnectError(failed); setStep("connect"); return; }
    runSample();
  }, [run, runSample]);

  const hasResult = !!analysis;
  useEffect(() => {
    const nav = mobileNav.current, cur = nav?.querySelector<HTMLElement>("[aria-current=step]");
    if (nav && cur) nav.scrollTo({ left: cur.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft - (nav.clientWidth - cur.offsetWidth) / 2, behavior: "smooth" });
  }, [step, hasResult]);
  const enabled = (s: Step) => s === "connect" || hasResult;
  const view = judge && analysis ? "judge" : step;
  const toggleJudge = () => { setJudge((j) => !j); window.scrollTo({ top: 0 }); };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-bg lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-0 hidden h-screen flex-col px-3 pb-4 pt-4 lg:flex">
          <Link href="/" className="flex h-9 items-center rounded-[6px] px-2 transition-colors duration-150 hover:bg-line/[0.04]" aria-label="CostShield home">
            <Logo size={20} />
          </Link>
          <nav className="mt-6 grid gap-0.5" aria-label="Steps">
            <StepNav id="side" vertical step={step} judge={judge} enabled={enabled} go={go} />
          </nav>
          {source && <p className="mt-6 px-3 text-[12px] leading-[1.5] text-faint">{source}</p>}
          <div className="mt-auto grid gap-3">
            <JudgeToggle wide on={judge} disabled={!hasResult} onClick={toggleJudge} />
            <p className="px-3 text-[12px] leading-[1.5] text-faint">Simulation, devnet test dollars</p>
          </div>
        </aside>

        {/* Top bar (narrow) */}
        <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md lg:hidden">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <Link href="/" className="flex h-10 items-center" aria-label="CostShield home"><Logo size={20} /></Link>
            <JudgeToggle on={judge} disabled={!hasResult} onClick={toggleJudge} />
          </div>
          <nav ref={mobileNav} className="flex gap-0.5 overflow-x-auto px-2 pb-1 [scrollbar-width:none]" aria-label="Steps">
            <StepNav id="top" step={step} judge={judge} enabled={enabled} go={go} />
          </nav>
        </header>

        {/* Main panel */}
        <div className="min-w-0 lg:py-2 lg:pr-2">
          <div className="min-h-[calc(100vh-16px)] lg:rounded-[12px] lg:border lg:border-line/[0.08] lg:bg-raised lg:shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]">
            <main className="mx-auto max-w-[1080px] px-4 pb-20 pt-8 sm:px-8 sm:pt-12 lg:px-12">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}>
                  {judge && analysis ? <Judge a={analysis} source={source} />
                    : step === "analyzing" ? <Analyzing stages={stages} error={error} source={source} onBack={() => go("connect")} result={analysis} />
                    : analysis && step === "overview" ? <Overview a={analysis} onNext={() => go("protection")} />
                    : analysis && step === "protection" ? <Protection a={analysis} onNext={() => go("simulate")} />
                    : analysis && step === "simulate" ? <Simulator a={analysis} onNext={() => go("payout")} />
                    : analysis && step === "payout" ? <Payout a={analysis} />
                    : <Connect onRun={run} connectError={connectError} />}
                </motion.div>
              </AnimatePresence>
            </main>
            <footer className="mx-auto max-w-[1080px] px-4 pb-8 text-[12px] leading-[1.6] text-faint sm:px-8 lg:px-12">
              <p>Simulation. Not an offer of insurance or derivatives. No real premiums, orders or payouts. Devnet test dollars only.</p>
              <p className="mt-1">CostShield is a hackathon prototype built for UBC 2026. Price data: U.S. Energy Information Administration. Market data: Gemini Prediction Markets public API. Settlement: Solana devnet with Helius Privacy Rings.</p>
            </footer>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
