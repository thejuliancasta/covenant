import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import { THEME_SCRIPT } from "@/components/theme";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "CostShield: cost protection for small businesses (simulation)",
  description: "Connect your books. CostShield finds the costs that markets move, says which can be protected and which cannot, and shows a funded, private payout on Solana devnet.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
      <body className="bg-bg font-sans text-ink">{children}</body>
    </html>
  );
}
