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

/**
 * A titled card with nothing in it yet. The band, the title and the one line of
 * description are real structure — they are in the same place when the content
 * lands — so only the body is left to the caller.
 */
function SectionSkeleton({ children, lines = 2, className }: { children?: React.ReactNode; lines?: number; className?: string }) {
  return (
    <Loading className={cn("overflow-hidden rounded-lg border bg-card shadow-xs", className)}>
      <div className="border-b px-5 py-4">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-2 h-2.5 w-64" />
      </div>
      {children ?? (
        <div className="space-y-2.5 p-5">
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton key={i} className={cn("h-2.5", i % 2 ? "w-3/5" : "w-4/5")} />
          ))}
        </div>
      )}
    </Loading>
  );
}

/**
 * The phase track, which is the first thing an organiser looks at and so the
 * first thing that must not move when it arrives: equal-width ticks on a line,
 * labels underneath, exactly as Stepper draws them.
 */
function StepperSkeleton({ steps = 9 }: { steps?: number }) {
  return (
    <div className="flex items-start" aria-hidden>
      {Array.from({ length: steps }).map((_, i) => (
        <div key={i} className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5">
          {i > 0 && <span className="absolute top-[7px] right-1/2 left-0 h-px bg-border" />}
          {i < steps - 1 && <span className="absolute top-[7px] right-0 left-1/2 h-px bg-border" />}
          <Skeleton className="relative z-10 size-[15px] rounded-full" />
          <Skeleton className="h-2 w-12" />
        </div>
      ))}
    </div>
  );
}

/** The label-over-value grid that heads a detail pane. */
function SummarySkeleton({ items = 6, cols = 3 }: { items?: number; cols?: 2 | 3 | 4 }) {
  const grid = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[cols];
  return (
    <div className={cn("grid grid-cols-2 gap-x-6 gap-y-4", grid)} aria-hidden>
      {Array.from({ length: items }).map((_, i) => (
        <div key={i}>
          <Skeleton className="h-2 w-16" />
          <Skeleton className="mt-1.5 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

/**
 * A record behind tabs: the title, the tab strip, then whatever the first tab
 * holds. Used by the problem, puzzle, hacking-question and participant pages,
 * which all open on a tab and used to wait as four bars of fake prose.
 */
function DetailSkeleton({ tabs = 3, stats = 0, children }: { tabs?: number; stats?: number; children?: React.ReactNode }) {
  return (
    <Loading>
      <div className="mb-6">
        <Skeleton className="h-2.5 w-28" />
        <Skeleton className="mt-3 h-6 w-72" />
        <Skeleton className="mt-2.5 h-2.5 w-96 max-w-full" />
      </div>
      {stats > 0 && (
        <div className={cn("mb-5 grid grid-cols-2 gap-3", stats >= 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3")}>
          {Array.from({ length: stats }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card px-4 py-3.5 shadow-xs">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-3 h-6 w-16" />
              <Skeleton className="mt-2.5 h-2.5 w-24" />
            </div>
          ))}
        </div>
      )}
      <div className="mb-5 flex items-center gap-6 border-b pb-2.5">
        {Array.from({ length: tabs }).map((_, i) => (
          <Skeleton key={i} className={cn("h-2.5", i === 0 ? "w-20" : i === 1 ? "w-28" : "w-16")} />
        ))}
      </div>
      {children ?? <SectionSkeleton lines={3} />}
    </Loading>
  );
}

/**
 * The competitor's one-question-at-a-time screens: the rail of questions on the
 * left, the question card on the right. Section A and Section B both wait this
 * way, instead of a spinner in the middle of an empty page.
 */
function ContestSkeleton({ rail = 7, code = false }: { rail?: number; code?: boolean }) {
  return (
    <Loading className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <Skeleton className="h-2 w-28" />
          <Skeleton className="mt-1.5 h-2.5 w-24" />
        </div>
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
          <div className="border-b px-4 py-3">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="mt-2.5 h-1.5 w-full rounded" />
          </div>
          <div className="space-y-1 p-2">
            {Array.from({ length: rail }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2">
                <Skeleton className="size-2 shrink-0 rounded-full" />
                <Skeleton className={cn("h-2.5", i % 3 === 0 ? "w-32" : i % 3 === 1 ? "w-24" : "w-28")} />
                <Skeleton className="ml-auto h-2 w-5" />
              </div>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border bg-card shadow-xs">
          <div className="border-b px-5 py-4">
            <Skeleton className="h-2 w-36" />
            <Skeleton className="mt-2 h-4 w-56" />
          </div>
          {code ? (
            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
              <div className="space-y-2.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className={cn("h-2.5", i % 2 ? "w-3/5" : "w-full")} />
                ))}
              </div>
              <Skeleton className="h-[min(62vh,700px)] rounded-md bg-navy/80" />
            </div>
          ) : (
            <div className="space-y-3 p-5">
              <Skeleton className="h-2.5 w-4/5" />
              <Skeleton className="h-2.5 w-3/5" />
              <div className="mt-5 space-y-2.5 rounded-md border bg-muted/40 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full rounded-md bg-card" />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Loading>
  );
}

export {
  Skeleton,
  TableSkeleton,
  StatStripSkeleton,
  ListSkeleton,
  PageSkeleton,
  SectionSkeleton,
  StepperSkeleton,
  SummarySkeleton,
  DetailSkeleton,
  ContestSkeleton,
};
