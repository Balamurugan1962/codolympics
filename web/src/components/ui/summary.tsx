import type { ReactNode } from "react";

/** Facts in a grid: a quiet label over each value. For review steps and detail headers. */
export function Summary({ cols = 3, children, className = "" }: { cols?: 2 | 3 | 4; children: ReactNode; className?: string }) {
  const grid = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[cols];
  return <dl className={`grid grid-cols-2 gap-x-6 gap-y-4 ${grid} ${className}`}>{children}</dl>;
}

export function SummaryItem({ label, children, mono = false, span = false }: { label: ReactNode; children: ReactNode; mono?: boolean; span?: boolean }) {
  return (
    <div className={span ? "col-span-full" : "min-w-0"}>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">{label}</dt>
      <dd className={`mt-1 text-[13px] leading-snug text-ink ${mono ? "font-mono text-[12px]" : ""}`}>{children ?? <span className="text-faint">—</span>}</dd>
    </div>
  );
}

/** A checklist of what is in place and what still is not. */
export function Checklist({ items }: { items: { ok: boolean; label: ReactNode; detail?: ReactNode }[] }) {
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2.5 text-[13px]">
          <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${it.ok ? "bg-green text-white" : "bg-amber-tint text-[#8a6100] ring-1 ring-amber/40"}`}>
            {it.ok ? "✓" : "!"}
          </span>
          <span className="min-w-0">
            <span className={it.ok ? "text-ink" : "font-medium text-ink"}>{it.label}</span>
            {it.detail && <span className="block text-[12px] text-muted">{it.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
