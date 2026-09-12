import type { ReactNode } from "react";

/** Never a blank area: what this is, why it is empty, and the way out. */
export function EmptyState({ icon, title, body, action, compact = false }: {
  icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode; compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 text-center ${compact ? "py-8" : "py-14"}`}>
      {icon && <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-page text-faint">{icon}</div>}
      <div className="text-[14px] font-semibold">{title}</div>
      {body && <div className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-muted">{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
