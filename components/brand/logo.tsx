/**
 * Covenant mark, "Stepped C": a C monogram built from the protection steps.
 * The ember top arm is the cap; the stepped back is the ladder of $0.25 plates.
 */
export function LogoMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden className={className}>
      <rect x="17" y="6" width="24" height="5.6" rx="1.4" fill="rgb(var(--jade))" />
      <rect x="11" y="13.1" width="15" height="5.6" rx="1.4" fill="rgb(var(--ink) / 0.9)" />
      <rect x="8" y="20.2" width="11" height="7.6" rx="1.4" fill="rgb(var(--ink))" />
      <rect x="11" y="29.3" width="15" height="5.6" rx="1.4" fill="rgb(var(--ink) / 0.9)" />
      <rect x="17" y="36.4" width="24" height="5.6" rx="1.4" fill="rgb(var(--ink) / 0.72)" />
    </svg>
  );
}

export function Logo({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark size={size} />
      <span className="text-[16px] font-[600] tracking-[-0.03em] text-ink">Covenant</span>
    </span>
  );
}
