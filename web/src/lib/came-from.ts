"use client";

/**
 * The way back to wherever the reader came from.
 *
 * A record can be reached from several places: a submission from the Judge
 * monitor or from a participant's timeline, a hack timeline from the monitor,
 * the hack attempts table or the participant's page. The browser's back button
 * knows, but the page's own back link would otherwise always point at one of
 * them. So the link that opens a record carries where it was clicked
 * (`?from=`), and the record's back link uses it. The list is closed: an
 * address that is not a place we know is ignored, so a pasted link falls back
 * to the record's natural parent.
 */
import { usePathname, useSearchParams } from "next/navigation";

export type Place = { href: string; label: string };

const PLACES: [RegExp, string][] = [
  [/^\/admin\/judge$/, "Judge monitor"],
  [/^\/admin\/submissions$/, "Submissions"],
  [/^\/grade\/hacks$/, "Hack attempts"],
  [/^\/admin\/participants\/[^/]+\/(questions|hacks)\/[^/]+$/, "Timeline"],
  [/^\/admin\/participants\/[^/]+$/, "Participant"],
  [/^\/admin\/participants$/, "Participants"],
];

function placeOf(href: string | null): Place | null {
  if (!href) return null;
  const path = href.split("?")[0];
  const found = PLACES.find(([re]) => re.test(path));
  return found ? { href, label: found[1] } : null;
}

/** `href`, remembering that it was opened from `from`. */
export function fromHere(href: string, from: string): string {
  return `${href}${href.includes("?") ? "&" : "?"}from=${encodeURIComponent(from)}`;
}

/** The address of this page, to hand to the links that leave it. */
export function useHere(): string {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return search ? `${pathname}?${search}` : pathname;
}

/** Where the back link goes: the place the reader came from, or `fallback`. */
export function useCameFrom(fallback: Place): Place {
  const from = useSearchParams().get("from");
  return placeOf(from) ?? fallback;
}
