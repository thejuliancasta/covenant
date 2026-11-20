"use client";
import { useId } from "react";

interface Line { label: string; color: string; values: (number | null)[]; dashed?: boolean; width?: number }

/** Minimal responsive SVG line chart with optional bars on a second axis and a horizontal reference line. */
export function LineChart({ x, lines, bars, refLine, height = 220, yFmt = (v: number) => v.toFixed(2), barFmt }: {
  x: string[]; lines: Line[]; bars?: { label: string; color: string; values: number[] }; refLine?: { value: number; label: string }; height?: number; yFmt?: (v: number) => string; barFmt?: (v: number) => string;
}) {
  const id = useId();
  const W = 720, H = height, L = 46, R = 12, T = 14, B = 26;
  const all = lines.flatMap((l) => l.values.filter((v): v is number => v !== null)).concat(refLine ? [refLine.value] : []);
  let lo = Math.min(...all), hi = Math.max(...all);
  const padY = (hi - lo) * 0.08 || 1; lo -= padY; hi += padY;
  const sx = (i: number) => L + (x.length === 1 ? 0.5 : i / (x.length - 1)) * (W - L - R);
  const sy = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const bmax = bars ? Math.max(...bars.values, 1e-9) : 1;
  const bw = Math.max(3, ((W - L - R) / x.length) * 0.5);
  const ticks = Array.from({ length: 4 }, (_, i) => lo + ((i + 0.5) / 4) * (hi - lo));
  const every = Math.ceil(x.length / 8);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-labelledby={id}>
        <title id={id}>{lines.map((l) => l.label).join(", ")}</title>
        {ticks.map((t, i) => (<g key={i}><line x1={L} x2={W - R} y1={sy(t)} y2={sy(t)} stroke="#E5E1D8" strokeWidth="1" /><text x={L - 8} y={sy(t) + 3.5} textAnchor="end" fontSize="10.5" fill="#8B9197" className="num">{yFmt(t)}</text></g>))}
        {bars && bars.values.map((v, i) => v > 0 && <rect key={i} x={sx(i) - bw / 2} width={bw} y={H - B - (v / bmax) * (H - T - B) * 0.55} height={(v / bmax) * (H - T - B) * 0.55} rx="2" fill={bars.color} opacity="0.85" />)}
        {refLine && (<g><line x1={L} x2={W - R} y1={sy(refLine.value)} y2={sy(refLine.value)} stroke="#A8321F" strokeWidth="1.25" strokeDasharray="5 4" /><text x={L + 6} y={sy(refLine.value) - 6} textAnchor="start" fontSize="10.5" fill="#A8321F" stroke="#fff" strokeWidth="3" paintOrder="stroke">{refLine.label}</text></g>)}
        {lines.map((l) => {
          let d = "", pen = false;
          l.values.forEach((v, i) => { if (v === null) { pen = false; return; } d += `${pen ? "L" : "M"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`; pen = true; });
          return <path key={l.label} d={d} fill="none" stroke={l.color} strokeWidth={l.width ?? 2} strokeDasharray={l.dashed ? "4 4" : undefined} strokeLinejoin="round" strokeLinecap="round" />;
        })}
        {x.map((label, i) => i % every === 0 && <text key={i} x={sx(i)} y={H - 8} textAnchor="middle" fontSize="10.5" fill="#8B9197">{label}</text>)}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {lines.map((l) => <span key={l.label} className="inline-flex items-center gap-1.5"><i className="inline-block h-0.5 w-4" style={{ background: l.color }} />{l.label}</span>)}
        {bars && <span className="inline-flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: bars.color }} />{bars.label}</span>}
      </figcaption>
    </figure>
  );
}

export function HBar({ value, max, color = "#15181B" }: { value: number; max: number; color?: string }) {
  return <div className="h-1.5 w-full rounded-full bg-paper"><div className="h-1.5 rounded-full" style={{ width: `${Math.max(1.5, Math.min(100, (value / max) * 100))}%`, background: color }} /></div>;
}

/** Vertical bars with a zero baseline. Used for the cohort backtest. */
export function Bars({ values, labels, color = "#0B5D4B", height = 150, fmt }: { values: number[]; labels: string[]; color?: string; height?: number; fmt: (v: number) => string }) {
  const W = 720, H = height, L = 46, B = 22, T = 8;
  const max = Math.max(...values, 1e-9), bw = (W - L - 8) / values.length;
  const every = Math.ceil(values.length / 8);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Historical payouts by cohort">
      {[0.5, 1].map((f) => (<g key={f}><line x1={L} x2={W - 8} y1={T + (1 - f) * (H - T - B)} y2={T + (1 - f) * (H - T - B)} stroke="#E5E1D8" /><text x={L - 8} y={T + (1 - f) * (H - T - B) + 3.5} textAnchor="end" fontSize="10.5" fill="#8B9197">{fmt(max * f)}</text></g>))}
      <line x1={L} x2={W - 8} y1={H - B} y2={H - B} stroke="#CFCBC2" />
      {values.map((v, i) => <rect key={i} x={L + i * bw + 0.5} width={Math.max(1, bw - 1)} y={H - B - (v / max) * (H - T - B)} height={Math.max(v > 0 ? 1 : 0, (v / max) * (H - T - B))} fill={v > 0 ? color : "transparent"} />)}
      {labels.map((l, i) => i % every === 0 && <text key={i} x={L + i * bw} y={H - 6} fontSize="10.5" fill="#8B9197">{l}</text>)}
    </svg>
  );
}
