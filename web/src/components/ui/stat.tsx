import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Skeleton } from "./skeleton";

/**
 * A single number with a label and, where it helps, one line saying what it
 * means right now. A statistic without that line is trivia.
 */
export function Stat({
  label,
  value,
  hint,
  icon,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "success" | "destructive" | "warning" | "info";
  className?: string;
}) {
  const color = {
    default: "text-foreground",
    success: "text-green-dark",
    destructive: "text-destructive",
    warning: "text-amber",
    info: "text-blue",
  }[tone];
  return (
    <div className={cn("min-w-0 px-4 py-3", className)}>
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-faint">{icon}</span>}
        <span className="truncate text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">{label}</span>
      </div>
      <div className={cn("mt-2 truncate text-[26px] leading-none font-semibold tracking-[-0.02em] tabular-nums", color)}>{value}</div>
      {hint && <div className="mt-1.5 truncate text-[12px] leading-snug text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** Stats sit in a row that wraps predictably. */
export function StatRow({ children, cols = 4, className }: { children: ReactNode; cols?: 2 | 3 | 4 | 5; className?: string }) {
  const map = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
    5: "sm:grid-cols-2 lg:grid-cols-5",
  };
  // One bordered strip divided by rules: a readout panel, not a row of cards.
  return <div className={cn("grid grid-cols-2 divide-x divide-y divide-border border bg-card sm:divide-y-0", map[cols], className)}>{children}</div>;
}

/** A Stat that has not arrived yet. Same box, same height, so nothing moves when it does. */
export function StatSkeleton() {
  return (
    <div className="px-4 py-3" aria-hidden>
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-3 h-6 w-16" />
      <Skeleton className="mt-2.5 h-2.5 w-28" />
    </div>
  );
}
