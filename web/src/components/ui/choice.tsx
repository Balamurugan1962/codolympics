"use client";

/**
 * A choice between a few named options, each with the sentence that
 * explains it. A select hides the explanation; these cards show it.
 */
import type { ReactNode } from "react";

import { Icon } from "../icons";

export type Choice<T extends string> = { value: T; label: ReactNode; description?: ReactNode; icon?: ReactNode; disabled?: boolean; badge?: ReactNode };

export function ChoiceCards<T extends string>({ value, onChange, options, cols = 3, size = "md", name }: {
  value: T; onChange: (v: T) => void; options: Choice<T>[]; cols?: 1 | 2 | 3 | 4; size?: "sm" | "md"; name?: string;
}) {
  const grid = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[cols];
  return (
    <div role="radiogroup" aria-label={name} className={`grid grid-cols-1 gap-2 ${grid}`}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={`relative flex items-start gap-3 rounded-box border text-left transition-[border-color,background-color,box-shadow] ${size === "sm" ? "px-3 py-2.5" : "px-3.5 py-3"} ${
              on ? "border-green bg-green-tint/60 ring-1 ring-green/30" : "border-line bg-card hover:border-line-2"} ${
              o.disabled ? "cursor-not-allowed opacity-50" : ""}`}
          >
            {o.icon && <span className={`mt-0.5 shrink-0 ${on ? "text-green-dark" : "text-faint"}`}>{o.icon}</span>}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className={`text-[13px] font-semibold ${on ? "text-ink" : "text-ink"}`}>{o.label}</span>
                {o.badge}
              </span>
              {o.description && <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted">{o.description}</span>}
            </span>
            <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${on ? "border-green bg-green text-white" : "border-line-2 bg-card"}`}>
              {on && <Icon.Check size={10} strokeWidth={3.5} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** A compact inline switch between two or three modes. */
export function Segmented<T extends string>({ value, onChange, options, size = "sm" }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex rounded-box border border-line-2 bg-page p-0.5" role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={o.value === value} onClick={() => onChange(o.value)}
          className={`rounded-[3px] font-semibold transition-colors ${size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3 py-1.5 text-[13px]"} ${
            o.value === value ? "bg-card text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
