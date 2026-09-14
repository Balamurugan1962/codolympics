"use client";

/**
 * Markdown in, rendered statement out. Write and Preview are one click apart so
 * an author sees exactly what a participant will read — tables, code blocks and
 * lists included — before saving.
 */
import { useState } from "react";

import { cn } from "@/lib/utils";

import { Markdown } from "../markdown";
import { Segmented } from "./choice";

export function MarkdownEditor({
  value,
  onChange,
  rows = 10,
  placeholder,
  disabled,
  id,
  note = "Markdown · tables, code blocks and lists render",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  note?: string;
  className?: string;
}) {
  const [mode, setMode] = useState<"write" | "preview" | "split">("write");

  const editor = (
    <textarea
      id={id}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      spellCheck
      className="block w-full resize-y bg-transparent px-3.5 py-3 font-mono text-[12.5px] leading-relaxed placeholder:text-faint focus:outline-none disabled:text-faint"
    />
  );
  const preview = (
    <div className="min-h-32 px-4 py-3">
      {value.trim() ? <Markdown>{value}</Markdown> : <p className="text-[12.5px] text-faint">Nothing to preview yet.</p>}
    </div>
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-input bg-card shadow-xs transition-[border-color,box-shadow]",
        "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b bg-muted/50 px-2 py-1.5">
        <Segmented
          value={mode}
          onChange={setMode}
          aria-label="Editor mode"
          options={[
            { value: "write", label: "Write" },
            { value: "preview", label: "Preview" },
            { value: "split", label: "Split" },
          ]}
        />
        <span className="hidden pr-1 text-[11px] text-faint sm:block">{note}</span>
      </div>
      {mode === "write" && editor}
      {mode === "preview" && preview}
      {mode === "split" && (
        <div className="grid lg:grid-cols-2 lg:divide-x">
          {editor}
          <div className="border-t lg:border-t-0">{preview}</div>
        </div>
      )}
    </div>
  );
}
