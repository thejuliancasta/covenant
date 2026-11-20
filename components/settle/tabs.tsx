"use client";
import { useEffect, useRef, type KeyboardEvent } from "react";
import { LayoutGroup, motion } from "motion/react";
import { cx } from "../ui";
import { UI_SPRING } from "./motion";

/** Stable ids for a tab and its panel, so `aria-controls` and `aria-labelledby` line up. */
export const tabId = (base: string, i: number) => `${base}-tab-${i}`;
export const panelId = (base: string, i: number) => `${base}-panel-${i}`;

/**
 * Tab bar with a sliding indicator. Same geometry as the step navigation (14px shell,
 * 10px controls, 40px targets). Arrow keys, Home and End move between tabs; the bar
 * scrolls sideways on narrow screens instead of widening the page.
 */
export function Tabs<T extends string>({ tabs, value, onChange, label, base }: { tabs: readonly T[]; value: T; onChange: (t: T) => void; label: string; base: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = tabs.indexOf(value);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    refs.current[current]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [current]);
  const move = (i: number) => {
    const n = (i + tabs.length) % tabs.length;
    onChange(tabs[n]);
    refs.current[n]?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") { e.preventDefault(); move(current + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); move(current - 1); }
    else if (e.key === "Home") { e.preventDefault(); move(0); }
    else if (e.key === "End") { e.preventDefault(); move(tabs.length - 1); }
  };
  return (
    <div className="-ml-3 w-fit max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <LayoutGroup id={base}>
        <div role="tablist" aria-label={label} onKeyDown={onKey} className="flex w-max min-w-full gap-1">
          {tabs.map((t, i) => {
            const on = t === value;
            return (
              <button key={t} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" id={tabId(base, i)} aria-selected={on} aria-controls={panelId(base, i)} tabIndex={on ? 0 : -1}
                onClick={() => onChange(t)}
                className={cx("relative flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-control px-3 text-[13.5px] font-medium transition-[color,transform] duration-150 ease-out active:scale-[0.98]",
                  on ? "text-ink" : "text-muted hover:text-ink")}>
                {on && <motion.span layoutId="tab-mark" transition={UI_SPRING} aria-hidden className="absolute bottom-1 left-1/2 -ml-2 h-[2px] w-4 rounded-full bg-jade" />}
                <span className="relative">{t}</span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>
    </div>
  );
}
