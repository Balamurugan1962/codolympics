"use client";

/**
 * Paging a table, with the page in the URL.
 *
 * The page number is a query parameter and the controls are real links, so a
 * page of the audit log can be sent to someone, opened in a new tab, and found
 * again with the back button. An organiser explaining what happened at 14:30
 * pastes a link, not a description of which arrow to press.
 *
 * Every other query parameter is carried across, so paging does not discard
 * whatever filter is in the search box.
 */
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import * as React from "react";

import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

export const PAGE_SIZE = 25;

type Paged<T> = {
  /** The rows for this page. */
  rows: T[];
  page: number;
  pages: number;
  total: number;
  /** 1-based index of the first and last row shown, for "26–50 of 192". */
  from: number;
  to: number;
  param: string;
};

/**
 * Slice a list for the current page.
 *
 * Clamps rather than showing an empty table: filtering a 200-row log down to
 * three while sitting on page 5 should show the three, not nothing and no way
 * back except editing the URL.
 */
export function usePaged<T>(all: T[], { param = "page", size = PAGE_SIZE }: { param?: string; size?: number } = {}): Paged<T> {
  const search = useSearchParams();
  const total = all.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const asked = Number(search.get(param) ?? "1");
  const page = Number.isFinite(asked) ? Math.min(pages, Math.max(1, Math.trunc(asked))) : 1;
  const start = (page - 1) * size;
  return {
    rows: React.useMemo(() => all.slice(start, start + size), [all, start, size]),
    page,
    pages,
    total,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(total, start + size),
    param,
  };
}

/**
 * The bar under a table: what you are looking at, and the way to the rest.
 *
 * Renders nothing when everything fits on one page — a pager under six rows is
 * furniture.
 */
export function Pagination<T>({ paged, className, unit = "rows" }: { paged: Paged<T>; className?: string; unit?: string }) {
  const pathname = usePathname();
  const search = useSearchParams();

  const href = React.useCallback(
    (page: number) => {
      const next = new URLSearchParams(search.toString());
      if (page <= 1) next.delete(paged.param);
      else next.set(paged.param, String(page));
      const q = next.toString();
      return q ? `${pathname}?${q}` : pathname;
    },
    [pathname, search, paged.param],
  );

  if (paged.pages <= 1) return null;

  return (
    <nav className={cn("flex items-center gap-3 border-t py-2.5 text-[12px]", className)} aria-label="Pagination">
      <span className="text-muted-foreground">
        <span className="tabular-nums text-foreground">
          {paged.from}–{paged.to}
        </span>{" "}
        of <span className="tabular-nums text-foreground">{paged.total}</span> {unit}
      </span>
      <span className="ml-auto flex items-center gap-1">
        <Step href={href(1)} disabled={paged.page === 1} label="First page">
          <Icon.ChevronsLeft size={14} />
        </Step>
        <Step href={href(paged.page - 1)} disabled={paged.page === 1} label="Previous page">
          <Icon.ChevronLeft size={14} />
        </Step>
        <span className="px-2 text-muted-foreground">
          <span className="tabular-nums text-foreground">{paged.page}</span> / <span className="tabular-nums">{paged.pages}</span>
        </span>
        <Step href={href(paged.page + 1)} disabled={paged.page === paged.pages} label="Next page">
          <Icon.ChevronRight size={14} />
        </Step>
        <Step href={href(paged.pages)} disabled={paged.page === paged.pages} label="Last page">
          <Icon.ChevronsRight size={14} />
        </Step>
      </span>
    </nav>
  );
}

/** A link, unless there is nowhere to go — then the same box, inert. */
function Step({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: React.ReactNode }) {
  const shape = "flex size-7 items-center justify-center rounded-[4px] border transition-colors";
  if (disabled) {
    return (
      <span aria-hidden className={cn(shape, "border-transparent text-line-2")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} scroll={false} className={cn(shape, "border-line text-muted-foreground hover:border-line-2 hover:text-foreground")}>
      {children}
    </Link>
  );
}
