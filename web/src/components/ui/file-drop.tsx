"use client";

/**
 * A drop zone for one file. Drag a zip onto it or browse; once chosen it shows
 * the name and size, and can be replaced or removed.
 */
import { useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { Icon } from "../icons";
import { Button } from "./button";

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function FileDrop({
  file,
  onFile,
  accept = ".zip",
  label = "Drop a .zip here, or browse",
  hint,
  disabled,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  accept?: string;
  label?: string;
  hint?: string;
  disabled?: boolean;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-md border bg-card px-3.5 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-tint text-brand-deep">
          <Icon.Check size={16} strokeWidth={3} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold">{file.name}</div>
          <div className="text-[11.5px] text-faint">{formatBytes(file.size)}</div>
        </div>
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => input.current?.click()}>
          Replace
        </Button>
        <Button size="icon-sm" variant="ghost" disabled={disabled} aria-label="Remove file" onClick={() => onFile(null)}>
          <Icon.X size={15} />
        </Button>
        <input ref={input} id={id} type="file" accept={accept} className="sr-only" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      </div>
    );
  }

  return (
    <label
      htmlFor={id}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (disabled) return;
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-4 py-9 text-center transition-colors",
        over ? "border-brand bg-brand-tint/60" : "border-line-2 bg-muted/40 hover:border-brand hover:bg-brand-tint/30",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-card text-faint ring-1 ring-border">
        <Icon.Upload size={18} />
      </span>
      <span className="mt-1 text-[13px] font-semibold">{label}</span>
      {hint && <span className="text-[11.5px] text-faint">{hint}</span>}
      <input ref={input} id={id} type="file" accept={accept} className="sr-only" disabled={disabled} onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
    </label>
  );
}
