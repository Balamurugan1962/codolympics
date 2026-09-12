"use client";

/**
 * A drop zone for one file. Drag a zip onto it or browse; once chosen it
 * shows the name and size, and can be replaced or removed.
 */
import { useId, useRef, useState } from "react";

import { Icon } from "../icons";
import { Button } from "./button";

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function FileDrop({ file, onFile, accept = ".zip", label = "Drop a .zip here, or browse", hint, disabled }: {
  file: File | null; onFile: (f: File | null) => void; accept?: string; label?: string; hint?: string; disabled?: boolean;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-box border border-line bg-card px-3.5 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-box bg-green-tint text-green-dark"><Icon.Check size={16} strokeWidth={3} /></span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold">{file.name}</div>
          <div className="text-[11.5px] text-faint">{formatBytes(file.size)}</div>
        </div>
        <Button size="sm" variant="secondary" disabled={disabled} onClick={() => input.current?.click()}>Replace</Button>
        <Button size="sm" variant="ghost" disabled={disabled} aria-label="Remove file" onClick={() => onFile(null)}><Icon.X size={15} /></Button>
        <input ref={input} id={id} type="file" accept={accept} className="sr-only" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      </div>
    );
  }

  return (
    <label
      htmlFor={id}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (disabled) return; const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-box border border-dashed px-4 py-8 text-center transition-colors ${
        over ? "border-green bg-green-tint/50" : "border-line-2 bg-page/40 hover:border-green hover:bg-green-tint/30"} ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-faint ring-1 ring-line"><Icon.Upload size={18} /></span>
      <span className="mt-1 text-[13px] font-semibold text-ink">{label}</span>
      {hint && <span className="text-[11.5px] text-faint">{hint}</span>}
      <input ref={input} id={id} type="file" accept={accept} className="sr-only" disabled={disabled} onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
    </label>
  );
}
