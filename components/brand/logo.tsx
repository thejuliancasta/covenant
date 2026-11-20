/**
 * CostShield mark: three pressure columns rising toward an ember cap they never cross.
 * Abstract, geometric, and the product in one shape (costs held under a ceiling).
 */
export function LogoMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" aria-hidden className={className}>
      <rect x="3" y="4.5" width="22" height="3" rx="1.5" fill="rgb(var(--jade))" />
      <rect x="4.5" y="16" width="5" height="8.5" rx="1.2" fill="rgb(var(--ink) / 0.38)" />
      <rect x="11.5" y="12.5" width="5" height="12" rx="1.2" fill="rgb(var(--ink) / 0.62)" />
      <rect x="18.5" y="10" width="5" height="14.5" rx="1.2" fill="rgb(var(--ink) / 0.92)" />
    </svg>
  );
}

export function Logo({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark size={size} />
      <span className="text-[16px] font-[600] tracking-[-0.03em] text-ink">CostShield</span>
    </span>
  );
}
