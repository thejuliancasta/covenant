"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme";
import { cx, wrap } from "./kit";

const LINKS = [
  { href: "#product", label: "Product" },
  { href: "#how", label: "How it works" },
  { href: "#technology", label: "Technology" },
  { href: "#security", label: "Security" },
  { href: "#faq", label: "FAQ" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header className={cx(
      "sticky top-0 z-50 border-b backdrop-blur-xl backdrop-saturate-150 transition-[background-color,border-color] duration-200",
      scrolled ? "border-line/8 bg-bg/75" : "border-transparent bg-bg/0",
    )}>
      <nav aria-label="Main" className={cx(wrap, "flex h-16 items-center gap-8")}>
        <Link href="/" aria-label="Covenant home" className="-ml-1 rounded-control px-1 py-1"><Logo size={20} /></Link>
        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="rounded-control px-3 py-2 text-[13px] font-[500] text-muted transition-colors duration-150 hover:text-ink">{l.label}</a>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/app"
            className="inline-flex h-8 items-center rounded-control border border-line/10 bg-well px-3 text-[13px] font-[550] text-ink shadow-[inset_0_1px_0_rgb(var(--ink)/0.08)] transition-[background-color,border-color] duration-150 hover:border-line/16 hover:bg-panel"
          >Open app</Link>
        </div>
      </nav>
    </header>
  );
}
