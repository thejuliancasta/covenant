import type { Config } from "tailwindcss";

/**
 * Theme tokens (light by default, dark opt-in). Every color is a CSS variable holding space-separated RGB
 * channels (defined in app/globals.css) so opacity modifiers work: `border-line/12`.
 * See docs/UI_DIRECTION.md for roles. Accent (jade) marks action, focus and
 * protection; heat marks market-driven cost and price above a trigger; cipher
 * marks encrypted or private state; rust marks refusal and loss.
 */
const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: c("bg"), sunken: c("sunken"), raised: c("raised"), panel: c("panel"), well: c("well"),
        ink: c("ink"), ink2: c("ink2"), muted: c("muted"), faint: c("faint"),
        // --line-k scales border opacity per theme (see app/globals.css).
        line: "rgb(var(--line) / calc(<alpha-value> * var(--line-k, 1)))",
        jade: { DEFAULT: c("jade"), deep: c("jade-deep"), ink: c("jade-ink") },
        accent: { DEFAULT: c("jade"), deep: c("jade-deep"), ink: c("jade-ink") },
        heat: { DEFAULT: c("heat"), deep: c("heat-deep") },
        cipher: { DEFAULT: c("cipher"), deep: c("cipher-deep") },
        rust: { DEFAULT: c("rust"), deep: c("rust-deep") },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      // Fine opacity steps so `border-line/12` etc. are generated (Tailwind's default scale is multiples of 5).
      opacity: { 4: "0.04", 6: "0.06", 8: "0.08", 12: "0.12", 14: "0.14", 16: "0.16", 18: "0.18", 22: "0.22", 28: "0.28", 35: "0.35", 45: "0.45", 55: "0.55", 65: "0.65", 85: "0.85" },
      borderRadius: { control: "10px", surface: "18px" },
      boxShadow: {
        ring: "inset 0 0 0 1px rgb(var(--ink) / 0.06)",
        lift: "0 18px 50px -24px rgb(var(--shadow) / 0.65), inset 0 0 0 1px rgb(var(--ink) / 0.06)",
      },
      transitionTimingFunction: { out: "cubic-bezier(.2,.8,.2,1)", spring: "cubic-bezier(.34,1.4,.64,1)" },
    },
  },
  plugins: [],
} satisfies Config;
