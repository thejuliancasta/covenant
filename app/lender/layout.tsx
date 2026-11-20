import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CostShield: lender view (simulation)",
  description: "Read-only proof of a fleet's diesel cover and payouts, decrypted with viewing keys the fleet shared. Solana devnet, test dollars only.",
  robots: { index: false },
};

export default function LenderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
