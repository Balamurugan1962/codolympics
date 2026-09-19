import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Never a blank area: what this is, why it is empty, and the way out. */
export function EmptyState({
  icon,
  title,
  body,
  action,
  compact = false,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 text-center animate-rise-in", compact ? "py-9" : "py-14", className)}>
      {icon && (
        <div className="mb-3.5 flex size-12 items-center justify-center rounded-full border border-border/60 bg-gradient-to-b from-brand-tint to-card text-faint shadow-xs [&_svg]:size-[18px]">
          {icon}
        </div>
      )}
      <div className="text-[14px] font-semibold tracking-[-0.01em]">{title}</div>
      {body && <div className="mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">{body}</div>}
      {action && <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}
