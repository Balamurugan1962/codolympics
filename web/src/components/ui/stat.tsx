import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Skeleton } from "./skeleton";

/**
 * A readout: a label, the figure, and one line saying what it means now.
 *
 * Not a tile. Four bordered boxes of large numerals across the top of a screen
 * is the one layout every generated dashboard reaches for, and it spends a
 * quarter of the page on four integers. These sit in a single strip ruled off
 * from the content, the way a status bar does, and the figure is monospace so
 * it stops shifting as it ticks.
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
    <div className={cn("min-w-0 px-4 py-2.5 first:pl-0", className)}>
      <div className="flex items-center gap-1.5">
        {icon && <span className="text-faint">{icon}</span>}
        <span className="truncate text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase">{label}</span>
      </div>
      <div className={cn("mt-1 truncate text-[19px] leading-none font-semibold num", color)}>{value}</div>
      {hint && <div className="mt-1 truncate text-[11.5px] leading-snug text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** The strip they sit in: ruled top and bottom, hairlines between. */
export function StatRow({ children, cols = 4, className }: { children: ReactNode; cols?: 2 | 3 | 4 | 5; className?: string }) {
  const map = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
    5: "sm:grid-cols-2 lg:grid-cols-5",
  };
  return (
    <div className={cn("grid grid-cols-2 divide-x divide-y border-b sm:divide-y-0", map[cols], className)}>{children}</div>
  );
}

/** A readout that has not arrived. Same height, so nothing jumps when it does. */
export function StatSkeleton() {
  return (
    <div className="px-4 py-2.5 first:pl-0" aria-hidden>
      <Skeleton className="h-2.5 w-20" />
      <Skeleton className="mt-2 h-4 w-12" />
      <Skeleton className="mt-2 h-2.5 w-24" />
    </div>
  );
}
