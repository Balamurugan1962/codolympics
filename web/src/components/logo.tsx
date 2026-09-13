/**
 * The Codolympics mark.
 *
 * A "C" cut from a rounded tile, with the gap closed by a chevron — the C of
 * Codolympics and the `<` of code in one shape — and a filled diamond at the
 * centre for the lot under the hammer. Geometric rather than illustrative
 * because it has to survive 20px in a browser tab and a projector at the back
 * of a hall, and it reads as a silhouette either way.
 *
 * Inline SVG: no asset, no request, nothing to fail on a machine with no
 * internet. `currentColor` is deliberately not used — the mark keeps its own
 * colours so it looks the same on the navy chrome and on white.
 */
export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#d31f35" />
      {/* The C: an arc open to the right. */}
      <path
        d="M22.2 10.4A8 8 0 1 0 22.2 21.6"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      {/* The chevron that closes it — the `<` of code, pointing into the gap. */}
      <path d="M19.4 12.6 23.4 16l-4 3.4" fill="none" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      {/* The lot on the block. */}
      <path d="M16 13.6 18.4 16 16 18.4 13.6 16Z" fill="#ffffff" />
    </svg>
  );
}

export function Logo({ inverse = true, size = 28 }: { inverse?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Mark size={size} />
      <span className={`text-[17px] font-bold tracking-[-0.02em] ${inverse ? "text-white" : "text-ink"}`}>
        Cod<span className={inverse ? "text-brand-bright" : "text-brand"}>olympics</span>
      </span>
    </span>
  );
}
