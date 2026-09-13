/**
 * The Codolympics mark.
 *
 * The genre convention for a coding platform — HackerRank's "h", LeetCode's
 * "L" — is a single monoline letter on a flat tile, and nothing else. So this
 * is a geometric "C": one stroke of constant weight, terminals cut square
 * rather than rounded, on a red tile. The square cuts are what stop it reading
 * as a generic circle, and they echo a bracket.
 *
 * No gradients, no inner detail. It has to survive a 16px browser tab and a
 * projector at the back of a hall, and a mark that needs its detail to be
 * recognised fails both.
 *
 * Inline SVG: no asset, no request, nothing to fail on a machine with no
 * internet. The colours are fixed rather than `currentColor`, so the mark is
 * identical on the navy chrome and on white.
 */
export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#d31f35" />
      <path d="M21.2 8.6A9 9 0 1 0 21.2 23.4" fill="none" stroke="#ffffff" strokeWidth="4" />
    </svg>
  );
}

/**
 * The mark and the wordmark together — that pair is the logo, and the tile on
 * its own is only ever a favicon or an avatar. The wordmark scales with the
 * mark so the lockup holds at any size.
 */
export function Logo({ inverse = true, size = 28, className = "" }: { inverse?: boolean; size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: size * 0.3 }}>
      <Mark size={size} />
      <span
        className={`font-bold tracking-[-0.02em] ${inverse ? "text-white" : "text-ink"}`}
        style={{ fontSize: Math.round(size * 0.62) }}
      >
        Cod<span className={inverse ? "text-brand-bright" : "text-brand"}>olympics</span>
      </span>
    </span>
  );
}
