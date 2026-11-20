/*
 * SteppedC: the CostShield mark drawn as an architectural outline at very large scale.
 * Each bar of the logo becomes a hairline outline, and its edges continue as faint
 * construction lines, like the setting-out lines on a drawing. The mark is anchored to
 * one side of its band and cropped by that edge; the ember cap is the only warm line.
 */
import { Faded, emberAt, inkAt, px, type Stops } from "./primitives";

// Logo bars on the 48-unit grid (components/brand/logo.tsx): [x, y, width, height]. The C opens right.
const BARS: [number, number, number, number][] = [
  [17, 6, 24, 5.6],
  [11, 13.1, 15, 5.6],
  [8, 20.2, 11, 7.6],
  [11, 29.3, 15, 5.6],
  [17, 36.4, 24, 5.6],
];
const STEP_XS = [8, 11, 17];

export function SteppedC({
  id,
  scale,
  edgeAt,
  top = 0,
  anchor = "right",
  alpha = 0.05,
  ember = 0.1,
  construction = 0.5,
  fadeX,
  fadeY,
  className,
}: {
  id: string;
  /** Pixels per logo unit. */
  scale: number;
  /** The logo x (0..48) that lands exactly on the anchored edge; everything past it is cropped. */
  edgeAt: number;
  /** Pixel offset of the logo's 0 line from the top of the band. */
  top?: number;
  anchor?: "left" | "right";
  /** Outline opacity. Construction lines draw at `alpha * construction`. */
  alpha?: number;
  /** Opacity of the ember cap outline. */
  ember?: number;
  construction?: number;
  fadeX?: Stops;
  fadeY?: Stops;
  className?: string;
}) {
  const X = (x: number) => (x - edgeAt) * scale;
  const Y = (y: number) => top + y * scale;
  const thin = inkAt(alpha * construction);
  const edges = BARS.flatMap(([, y, , h]) => [px(Y(y)), px(Y(y + h))]);

  return (
    <svg aria-hidden className={className} width="100%" height="100%" fill="none">
      <Faded id={id} x={fadeX} y={fadeY}>
        <svg x={anchor === "right" ? "100%" : "0"} y="0" overflow="visible">
          <g strokeWidth="1" shapeRendering="geometricPrecision">
            {/* Setting-out lines: each bar edge carried across the band, each step face carried down it. */}
            {edges.map((y, i) => (
              <line key={`h${i}`} x1={-4000} x2={4000} y1={y} y2={y} style={{ stroke: thin }} />
            ))}
            {STEP_XS.map((x) => (
              <line key={`v${x}`} x1={px(X(x))} x2={px(X(x))} y1={-4000} y2={4000} style={{ stroke: thin }} />
            ))}
            {/* The bars themselves, outlined. */}
            {BARS.map(([x, y, w, h], i) => (
              <rect
                key={i}
                x={px(X(x))}
                y={px(Y(y))}
                width={Math.round(w * scale)}
                height={Math.round(h * scale)}
                rx={1.4 * scale}
                style={{ stroke: i === 0 ? emberAt(ember) : inkAt(alpha) }}
              />
            ))}
          </g>
        </svg>
      </Faded>
    </svg>
  );
}
