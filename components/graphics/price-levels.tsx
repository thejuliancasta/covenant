/*
 * PriceLevels: the page as a giant, almost invisible price chart.
 * Hairlines run down the full height of the container, one per diesel price level, from
 * `top` dollars at the top to `bottom` dollars at the foot, in $0.25 steps (the steps
 * CostShield pays in). The protection strike is a faint dashed ember line.
 * Lines hold their strength in the side margins and drop to a quarter behind the content
 * column; labels appear in the left margin only where the gutter is wide enough.
 */
import type { CSSProperties } from "react";
import { emberAt, inkAt } from "./primitives";

const usd = (v: number) => `$${v.toFixed(2)}`;

/** Visible in the margins, a quarter strength behind the centered content column. */
const columnFade = (column: number, soft: number, floor: number) => {
  const half = column / 2;
  const f = `rgb(0 0 0 / ${floor})`;
  const m = `linear-gradient(90deg, #000 0, #000 calc(50% - ${half + soft}px), ${f} calc(50% - ${half - soft}px), ${f} calc(50% + ${half - soft}px), #000 calc(50% + ${half + soft}px), #000 100%)`;
  return { maskImage: m, WebkitMaskImage: m } satisfies CSSProperties;
};

/** Visible only within `width` px of each side edge. */
const edgeFade = (width: number) => {
  const m = `linear-gradient(90deg, #000 0, transparent ${width}px, transparent calc(100% - ${width}px), #000 100%)`;
  return { maskImage: m, WebkitMaskImage: m } satisfies CSSProperties;
};

export function PriceLevels({
  top = 6.5,
  bottom = 3,
  step = 0.25,
  strike = 4.357,
  inset = [3.5, 97],
  alpha = 0.04,
  ember = 0.11,
  mode = "page",
  labels = true,
}: {
  /** Price at the top line and the bottom line, USD/gal. */
  top?: number;
  bottom?: number;
  step?: number;
  strike?: number;
  /** Where the top and bottom lines sit, as % of the container height. */
  inset?: [number, number];
  alpha?: number;
  ember?: number;
  /** "page": full width, quieter behind the 1200px content column. "margins": only near the side edges. */
  mode?: "page" | "margins";
  labels?: boolean;
}) {
  const at = (v: number) => inset[0] + ((top - v) / (top - bottom)) * (inset[1] - inset[0]);
  const count = Math.round((top - bottom) / step);
  const levels = Array.from({ length: count + 1 }, (_, i) => +(top - i * step).toFixed(2));
  const fade = mode === "page" ? columnFade(1200, 120, 0.25) : edgeFade(112);
  const label = "absolute left-5 bottom-full mb-1 hidden font-mono text-[10px] leading-none tracking-[0.01em] xl:block";
  const labelStyle = { color: inkAt(0.22), fontVariantNumeric: "tabular-nums" } satisfies CSSProperties;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {levels.map((v) => {
        const whole = Math.abs(v - Math.round(v)) < 1e-6;
        return (
          <div key={v} className="absolute inset-x-0" style={{ top: `${at(v)}%` }}>
            <div className="h-px w-full" style={{ ...fade, background: inkAt(whole ? alpha * 1.25 : alpha) }} />
            {labels && <span className={label} style={labelStyle}>{usd(v)}</span>}
          </div>
        );
      })}
      <div className="absolute inset-x-0" style={{ top: `${at(strike)}%` }}>
        <div className="h-px w-full" style={{ ...fade, backgroundImage: `repeating-linear-gradient(90deg, ${emberAt(ember)} 0 3px, transparent 3px 9px)` }} />
        {labels && (
          <span className={label} style={{ ...labelStyle, color: emberAt(0.25) }}>
            <span className="min-[1480px]:hidden">{usd(strike)}</span>
            <span className="hidden font-sans min-[1480px]:inline">Protection starts at {usd(strike)}</span>
          </span>
        )}
      </div>
    </div>
  );
}
