"use client";

/**
 * Where am I, what's next — the nine phases of the contest, as a track.
 *
 * It used to be nine bordered chips separated by dashes, which read as nine
 * buttons rather than as one progression, and put every phase at the same
 * weight when only two matter: the one running and the one after it.
 *
 * So it is a line with a tick on it, the way a route map is drawn. The line
 * fills up to where you are, the current tick is the only thing wearing the
 * accent, and the labels sit under the ticks instead of inside boxes. Done
 * phases keep a tick so the sequence stays readable as a plan for the day.
 *
 * Every step takes an equal share of the width rather than its label's width,
 * so the spacing is even and nothing scrolls sideways.
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
    <ol className={cn("flex items-start", className)} aria-label="Contest progress">
      {steps.map((s, i) => {
        const state = i < idx ? "done" : i === idx ? "current" : "todo";
        return (
          <li key={s.key} className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5">
            {/* The track, drawn behind the tick and clipped at the ends. */}
            {i > 0 && <span className={cn("absolute top-[7px] right-1/2 left-0 h-px", i <= idx ? "bg-brand" : "bg-line-2")} />}
            {i < steps.length - 1 && (
              <span className={cn("absolute top-[7px] right-0 left-1/2 h-px", i < idx ? "bg-brand" : "bg-line-2")} />
            )}

            <span
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "relative z-10 flex size-[15px] items-center justify-center rounded-full text-[9px] font-bold transition-colors",
                state === "done" && "bg-brand text-white",
                state === "current" && "bg-brand text-white ring-4 ring-brand/20",
                state === "todo" && "border border-line-2 bg-card text-faint",
              )}
            >
              {state === "done" ? <Icon.Check size={9} strokeWidth={4} /> : i + 1}
            </span>

            <span
              className={cn(
                "max-w-full truncate px-1 text-[11.5px] leading-none",
                state === "current" && "font-semibold text-brand-deep",
                state === "done" && "text-muted-foreground",
                state === "todo" && "text-faint",
              )}
              title={s.label}
            >
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{s.short ?? s.label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
