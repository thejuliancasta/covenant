export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");

/** Shared geometry for the landing page (8 px grid; tokens from app/globals.css). */
export const wrap = "mx-auto w-full max-w-[1200px] px-[var(--page-gutter)]";

/** Surface: hairline border, a lighter 1 px inner top edge, no glow. */
export const surface = "rounded-[16px] border border-line/8 bg-raised shadow-[inset_0_1px_0_rgb(var(--ink)/0.06),0_24px_64px_-32px_rgb(var(--shadow)/0.7)]";
/** Hover: border brightens, lifts 1 px. */
export const lift = "transition-[transform,border-color] duration-200 ease-out hover:-translate-y-px hover:border-line/12";

export const h2 = "text-[32px] font-[540] leading-[1.06] tracking-[-0.028em] text-ink md:text-[44px]";
export const body = "text-[16px] leading-[1.6] text-muted md:text-[17px]";

export const btnPrimary =
  "group/btn inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-control bg-jade px-5 text-[15px] font-[550] text-jade-ink " +
  "shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_1px_2px_rgb(var(--shadow)/0.4)] transition-[background-color,transform] duration-150 ease-out hover:bg-jade/90 active:scale-[0.98]";
export const linkArrow = "group/btn inline-flex h-11 items-center gap-1.5 whitespace-nowrap px-1 text-[15px] font-[500] text-ink2 transition-colors duration-150 hover:text-ink";

export const usd0 = (x: number) => "$" + Math.round(x).toLocaleString("en-US");
export const usd2 = (x: number) => "$" + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const pct1 = (x: number) => (x * 100).toFixed(1) + "%";
const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ML = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const mon = (ym: string) => M[Number(ym.slice(5, 7)) - 1];
export const monYear = (ym: string, long = false) => `${(long ? ML : M)[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
