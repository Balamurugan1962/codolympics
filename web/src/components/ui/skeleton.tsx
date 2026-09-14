import { cn } from "@/lib/utils";

/**
 * Loading placeholders.
 *
 * A skeleton is only worth showing if it is the shape of the thing that
 * arrives. A generic grey card in front of a table is worse than nothing: the
 * page settles once into the placeholder and then jumps again into a layout
 * that looks nothing like it, which reads as a glitch rather than as loading.
 *
 * So these mirror the real components — same card, same header band, same row
 * heights and column rhythm — and each page uses the one matching what it
 * renders.
 *
 * One `role="status"` on the wrapper and nothing readable inside: a screen
 * reader should hear "loading", not count forty empty boxes.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" className={cn("animate-pulse rounded-[3px] bg-border", className)} {...props} />;
}

/**
 * The wrapper every skeleton sits in.
 *
 * It is the layout element itself — no extra div inside — because wrapping the
 * children would break any grid or flex laid out on it, which is exactly the
 * kind of bug that makes a skeleton stop matching the thing it stands for.
 * The bars carry no text, so nothing here needs hiding from a screen reader
 * beyond the one label on this element.
 */
function Loading({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-label="Loading" aria-busy className={className}>
      {children}
    </div>
  );
}

/** Widths that repeat so rows do not look like a bar chart of random numbers. */
const CELL = ["w-16", "w-12", "w-14", "w-10", "w-16", "w-12"];

/**
 * A table that has not arrived: the header rule, then rows at the real row
 * height, with a wide first column and narrow figures after it.
 */
function TableSkeleton({ rows = 6, cols = 5, firstWide = true, bare = false }: { rows?: number; cols?: number; firstWide?: boolean; bare?: boolean }) {
  return (
    <Loading className={bare ? undefined : "overflow-hidden rounded-lg border bg-card shadow-xs"}>
      <div className="flex h-9 items-center gap-3 border-b bg-muted/60 px-4">
        <div className="min-w-0 flex-[2]">
          <Skeleton className={cn("h-2", firstWide ? "w-24" : "w-12")} />
        </div>
        {Array.from({ length: Math.max(0, cols - 1) }).map((_, c) => (
          // Each trailing column takes its own share of the width, so the
          // figures land where the real ones do instead of bunching at the
          // right edge.
          <div key={c} className="flex flex-1 justify-end">
            <Skeleton className={cn("h-2", CELL[c % CELL.length])} />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex h-11 items-center gap-3 border-b px-4 last:border-0">
          <div className="min-w-0 flex-[2]">{c0(r, firstWide)}</div>
          {Array.from({ length: Math.max(0, cols - 1) }).map((_, c) => (
            <div key={c} className="flex flex-1 justify-end">
              <Skeleton className={cn("h-2.5", CELL[(c + r) % CELL.length])} />
            </div>
          ))}
        </div>
      ))}
    </Loading>
  );
}

/** The first cell carries a title and, often, a mono id under it. */
function c0(r: number, wide: boolean) {
  if (!wide) return <Skeleton className="h-2.5 w-20" />;
  return (
    <div className="space-y-1.5">
      <Skeleton className={cn("h-2.5", r % 3 === 0 ? "w-56" : r % 3 === 1 ? "w-40" : "w-48")} />
      <Skeleton className="h-2 w-28" />
    </div>
  );
}

/** The readout tiles above a table, before the numbers land. */
function StatStripSkeleton({ cols = 4 }: { cols?: number }) {
  const map: Record<number, string> = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
    5: "sm:grid-cols-2 lg:grid-cols-5",
  };
  return (
    <Loading className={cn("grid grid-cols-2 gap-3", map[cols] ?? map[4])}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card px-4 py-3.5 shadow-xs">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-6 w-16" />
          <Skeleton className="mt-2.5 h-2.5 w-28" />
        </div>
      ))}
    </Loading>
  );
}

/** Hairline rows of prose: announcements, an audit trail, a result list. */
function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Loading className="overflow-hidden rounded-lg border bg-card px-5 shadow-xs">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-start gap-3 border-b py-3.5 last:border-0">
          <Skeleton className="mt-0.5 size-3.5 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className={cn("h-2.5", r % 2 ? "w-2/5" : "w-1/3")} />
            <Skeleton className={cn("h-2", r % 3 ? "w-4/5" : "w-3/5")} />
          </div>
          <Skeleton className="h-2 w-14 shrink-0" />
        </div>
      ))}
    </Loading>
  );
}

/** Settings: a label and its explanation on the left, a control on the right. */
function FieldsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <Loading className="overflow-hidden rounded-lg border bg-card px-5 shadow-xs">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-6 border-b py-4 last:border-0">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className={cn("h-2.5", r % 2 ? "w-40" : "w-32")} />
            <Skeleton className={cn("h-2", r % 3 ? "w-3/5" : "w-2/5")} />
          </div>
          <Skeleton className="h-8 w-32 shrink-0" />
        </div>
      ))}
    </Loading>
  );
}

/** A block of prose or a detail pane, where no stronger shape is known. */
function TextSkeleton({ lines = 4, className }: { lines?: number; className?: string }) {
  return (
    <Loading className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("mb-2.5 h-2.5", i === lines - 1 ? "w-2/5" : i % 2 ? "w-4/5" : "w-full")} />
      ))}
    </Loading>
  );
}

/**
 * What most administration screens are: an optional readout strip, the filter
 * bar, and a table. One component so every list page waits the same way.
 */
function PageSkeleton({ stats = 0, rows = 7, cols = 5, toolbar = true }: { stats?: number; rows?: number; cols?: number; toolbar?: boolean }) {
  return (
    <div className="space-y-5">
      {stats > 0 && <StatStripSkeleton cols={stats} />}
      <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
        {toolbar && (
          <Loading className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
            <Skeleton className="h-9 w-full max-w-[18rem]" />
            <Skeleton className="h-9 w-40" />
            <Skeleton className="ml-auto h-2.5 w-12" />
          </Loading>
        )}
        <TableSkeleton rows={rows} cols={cols} bare />
      </div>
    </div>
  );
}

export { Skeleton, TableSkeleton, StatStripSkeleton, ListSkeleton, FieldsSkeleton, TextSkeleton, PageSkeleton };
