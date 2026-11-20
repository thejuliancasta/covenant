/*
 * Backdrop: one quiet, brand-derived background shared by the landing page and the app.
 * The five bars of the Stepped C logo, drawn as hairlines (the top and bottom edge of
 * each bar), anchored to the top-right and fading out to the left, plus a very soft
 * light from the top. Static, at most about 5% opacity, invisible to screen readers.
 * Mount it inside a `relative` container; it fills that container's top area.
 */

// Logo bars on its 48-unit grid: [left edge, top, height]. The C opens to the right.
const BARS: [number, number, number][] = [[17, 6, 5.6], [11, 13.1, 5.6], [8, 20.2, 7.6], [11, 29.3, 5.6], [17, 36.4, 5.6]];

export function Backdrop({ variant = "app" }: { variant?: "landing" | "app" }) {
  const landing = variant === "landing";
  const H = landing ? 620 : 440;
  const alpha = landing ? 0.055 : 0.04;
  const scaleY = H / 48, x0 = 8;
  const xs = (x: number) => 380 + (x - x0) * 26; // logo x -> viewBox x (1000 wide); the stepped edge sits right of center
  const lines = BARS.flatMap(([x, y, h], k) => [
    { x: xs(x), y: y * scaleY, ember: k === 0 },
    { x: xs(x), y: (y + h) * scaleY, ember: k === 0 },
  ]);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-0 overflow-hidden" style={{ height: H }}>
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 70% 55% at 50% 0%, rgb(255 255 255 / ${landing ? 0.04 : 0.03}), transparent 70%)` }} />
      <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 1000 ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={`bd-fade-${variant}`} gradientUnits="userSpaceOnUse" x1="120" y1="0" x2="1000" y2="0">
            <stop offset="0" stopColor="rgb(var(--ink))" stopOpacity="0" />
            <stop offset="0.55" stopColor="rgb(var(--ink))" stopOpacity={alpha} />
            <stop offset="1" stopColor="rgb(var(--ink))" stopOpacity={alpha * 0.6} />
          </linearGradient>
          <linearGradient id={`bd-ember-${variant}`} gradientUnits="userSpaceOnUse" x1="120" y1="0" x2="1000" y2="0">
            <stop offset="0" stopColor="rgb(var(--jade))" stopOpacity="0" />
            <stop offset="0.55" stopColor="rgb(var(--jade))" stopOpacity={alpha * 1.1} />
            <stop offset="1" stopColor="rgb(var(--jade))" stopOpacity={alpha * 0.6} />
          </linearGradient>
          <linearGradient id={`bd-down-${variant}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0.55" stopColor="white" />
            <stop offset="1" stopColor="black" />
          </linearGradient>
          <mask id={`bd-mask-${variant}`}><rect width="1000" height={H} fill={`url(#bd-down-${variant})`} /></mask>
        </defs>
        <g mask={`url(#bd-mask-${variant})`}>
          {lines.map((l, i) => (
            <line key={i} x1={l.x - 260} x2={1000} y1={l.y} y2={l.y} stroke={`url(#bd-${l.ember ? "ember" : "fade"}-${variant})`} strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      </svg>
    </div>
  );
}
