/*
 * Fine texture, like the margins of an engineering drawing.
 * TickField: a sparse grid of tiny crosses. MarginRuler: a measured scale down one edge.
 * Both are SVG patterns, so they cost a few nodes however large the area is.
 */
import { Faded, inkAt, type Stops } from "./primitives";

export function TickField({
  id,
  gap = 48,
  arm = 2,
  alpha = 0.045,
  fadeX,
  fadeY,
  className,
}: {
  id: string;
  /** Spacing between crosses, in pixels. */
  gap?: number;
  /** Half-length of each cross arm, in pixels. */
  arm?: number;
  alpha?: number;
  fadeX?: Stops;
  fadeY?: Stops;
  className?: string;
}) {
  const c = Math.floor(gap / 2);
  return (
    <svg aria-hidden className={className} width="100%" height="100%" fill="none">
      <defs>
        <pattern id={`${id}-p`} patternUnits="userSpaceOnUse" width={gap} height={gap}>
          <path d={`M${c - arm} ${c + 0.5}h${arm * 2 + 1}M${c + 0.5} ${c - arm}v${arm * 2 + 1}`} strokeWidth="1" style={{ stroke: inkAt(alpha) }} />
        </pattern>
      </defs>
      <Faded id={id} x={fadeX} y={fadeY}>
        <rect width="100%" height="100%" fill={`url(#${id}-p)`} />
      </Faded>
    </svg>
  );
}

/**
 * A vertical ruler hugging one edge: a hairline baseline, a short tick every 8px,
 * a longer one every 48px and the longest every 192px. Meant for the page margin.
 */
export function MarginRuler({
  id,
  side = "left",
  alpha = 0.05,
  fadeY,
  className,
}: {
  id: string;
  side?: "left" | "right";
  alpha?: number;
  fadeY?: Stops;
  className?: string;
}) {
  const W = 14;
  const flip = side === "right";
  const tick = (y: number, len: number) => (flip ? `M${W - len} ${y + 0.5}h${len}` : `M0 ${y + 0.5}h${len}`);
  const minor = Array.from({ length: 24 }, (_, i) => i * 8).filter((y) => y % 48 !== 0).map((y) => tick(y, 3)).join("");
  const mid = [48, 96, 144].map((y) => tick(y, 6)).join("");
  const base = flip ? `M${W - 0.5} 0v192` : "M0.5 0v192";
  return (
    <svg aria-hidden className={className} width={W} height="100%" fill="none">
      <defs>
        <pattern id={`${id}-p`} patternUnits="userSpaceOnUse" width={W} height={192}>
          <g strokeWidth="1" style={{ stroke: inkAt(alpha) }}>
            <path d={base} style={{ stroke: inkAt(alpha * 0.6) }} />
            <path d={minor} />
            <path d={mid} style={{ stroke: inkAt(alpha * 1.2) }} />
            <path d={tick(0, 10)} style={{ stroke: inkAt(alpha * 1.2) }} />
          </g>
        </pattern>
      </defs>
      <Faded id={id} y={fadeY}>
        <rect width="100%" height="100%" fill={`url(#${id}-p)`} />
      </Faded>
    </svg>
  );
}
