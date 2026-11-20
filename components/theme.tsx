"use client";
import { useEffect, useState } from "react";

/*
 * Light is the default. The choice is kept in localStorage and applied to <html data-theme>
 * before paint by THEME_SCRIPT (inlined in app/layout.tsx), so there is no flash.
 */
export const THEME_KEY = "costshield-theme";
export const THEME_SCRIPT = `try{if(localStorage.getItem("${THEME_KEY}")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.dataset.theme === "dark"); }, []);
  const flip = () => {
    const next = !dark;
    setDark(next);
    if (next) document.documentElement.dataset.theme = "dark"; else delete document.documentElement.dataset.theme;
    try { localStorage.setItem(THEME_KEY, next ? "dark" : "light"); } catch { /* private browsing: the choice lasts for this page only */ }
  };
  return (
    <button type="button" onClick={flip} aria-pressed={dark} aria-label={dark ? "Dark theme on. Switch to light mode" : "Light theme on. Switch to dark mode"} title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={`inline-flex h-8 items-center gap-2 rounded-[6px] border border-line/[0.12] px-2.5 text-[12px] font-[510] text-ink2 transition-[color,border-color] duration-150 ease-out hover:border-line/[0.24] hover:text-ink ${className}`}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        {dark
          ? <path d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          : <><circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" /><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></>}
      </svg>
      {dark ? "Dark" : "Light"}
    </button>
  );
}
