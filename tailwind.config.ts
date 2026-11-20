import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F6F4EF", surface: "#FFFFFF", ink: "#15181B", muted: "#626970", faint: "#8B9197", line: "#E5E1D8",
        shield: { DEFAULT: "#0B5D4B", dark: "#084638", soft: "#E4F0EB", line: "#BFDCD1" },
        amber: { DEFAULT: "#9A5B06", soft: "#FAF0DC", line: "#EBD3A2" },
        rust: { DEFAULT: "#A8321F", soft: "#FAE9E5", line: "#EFC4BB" },
        slate: { DEFAULT: "#33475B", soft: "#EDF1F5", line: "#CFD8E1" },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
        display: ["'Instrument Serif'", "Georgia", "serif"],
      },
      boxShadow: { card: "0 1px 0 rgba(21,24,27,0.04), 0 1px 2px rgba(21,24,27,0.04)", lift: "0 10px 30px -12px rgba(21,24,27,0.18)" },
      keyframes: { rise: { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } } },
      animation: { rise: "rise 0.35s ease-out both" },
    },
  },
  plugins: [],
} satisfies Config;
