"use client";

/**
 * Where am I, what's next. The phase timeline, always visible under the
 * navbar: done steps ticked, the current one lit, the rest ahead.
 */
import { Icon } from "../icons";

export type Step = { key: string; label: string; short?: string };

export function Stepper({ steps, current, compact = false }: { steps: Step[]; current: string; compact?: boolean }) {
  const idx = Math.max(0, steps.findIndex((s) => s.key === current));
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="font-semibold text-ink">{steps[idx]?.label}</span>
        <span>· step {idx + 1} of {steps.length}</span>
      </div>
    );
  }
  return (
    <ol className="flex items-center gap-0 overflow-x-auto" aria-label="Contest progress">
      {steps.map((s, i) => {
        const state = i < idx ? "done" : i === idx ? "current" : "todo";
        return (
          <li key={s.key} className="flex shrink-0 items-center">
            <div className={`flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${
              state === "current" ? "bg-green-tint text-green-dark ring-1 ring-green/40" : state === "done" ? "text-muted" : "text-faint"}`}
              aria-current={state === "current" ? "step" : undefined}>
              <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                state === "done" ? "bg-green text-white" : state === "current" ? "bg-green-dark text-white" : "border border-line-2 bg-card"}`}>
                {state === "done" ? <Icon.Check size={10} strokeWidth={3} /> : i + 1}
              </span>
              <span className="hidden md:inline">{s.label}</span>
              <span className="md:hidden">{s.short ?? s.label}</span>
            </div>
            {i < steps.length - 1 && <span className={`mx-1 h-px w-4 ${i < idx ? "bg-green" : "bg-line-2"}`} />}
          </li>
        );
      })}
    </ol>
  );
}
