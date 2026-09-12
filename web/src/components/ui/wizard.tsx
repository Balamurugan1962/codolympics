"use client";

/**
 * Multi-step authoring. A rail of numbered steps on the left, one step's
 * form on the right, and a footer that always says what happens next.
 * Steps already visited can be jumped to; the ones ahead cannot, so a form
 * is never submitted with a step nobody looked at.
 */
import type { ReactNode } from "react";

import { Icon } from "../icons";

export type WizardStep = { key: string; label: string; hint?: string; state?: "done" | "error" | "todo" };

export function WizardSteps({ steps, current, onSelect, reachable }: {
  steps: WizardStep[]; current: number; onSelect: (i: number) => void; reachable: (i: number) => boolean;
}) {
  return (
    <ol className="flex min-w-0 max-w-full gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0" aria-label="Steps">
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
              className={`flex w-full items-center gap-3 rounded-box px-3 py-2.5 text-left transition-colors ${
                active ? "bg-card text-ink shadow-sm ring-1 ring-line" : can ? "text-muted hover:bg-card/70 hover:text-ink" : "cursor-default text-faint"}`}
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                state === "error" ? "bg-red text-white" : active ? "bg-navy text-white" : state === "done" ? "bg-green text-white" : "border border-line-2 bg-card text-faint"}`}>
                {state === "error" ? "!" : state === "done" && !active ? <Icon.Check size={12} strokeWidth={3} /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block whitespace-nowrap text-[13px] font-semibold leading-tight">{s.label}</span>
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
export function WizardLayout({ steps, current, onSelect, reachable, aside, footer, children }: {
  steps: WizardStep[]; current: number; onSelect: (i: number) => void; reachable: (i: number) => boolean;
  aside?: ReactNode; footer: ReactNode; children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[224px_minmax(0,1fr)] lg:gap-8">
      <aside className="min-w-0 lg:sticky lg:top-[72px] lg:self-start">
        <WizardSteps steps={steps} current={current} onSelect={onSelect} reachable={reachable} />
        {aside && <div className="mt-5 hidden lg:block">{aside}</div>}
      </aside>
      <div className="min-w-0">
        <div className="space-y-4" key={steps[current]?.key}>{children}</div>
        <div className="sticky bottom-0 z-20 mt-5 -mb-6 border-t border-line bg-page/95 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">{footer}</div>
        </div>
      </div>
    </div>
  );
}

/** A short note on the rail — what this wizard produces and where it goes next. */
export function WizardNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-box border border-line bg-card px-3.5 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">{title}</div>
      <div className="mt-1.5 text-[12px] leading-relaxed text-muted">{children}</div>
    </div>
  );
}
