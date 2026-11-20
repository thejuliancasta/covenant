/*
 * PriceTrace: one real diesel price line, drawn once, crossing a dashed strike.
 * Weekly Midwest (PADD 2) retail diesel from EIA since 2021. Where the price runs above
 * the strike, the line turns ember: that is the stretch CostShield would pay back.
 * The line fades out through the middle of the band so it never sits behind body text.
 */
import { DIESEL_PADD2 } from "./diesel-trace-data";
import { Faded, emberAt, inkAt, px, type Stops } from "./primitives";

const VALUES: readonly number[] = DIESEL_PADD2.values;
const MIN = Math.min(...VALUES);
const MAX = Math.max(...VALUES);

export function PriceTrace({
  id,
  height = 240,
  strike = 4.357,
  alpha = 0.06,
  ember = 0.11,
  fadeX = [[0, 1], [0.12, 1], [0.34, 0.12], [0.66, 0.12], [0.88, 1], [1, 1]],
  className,
}: {
  id: string;
  /** Band height in pixels. The trace spans the full width. */
  height?: number;
  /** Strike in USD/gal. */
  strike?: number;
  alpha?: number;
  ember?: number;
  fadeX?: Stops;
  className?: string;
}) {
  const pad = 20;
  const y = (v: number) => pad + ((MAX - v) / (MAX - MIN)) * (height - pad * 2);
  const n = VALUES.length;
  const d = VALUES.map((v, i) => `${i ? "L" : "M"}${((i / (n - 1)) * 1000).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  const sy = px(y(strike));

  return (
    <svg aria-hidden className={className} width="100%" height={height} fill="none">
      <Faded id={id} x={fadeX}>
        {/* Strike, in pixel space so the dashes stay even at any width. */}
        <line x1="0" x2="100%" y1={sy} y2={sy} strokeWidth="1" strokeDasharray="2 6" style={{ stroke: inkAt(alpha * 0.85) }} />
        <svg width="100%" height={height} viewBox={`0 0 1000 ${height}`} preserveAspectRatio="none" overflow="visible">
          <defs>
            <clipPath id={`${id}-above`} clipPathUnits="userSpaceOnUse"><rect x="-10" y="-10" width="1020" height={sy + 10} /></clipPath>
            <clipPath id={`${id}-below`} clipPathUnits="userSpaceOnUse"><rect x="-10" y={sy} width="1020" height={height} /></clipPath>
          </defs>
          <g strokeWidth="1" strokeLinejoin="round">
            <path d={d} clipPath={`url(#${id}-below)`} vectorEffect="non-scaling-stroke" style={{ stroke: inkAt(alpha) }} />
            <path d={d} clipPath={`url(#${id}-above)`} vectorEffect="non-scaling-stroke" style={{ stroke: emberAt(ember) }} />
          </g>
        </svg>
      </Faded>
    </svg>
  );
}
