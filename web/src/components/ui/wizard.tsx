"use client";

/**
 * Multi-step authoring. A rail of numbered steps on the left, one step's form
 * on the right, and a footer that always says what happens next.
 *
 * Steps already visited can be jumped to; the ones ahead cannot, so a package
 * is never published with a step nobody looked at. A step only reports an
 * error once it has been reached — a brand-new form covered in red is telling
 * the author off for not having started.
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Icon } from "../icons";

export type WizardStep = { key: string; label: string; hint?: string; state?: "done" | "error" | "todo" };

export function WizardSteps({
  steps,
  current,
  onSelect,
  reachable,
}: {
  steps: WizardStep[];
  current: number;
  onSelect: (i: number) => void;
  reachable: (i: number) => boolean;
}) {
  return (
    <ol className="pane flex max-w-full min-w-0 gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0" aria-label="Steps">
      {steps.map((s, i) => {
        const active = i === current;
        const state = s.state ?? (i < current ? "done" : "todo");
        const can = reachable(i);
        return (
          <li key={s.key} className="shrink-0">
            <button
              type="button"
              disabled={!can}
              aria-current={active ? "step" : undefined}
              onClick={() => onSelect(i)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
                active
                  ? "bg-card text-foreground shadow-xs ring-1 ring-border"
                  : can
                    ? "text-muted-foreground hover:bg-card/70 hover:text-foreground"
                    : "cursor-default text-faint",
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  state === "error"
                    ? "bg-destructive text-white"
                    : active
                      ? "bg-navy text-white"
                      : state === "done"
                        ? "bg-brand text-white"
                        : "border border-line-2 bg-card text-faint",
                )}
              >
                {state === "error" ? "!" : state === "done" && !active ? <Icon.Check size={12} strokeWidth={3} /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] leading-tight font-semibold whitespace-nowrap">{s.label}</span>
                {s.hint && <span className="mt-0.5 hidden text-[11.5px] leading-snug text-faint lg:block">{s.hint}</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** The rail, the step body, and a sticky footer for navigation and the primary action. */
export function WizardLayout({
  steps,
  current,
  onSelect,
  reachable,
  aside,
  footer,
  children,
}: {
  steps: WizardStep[];
  current: number;
  onSelect: (i: number) => void;
  reachable: (i: number) => boolean;
  aside?: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[236px_minmax(0,1fr)] lg:gap-8">
      <aside className="min-w-0 lg:sticky lg:top-[72px] lg:self-start">
        <WizardSteps steps={steps} current={current} onSelect={onSelect} reachable={reachable} />
        {aside && <div className="mt-5 hidden lg:block">{aside}</div>}
      </aside>
      <div className="min-w-0">
        {/* Keyed so moving between steps remounts the body and resets scroll-in animations. */}
        <div className="space-y-4" key={steps[current]?.key}>
          {children}
        </div>
        <div className="sticky bottom-0 z-20 mt-5 -mb-6 border-t bg-background/95 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">{footer}</div>
        </div>
      </div>
    </div>
  );
}

/** A short note on the rail — what this wizard produces and where it goes next. */
export function WizardNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border bg-card px-3.5 py-3 shadow-xs">
      <div className="text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">{title}</div>
      <div className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}
