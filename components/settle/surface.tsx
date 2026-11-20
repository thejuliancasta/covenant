import type { ReactNode } from "react";
import { cx } from "../ui";

/**
 * Linear-style surface for the settlement journey: a hairline border at /8, a lighter
 * 1px inner top edge, a flat near-black fill. Same props as ui.tsx `Card`, so screens can
 * import it as `Card`. `lift` adds the 1px hover lift for interactive surfaces.
 */
export const surface = "rounded-[12px] border border-line/8 bg-raised shadow-[inset_0_1px_0_rgb(255_255_255/0.045)]";

export function Panel({ children, className, pad = true, as: El = "section", lift }: { children: ReactNode; className?: string; pad?: boolean; as?: "section" | "div" | "article" | "li"; lift?: boolean }) {
  return (
    <El className={cx("min-w-0", surface, pad && "p-5 sm:p-6", lift && "transition-[border-color,transform] duration-150 ease-out hover:-translate-y-px hover:border-line/[0.12]", className)}>{children}</El>
  );
}
