import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Skeleton } from "./skeleton";

/**
 * A single number with a label and, where it helps, one line saying what it
 * means right now. A statistic without that line is trivia.
 *
 * Sized as a status strip rather than as hero tiles. Four boxes of 26px
 * numerals across the top of every screen is the house style of dashboards
 * nobody reads; at 20px the row is scannable and still leaves the table below
 * it as the thing the page is actually about.
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
    info: "text-brand-deep",
  }[tone];
  return (
    <div className={cn("rounded-md border bg-card px-3.5 py-2.5", className)}>
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-faint">{icon}</span>}
        <span className="truncate text-[10.5px] font-semibold tracking-[0.07em] text-faint uppercase">{label}</span>
      </div>
      <div className={cn("mt-1.5 truncate text-[20px] leading-none font-semibold tracking-[-0.02em] tabular-nums", color)}>{value}</div>
      {hint && <div className="mt-1 truncate text-[11.5px] leading-snug text-muted-foreground">{hint}</div>}
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
  return <div className={cn("grid grid-cols-2 gap-2.5", map[cols], className)}>{children}</div>;
}

/** A Stat that has not arrived yet. Same box, same height, so nothing moves when it does. */
export function StatSkeleton() {
  return (
    <div className="rounded-md border bg-card px-3.5 py-2.5" aria-hidden>
      <Skeleton className="h-2.5 w-20" />
      <Skeleton className="mt-2.5 h-5 w-14" />
      <Skeleton className="mt-2 h-2.5 w-28" />
    </div>
  );
}
