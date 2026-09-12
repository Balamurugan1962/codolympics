import type { ReactNode } from "react";

/** A number with a label. Optional icon and a "hint" line beneath for what it means right now. */
export function Stat({ label, value, hint, icon, tone = "ink" }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: "ink" | "green" | "red" | "amber" }) {
  const color = { ink: "text-ink", green: "text-green-dark", red: "text-red", amber: "text-[#9a6b00]" }[tone];
  return (
    <div className="flex items-start gap-3 rounded-box border border-line bg-card px-4 py-3">
      {icon && <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-box bg-page text-muted">{icon}</span>}
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">{label}</div>
        <div className={`mt-0.5 truncate text-2xl font-semibold tabular-nums leading-tight ${color}`}>{value}</div>
        {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
      </div>
    </div>
  );
}
