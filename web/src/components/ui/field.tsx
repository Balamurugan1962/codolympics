"use client";

/**
 * Form layout.
 *
 * One rule everywhere: the label sits above its control, the explanation sits
 * below it, and an error replaces the explanation rather than appearing next to
 * it — two lines of grey and red under one input is noise.
 *
 * Controls are the width of their content. A year field is not as wide as a
 * problem statement, and a form where every box is full-width reads as a wall.
 */
import type { ReactNode } from "react";
import { useId } from "react";

import { cn } from "@/lib/utils";

import { Icon } from "../icons";
import { Input } from "./input";
import { Label } from "./label";

/** Label, control, and one line of help or one line of error beneath it. */
export function Field({
  label,
  hint,
  help,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {label && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <Label htmlFor={htmlFor} className="text-[12px] font-semibold text-foreground">
            {label}
            {required && <span className="text-destructive">*</span>}
          </Label>
          {hint && <span className="text-[11px] font-normal text-faint">{hint}</span>}
        </div>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] leading-snug font-medium text-destructive">
          <Icon.CircleAlert size={13} className="mt-px shrink-0" /> {error}
        </p>
      ) : help ? (
        <p className="mt-1 text-[11.5px] leading-snug text-faint">{help}</p>
      ) : null}
    </div>
  );
}

/** A labelled setting with an explanation beside it. The shape every settings page uses. */
export function SettingRow({
  label,
  description,
  children,
  className,
}: {
  label: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-3 border-b px-5 py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,300px)] sm:items-start sm:gap-6",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="text-[13px] font-semibold">{label}</div>
        {description && <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** A responsive grid for compact forms. */
export function FormGrid({ cols = 2, className, children }: { cols?: 1 | 2 | 3 | 4; className?: string; children: ReactNode }) {
  const map = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" };
  return <div className={cn("grid grid-cols-1 gap-4", map[cols], className)}>{children}</div>;
}

/** A search box with its icon and a clear button. Sits above every table. */
export function SearchInput({
  className,
  value,
  onClear,
  ...props
}: React.ComponentProps<"input"> & { onClear?: () => void }) {
  return (
    <div className={cn("relative", className)}>
      <Icon.Search size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint" />
      {/* The browser's own clear button and decoration are hidden by a plain
          rule (.search-plain in globals.css) rather than by an arbitrary
          variant, so one class covers both pseudo-elements. */}
      <Input type="search" value={value} className="search-plain pr-8 pl-8" {...props} />
      {onClear && value ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-sm p-1 text-faint hover:bg-muted hover:text-foreground"
        >
          <Icon.X size={13} />
        </button>
      ) : null}
    </div>
  );
}

/** A checkbox-shaped toggle with its label and optional explanation. */
export function CheckField({
  label,
  help,
  className,
  id,
  ...props
}: React.ComponentProps<"input"> & { label: ReactNode; help?: ReactNode }) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <input
        id={fieldId}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded-sm accent-primary"
        {...props}
      />
      <label htmlFor={fieldId} className="min-w-0 cursor-pointer select-none">
        <span className="text-[13px] font-medium">{label}</span>
        {help && <span className="mt-0.5 block text-[11.5px] leading-relaxed text-faint">{help}</span>}
      </label>
    </div>
  );
}
