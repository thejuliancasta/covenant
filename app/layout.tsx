import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import { THEME_SCRIPT } from "@/components/theme";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "CostShield: cost protection for small businesses (simulation)",
  description: "Connect your books. CostShield finds the costs that markets move, says which can be protected and which cannot, and shows a funded, private payout on Solana devnet.",
  // Home screen: with app/manifest.ts and app/apple-icon.tsx, the hosted app opens full-screen under its own icon and name.
  applicationName: "CostShield",
  appleWebApp: { capable: true, title: "CostShield", statusBarStyle: "default" },
  other: { "apple-mobile-web-app-capable": "yes" }, // older iOS reads this name; Next writes the newer mobile-web-app-capable
  formatDetection: { telephone: false }, // iOS must not turn figures into phone links
};

export const viewport: Viewport = { themeColor: "#f6f5f0" }; // the light page colour; light is the default theme

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body className="bg-bg font-sans text-ink">{children}</body>
    </html>
  );
}
