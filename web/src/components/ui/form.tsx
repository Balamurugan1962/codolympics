/**
 * Form layout. Settings screens read as "what this is" on the left and the
 * controls on the right; compact forms use FormGrid. Labels sit above their
 * control, hints below it, and every control is the width of its content —
 * a year field is not as wide as a statement.
 */
import type { ReactNode } from "react";

/** A labelled setting with an explanation, side by side on wide screens. */
export function SettingRow({ label, description, children, className = "" }: { label: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`grid gap-3 border-b border-line px-5 py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,320px)] sm:gap-6 ${className}`}>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold">{label}</div>
        {description && <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** A responsive grid for compact forms. */
export function FormGrid({ cols = 2, className = "", children }: { cols?: 1 | 2 | 3 | 4; className?: string; children: ReactNode }) {
  const map = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" };
  return <div className={`grid grid-cols-1 gap-4 ${map[cols]} ${className}`}>{children}</div>;
}
