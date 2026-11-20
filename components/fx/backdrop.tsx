/*
 * Backdrop: the quiet, brand-derived background shared by the landing page and the app.
 * Composed from components/graphics:
 *   SteppedC    the logo as a large outlined drawing with construction lines, cropped by an edge
 *   PriceTrace  real weekly diesel prices crossing a dashed strike, drawn once
 *   TickField   a sparse grid of tiny crosses
 *   MarginRuler a measured scale down the left margin
 *   PriceLevels the page as a giant price chart: a hairline per $0.25 of diesel, $6.50 at the
 *               top to $3.00 at the foot, with the $4.36 protection strike dashed in ember
 * Static, hairline only, ink lines at or under ~6% and ember under ~12%. Every piece fades
 * toward the content column. No glows, gradients of light, noise or animation.
 *
 * Mount it as the first child of a `relative` container; it fills that container.
 * - "landing": spans the full page height (the landing root is `relative isolate`), so it sits
 *   at z-index -1 behind in-flow content and places detail at a few vertical anchors.
 * - "app": one corner motif plus texture, at z-0 under the `relative z-10` content.
 */
import { SteppedC } from "@/components/graphics/stepped-c";
import { PriceTrace } from "@/components/graphics/price-trace";
import { MarginRuler, TickField } from "@/components/graphics/texture";
import { PriceLevels } from "@/components/graphics/price-levels";

export function Backdrop({ variant = "app" }: { variant?: "landing" | "app" }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 select-none overflow-hidden ${variant === "landing" ? "-z-10" : "z-0"}`}>
      {variant === "landing" ? <Landing /> : <App />}
    </div>
  );
}

function Landing() {
  return (
    <>
      {/* The whole page is a price chart: $6.50 at the top, $3.00 at the foot, labels at the ruler. */}
      <PriceLevels />

      {/* Hero: the mark, top right, cropped by the edge, with a few crosses in the corner. */}
      <div className="absolute inset-x-0 top-0 h-[760px] opacity-60 sm:opacity-100">
        <TickField id="bd-l-ticks-top" alpha={0.04} fadeX={[[0, 0], [0.58, 0], [1, 1]]} fadeY={[[0, 1], [0.45, 0.6], [0.85, 0]]} className="absolute inset-0" />
        <SteppedC
          id="bd-l-mark"
          scale={15}
          edgeAt={34}
          top={-15}
          alpha={0.055}
          ember={0.11}
          fadeX={[[0, 0], [0.4, 0], [0.8, 1], [1, 1]]}
          fadeY={[[0, 1], [0.6, 1], [1, 0]]}
          className="absolute inset-0"
        />
      </div>

      {/* Left margin: a measured ruler down the whole page. */}
      <MarginRuler id="bd-l-ruler" alpha={0.05} fadeY={[[0, 0], [0.04, 1], [0.96, 1], [1, 0]]} className="absolute left-0 top-0 h-full" />

      {/* About a third down: the diesel price, once, crossing the strike. */}
      <div className="absolute inset-x-0 top-[31%] h-[240px]">
        <PriceTrace id="bd-l-price" height={240} className="absolute inset-0" />
      </div>

      {/* Further down: crosses in the right margin. */}
      <div className="absolute inset-x-0 top-[57%] h-[640px]">
        <TickField id="bd-l-ticks-mid" alpha={0.04} fadeX={[[0, 0], [0.72, 0], [1, 1]]} fadeY={[[0, 0], [0.3, 1], [0.7, 1], [1, 0]]} className="absolute inset-0" />
      </div>

      {/* Near the close: a smaller echo of the mark, right edge. */}
      <div className="absolute inset-x-0 bottom-[160px] hidden h-[560px] sm:block">
        <SteppedC
          id="bd-l-mark-end"
          scale={10}
          edgeAt={30}
          top={40}
          alpha={0.04}
          ember={0.08}
          fadeX={[[0, 0], [0.55, 0], [0.88, 1], [1, 1]]}
          fadeY={[[0, 0], [0.25, 1], [0.75, 1], [1, 0]]}
          className="absolute inset-0"
        />
      </div>
    </>
  );
}

function App() {
  return (
    <>
      {/* A lighter chart: every $0.50 plus the strike, in the side margins only, no labels. */}
      <PriceLevels step={0.5} inset={[6, 94]} alpha={0.035} ember={0.09} mode="margins" labels={false} />
      <div className="absolute inset-x-0 top-0 h-[560px] opacity-60 sm:opacity-100">
        <TickField id="bd-a-ticks" alpha={0.035} fadeX={[[0, 0], [0.62, 0], [1, 1]]} fadeY={[[0, 1], [0.7, 0]]} className="absolute inset-0" />
        <SteppedC
          id="bd-a-mark"
          scale={10}
          edgeAt={31}
          top={-20}
          alpha={0.045}
          ember={0.09}
          fadeX={[[0, 0], [0.45, 0], [0.86, 1], [1, 1]]}
          fadeY={[[0, 1], [0.5, 1], [1, 0]]}
          className="absolute inset-0"
        />
      </div>
      <MarginRuler id="bd-a-ruler" alpha={0.04} fadeY={[[0, 0], [0.1, 1], [0.5, 1], [1, 0]]} className="absolute left-0 top-0 hidden h-[720px] sm:block" />
    </>
  );
}
