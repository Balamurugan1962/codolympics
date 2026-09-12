/**
 * The Codolympics mark: a green tile with a bracket pair, the wordmark beside it.
 * Inline SVG so it needs no asset and no network.
 */
export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#00EA64" />
      <path d="M12.5 9 6.5 16l6 7" fill="none" stroke="#0E141E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.5 9l6 7-6 7" fill="none" stroke="#0E141E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="16" r="2.2" fill="#0E141E" />
    </svg>
  );
}

export function Logo({ inverse = true, size = 28 }: { inverse?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Mark size={size} />
      <span className={`text-[17px] font-bold tracking-tight ${inverse ? "text-white" : "text-ink"}`}>
        Cod<span className="text-green-bright">olympics</span>
      </span>
    </span>
  );
}
