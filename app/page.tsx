"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "motion/react";
import type { Analysis, PipelineEvent, StageId } from "@/lib/engine/pipeline";
import { readNdjson } from "@/lib/format";
import { cx } from "@/components/ui";
import { SPRING_UI } from "@/components/fx/motion";
import { Strata, type StrataVariant } from "@/components/fx/strata";
import { Logo } from "@/components/brand/logo";
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

/** Step navigation. The indicator slides between steps on a spring; steps that need a result say so. */
function StepNav({ step, judge, enabled, go, id }: { step: Step; judge: boolean; enabled: (s: Step) => boolean; go: (s: Step) => void; id: string }) {
  return (
    <LayoutGroup id={id}>
      {NAV.map((n, i) => {
        const on = enabled(n.id), active = !judge && (step === n.id || (n.id === "connect" && step === "analyzing"));
        return (
          <button
            key={n.id} disabled={!on} onClick={() => go(n.id)} aria-current={active ? "step" : undefined}
            title={on ? undefined : "Run an analysis first"}
            className={cx(
              "relative flex min-h-10 shrink-0 items-center gap-1.5 rounded-control px-3 text-[13.5px] font-medium transition-[color,transform] duration-150 ease-out active:scale-[0.98]",
              active ? "text-ink" : on ? "text-muted hover:text-ink" : "cursor-not-allowed text-faint/60",
            )}
          >
            {active && <motion.span layoutId="indicator" transition={SPRING_UI} className="absolute bottom-1 left-1/2 h-[2px] w-4 -translate-x-1/2 rounded-full bg-jade" aria-hidden />}
            <span className={cx("num text-[12px] transition-colors duration-150", active ? "text-jade" : on ? "text-faint" : "text-faint/50")}>{i + 1}</span>
            <span>{n.label}</span>
          </button>
        );
      })}
    </LayoutGroup>
  );
}

function JudgeToggle({ on, disabled, onClick }: { on: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      disabled={disabled} onClick={onClick} aria-pressed={on} title={disabled ? "Run an analysis first" : "Technical view for judges"}
      className={cx(
        "flex min-h-10 shrink-0 items-center gap-2 rounded-control px-2 text-[13px] font-medium transition-[color,transform] duration-150 ease-out active:scale-[0.98]",
        disabled ? "cursor-not-allowed text-faint/60" : on ? "text-ink" : "text-muted hover:text-ink",
      )}
    >
      <motion.span aria-hidden className={cx("h-1.5 w-1.5 rounded-full", on ? "bg-jade" : disabled ? "bg-faint/40" : "bg-muted")} initial={false} animate={{ scale: on ? 1.35 : 1 }} transition={SPRING_UI} />
      Judge mode<span className={cx("text-[12px] font-normal", on ? "text-jade" : "text-faint")}>{on ? "on" : "off"}</span>
    </button>
  );
}

export default function Home() {
  const [step, setStep] = useState<Step>("welcome");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [stages, setStages] = useState<Record<string, StageView>>({});
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [judge, setJudge] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const imported = useRef(false);
  const mobileNav = useRef<HTMLElement>(null);

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
      await sleep(1700); // pacing only: the tape sorts the real classified lines into lanes before moving on
      go("overview");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [go]);

  useEffect(() => {
    if (imported.current) return;
    const params = new URLSearchParams(window.location.search);
    const failed = params.get("connect_error");
    const raw = sessionStorage.getItem("costshield-import");
    if (!failed && !raw) return;
    imported.current = true;
    window.history.replaceState({}, "", "/");
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
    setConnectError(failed);
    setStep("connect");
  }, [run]);

  const hasResult = !!analysis;
  useEffect(() => {
    const nav = mobileNav.current, cur = nav?.querySelector<HTMLElement>("[aria-current=step]");
    if (nav && cur) nav.scrollTo({ left: cur.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft - (nav.clientWidth - cur.offsetWidth) / 2, behavior: "smooth" });
  }, [step, hasResult]);
  const enabled = (s: Step) => s === "connect" || hasResult;
  const view = judge && analysis ? "judge" : step;
  const sample = async () => { const csv = await (await fetch("/sample/johns-trucking.csv")).text(); run(csv, "PADD2", "Sample company (synthetic)"); };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen bg-bg">
        <Strata variant={(view === "judge" ? "judge" : view === "welcome" ? "hero" : view) as StrataVariant} />
        <p className="relative z-10 px-4 pt-3 text-center text-[12px] leading-4 text-faint">
          Simulation. Not an offer of insurance or derivatives. No real premiums, orders or payouts. Devnet test dollars only.
        </p>
        <header className="sticky top-0 z-30 bg-bg/55 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-[var(--page-gutter)]">
            <button onClick={() => go("welcome")} className="-ml-2 flex min-h-10 items-center gap-2.5 rounded-control px-2 transition-transform duration-150 ease-out active:scale-[0.98]" aria-label="CostShield home">
              <Logo size={24} />
            </button>
            <nav className="hidden items-center gap-1 md:flex" aria-label="Steps">
              <StepNav id="desk" step={step} judge={judge} enabled={enabled} go={go} />
            </nav>
            <JudgeToggle on={judge} disabled={!hasResult} onClick={() => { setJudge((j) => !j); window.scrollTo({ top: 0 }); }} />
          </div>
          {hasResult && (
            <nav ref={mobileNav} className="mx-[var(--page-gutter)] flex gap-0.5 overflow-x-auto pb-1 [scrollbar-width:none] md:hidden" aria-label="Steps">
              <StepNav id="mobile" step={step} judge={judge} enabled={enabled} go={go} />
            </nav>
          )}
        </header>
        <main className="relative z-10 mx-auto max-w-[1200px] px-[var(--page-gutter)] pb-32 pt-10 sm:pt-16">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={view} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}>
              {judge && analysis ? <Judge a={analysis} source={source} />
                : step === "welcome" ? <Welcome onStart={() => go("connect")} onSample={sample} />
                : step === "connect" ? <Connect onRun={run} connectError={connectError} />
                : step === "analyzing" ? <Analyzing stages={stages} error={error} source={source} onBack={() => go("connect")} result={analysis} />
                : analysis && step === "overview" ? <Overview a={analysis} onNext={() => go("protection")} />
                : analysis && step === "protection" ? <Protection a={analysis} onNext={() => go("simulate")} />
                : analysis && step === "simulate" ? <Simulator a={analysis} onNext={() => go("payout")} />
                : analysis && step === "payout" ? <Payout a={analysis} />
                : <Welcome onStart={() => go("connect")} onSample={() => go("connect")} />}
            </motion.div>
          </AnimatePresence>
        </main>
        <footer className="relative z-10 mx-auto max-w-[1200px] px-[var(--page-gutter)] pb-10 text-center text-[12px] leading-[1.6] text-faint">
          <p className="mx-auto max-w-[80ch]">CostShield is a hackathon prototype built for UBC 2026. Price data: U.S. Energy Information Administration. Market data: Gemini Prediction Markets public API. Settlement: Solana devnet with Helius Privacy Rings.</p>
        </footer>
      </div>
    </MotionConfig>
  );
}
