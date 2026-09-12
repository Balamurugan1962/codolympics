import type { ReactNode } from "react";

/**
 * A single number with a label and, where it helps, one line saying what it
 * means right now. Statistics without that line are trivia.
 */
export function Stat({ label, value, hint, icon, tone = "ink" }: {
  label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: "ink" | "green" | "red" | "amber";
}) {
  const color = { ink: "text-ink", green: "text-green-dark", red: "text-red", amber: "text-[#8a6100]" }[tone];
  return (
    <div className="rounded-box border border-line bg-card px-4 py-3.5">
      <div className="flex items-center gap-2">
        {icon && <span className="text-faint">{icon}</span>}
        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">{label}</span>
      </div>
      <div className={`mt-1.5 truncate text-[26px] font-semibold leading-none tabular-nums tracking-[-0.02em] ${color}`}>{value}</div>
      {hint && <div className="mt-1.5 text-[12px] leading-snug text-muted">{hint}</div>}
    </div>
  );
}

/** Stats sit in a row that wraps predictably. */
export function StatRow({ children, cols = 4 }: { children: ReactNode; cols?: 3 | 4 | 5 }) {
  const map = { 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4", 5: "sm:grid-cols-2 lg:grid-cols-5" };
  return <div className={`grid grid-cols-2 gap-3 ${map[cols]}`}>{children}</div>;
}
