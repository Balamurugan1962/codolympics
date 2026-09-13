import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Icon } from "../icons";

/** Facts in a grid: a quiet label over each value. For review steps and detail headers. */
export function Summary({ cols = 3, children, className }: { cols?: 2 | 3 | 4; children: ReactNode; className?: string }) {
  const grid = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[cols];
  return <dl className={cn("grid grid-cols-2 gap-x-6 gap-y-4", grid, className)}>{children}</dl>;
}

export function SummaryItem({
  label,
  children,
  mono = false,
  span = false,
}: {
  label: ReactNode;
  children?: ReactNode;
  mono?: boolean;
  span?: boolean;
}) {
  return (
    <div className={span ? "col-span-full" : "min-w-0"}>
      <dt className="text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">{label}</dt>
      <dd className={cn("mt-1 text-[13px] leading-snug", mono && "font-mono text-[12px]")}>{children ?? <span className="text-faint">—</span>}</dd>
    </div>
  );
}

/** A checklist of what is in place and what still is not. */
export function Checklist({ items }: { items: { ok: boolean; label: ReactNode; detail?: ReactNode }[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2.5 text-[13px]">
          <span
            className={cn(
              "mt-px flex size-4 shrink-0 items-center justify-center rounded-full",
              it.ok ? "bg-green text-white" : "bg-amber-tint text-amber ring-1 ring-amber-bg/40",
            )}
          >
            {it.ok ? <Icon.Check size={10} strokeWidth={3.5} /> : <Icon.Alert size={9} strokeWidth={3} />}
          </span>
          <span className="min-w-0">
            <span className={it.ok ? "" : "font-medium"}>{it.label}</span>
            {it.detail && <span className="block text-[12px] text-muted-foreground">{it.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
