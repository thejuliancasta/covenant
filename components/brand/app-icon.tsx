import { ImageResponse } from "next/og";

/** The Covenant mark from app/icon.svg on a full square: x, y, width, height on a 48-unit grid, fill, opacity. */
const BARS = [
  [17, 6, 24, 5.6, "#bfe6d6", 1],
  [11, 13.1, 15, 5.6, "#f7f8f8", 0.9],
  [8, 20.2, 11, 7.6, "#f7f8f8", 1],
  [11, 29.3, 15, 5.6, "#f7f8f8", 0.9],
  [17, 36.4, 24, 5.6, "#f7f8f8", 0.72],
] as const;

/**
 * The home-screen icon as a PNG, drawn at build time. The square has no rounded
 * corners and no transparency: iOS and Android cut their own shape out of it.
 */
export function appIcon(size: number) {
  const k = size / 48;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#0e6b54" }}>
        {BARS.map(([x, y, w, h, fill, opacity], i) => (
          <div key={i} style={{ position: "absolute", left: x * k, top: y * k, width: w * k, height: h * k, borderRadius: 1.4 * k, background: fill, opacity }} />
        ))}
      </div>
    ),
    { width: size, height: size },
  );
}
