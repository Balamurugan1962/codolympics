"use client";

/**
 * Where am I, what's next. The contest timeline that sits under the navbar all
 * day: finished phases ticked and quiet, the live one lit, the rest ahead in
 * grey. Connectors fill in behind the current step so progress reads at a
 * glance from the back of the hall.
 */
import { cn } from "@/lib/utils";

import { Icon } from "../icons";

export type Step = { key: string; label: string; short?: string };

export function Stepper({ steps, current, compact = false, className }: { steps: Step[]; current: string; compact?: boolean; className?: string }) {
  const idx = Math.max(0, steps.findIndex((s) => s.key === current));

  if (compact) {
    return (
      <div className={cn("flex items-center gap-1.5 text-[12px] text-muted-foreground", className)}>
        <span className="font-semibold text-foreground">{steps[idx]?.label}</span>
        <span className="text-faint">
          step {idx + 1} of {steps.length}
        </span>
      </div>
    );
  }

  return (
    <ol className={cn("pane flex items-center overflow-x-auto", className)} aria-label="Contest progress">
      {steps.map((s, i) => {
        const state = i < idx ? "done" : i === idx ? "current" : "todo";
        return (
          <li key={s.key} className="flex shrink-0 items-center">
            <div
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-none px-2 py-1 text-[12px] font-semibold transition-colors",
                state === "current" && "bg-brand-tint text-brand-dark ring-1 ring-brand/30 ring-inset",
                state === "done" && "text-muted-foreground",
                state === "todo" && "text-faint",
              )}
            >
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-full text-[9px] font-bold",
                  state === "done" && "bg-brand text-white",
                  state === "current" && "bg-brand-dark text-white",
                  state === "todo" && "border border-line-2 bg-card text-faint",
                )}
              >
                {state === "done" ? <Icon.Check size={10} strokeWidth={3.5} /> : i + 1}
              </span>
              <span className="hidden md:inline">{s.label}</span>
              <span className="md:hidden">{s.short ?? s.label}</span>
            </div>
            {i < steps.length - 1 && <span className={cn("mx-1 h-px w-4 shrink-0", i < idx ? "bg-brand/50" : "bg-line-2")} />}
          </li>
        );
      })}
    </ol>
  );
}
