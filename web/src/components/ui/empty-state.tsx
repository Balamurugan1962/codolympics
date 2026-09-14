import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Never a blank area. One line saying why it is empty, and the way out if
 * there is one — no icon in a circle, no paragraph. A page with nothing on it
 * is not an occasion.
 */
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
    <div className={cn("flex flex-col items-center justify-center px-6 text-center", compact ? "py-8" : "py-12", className)}>
      {icon && <span className="mb-2.5 text-line-2 [&_svg]:size-5">{icon}</span>}
      <div className="text-[13px] font-semibold">{title}</div>
      {body && <div className="mt-1 max-w-[46ch] text-[12px] leading-relaxed text-muted-foreground">{body}</div>}
      {action && <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}
