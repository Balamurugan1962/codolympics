"use client";

/**
 * A choice between a few named options, each with the sentence that explains
 * it. A select hides the explanation behind a click; these cards show it, which
 * matters when the option decides how a whole question is graded.
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Icon } from "../icons";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

export type Choice<T extends string> = {
  value: T;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  badge?: ReactNode;
};

export function ChoiceCards<T extends string>({
  value,
  onChange,
  options,
  cols = 3,
  size = "md",
  name,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Choice<T>[];
  cols?: 1 | 2 | 3 | 4 | 5;
  size?: "sm" | "md";
  name?: string;
  className?: string;
}) {
  const grid = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4", 5: "sm:grid-cols-2 lg:grid-cols-5" }[cols];
  return (
    <div role="radiogroup" aria-label={name} className={cn("grid grid-cols-1 gap-2", grid, className)}>
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
            className={cn(
              "relative flex items-start gap-3 rounded-md border bg-card text-left transition-[border-color,background-color,box-shadow] outline-none",
              "focus-visible:ring-[3px] focus-visible:ring-ring/30",
              size === "sm" ? "px-3 py-2.5" : "px-3.5 py-3",
              on ? "border-brand bg-brand-tint/50 ring-1 ring-brand/25" : "hover:border-line-2 hover:bg-muted/40",
              o.disabled && "cursor-not-allowed opacity-50",
            )}
          >
            {o.icon && <span className={cn("mt-0.5 shrink-0", on ? "text-brand-deep" : "text-faint")}>{o.icon}</span>}
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[13px] font-semibold">{o.label}</span>
                {o.badge}
              </span>
              {o.description && <span className="mt-1 block text-[11.5px] leading-relaxed text-muted-foreground">{o.description}</span>}
            </span>
            <span
              className={cn(
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                on ? "border-brand bg-brand text-white" : "border-line-2 bg-card",
              )}
            >
              {on && <Icon.Check size={10} strokeWidth={3.5} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** A compact inline switch between two or three modes, on Radix's toggle group. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "sm",
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; icon?: ReactNode }[];
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      aria-label={ariaLabel}
      // Radix clears the value when the active item is pressed again; a
      // segmented control has no "none" state, so an empty value is ignored.
      onValueChange={(v) => v && onChange(v as T)}
      className={cn("inline-flex gap-0.5 rounded-md border border-line-2 bg-muted p-0.5 shadow-none", className)}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className={cn(
            "rounded-sm border-0 font-semibold text-muted-foreground shadow-none",
            "data-[pressed]:bg-card data-[pressed]:text-foreground data-[pressed]:shadow-xs data-[pressed]:ring-1 data-[pressed]:ring-border",
            size === "sm" ? "h-6 min-w-0 px-2.5 text-[12px]" : "h-8 min-w-0 px-3 text-[13px]",
          )}
        >
          {o.icon}
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
