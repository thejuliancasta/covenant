/*
 * Shared pieces for the background graphics. Everything here is static SVG, server-safe
 * (no hooks) and decorative: the parent Backdrop hides it from assistive tech.
 */
import type { ReactNode } from "react";

/** Brand colors as CSS, so SVG strokes follow the theme tokens. */
export const inkAt = (a: number) => `rgb(var(--ink) / ${a})`;
export const emberAt = (a: number) => `rgb(var(--jade) / ${a})`;

/** Snap a pixel coordinate to the center of a device pixel so 1px hairlines stay crisp. */
export const px = (v: number) => Math.round(v) + 0.5;

export type Stops = [offset: number, opacity: number][];

/**
 * A luminance mask that fades its content along one axis of the whole SVG viewport.
 * `stops` are [offset 0..1, visibility 0..1] pairs. Masks nest, so x and y fades multiply.
 */
export function FadeMask({ id, axis, stops }: { id: string; axis: "x" | "y"; stops: Stops }) {
  const g = `${id}-g`;
  return (
    <>
      <linearGradient id={g} x1="0" y1="0" x2={axis === "x" ? "1" : "0"} y2={axis === "y" ? "1" : "0"}>
        {stops.map(([o, a], i) => (
          <stop key={i} offset={o} stopColor="#fff" stopOpacity={a} />
        ))}
      </linearGradient>
      <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
        <rect width="100%" height="100%" fill={`url(#${g})`} />
      </mask>
    </>
  );
}

/** Wrap content in one or two fade masks (x then y). */
export function Faded({ id, x, y, children }: { id: string; x?: Stops; y?: Stops; children: ReactNode }) {
  const inner = y ? <g mask={`url(#${id}-y)`}>{children}</g> : children;
  return (
    <>
      <defs>
        {x && <FadeMask id={`${id}-x`} axis="x" stops={x} />}
        {y && <FadeMask id={`${id}-y`} axis="y" stops={y} />}
      </defs>
      {x ? <g mask={`url(#${id}-x)`}>{inner}</g> : inner}
    </>
  );
}
