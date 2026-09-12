"use client";

/**
 * Markdown in, rendered statement out. Write and Preview are one click
 * apart so an author sees exactly what a participant will read — tables,
 * code blocks and lists included — before saving.
 */
import { useState } from "react";

import { Markdown } from "../markdown";
import { Segmented } from "./choice";

export function MarkdownEditor({ value, onChange, rows = 10, placeholder, disabled, id }: {
  value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; disabled?: boolean; id?: string;
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
      className="block w-full resize-y bg-transparent px-3.5 py-3 font-mono text-[12.5px] leading-relaxed text-ink placeholder:text-faint focus:outline-none disabled:text-faint"
    />
  );
  const preview = (
    <div className="min-h-[8rem] px-4 py-3 text-[13.5px]">
      {value.trim() ? <Markdown>{value}</Markdown> : <p className="text-[12.5px] text-faint">Nothing to preview yet.</p>}
    </div>
  );
  return (
    <div className="overflow-hidden rounded-box border border-line-2 bg-card transition-[border-color,box-shadow] focus-within:border-green focus-within:ring-[3px] focus-within:ring-green/15">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-page/70 px-2 py-1.5">
        <Segmented value={mode} onChange={setMode} options={[{ value: "write", label: "Write" }, { value: "preview", label: "Preview" }, { value: "split", label: "Split" }]} />
        <span className="pr-1 text-[11px] text-faint">Markdown · tables, code blocks and lists render</span>
      </div>
      {mode === "write" && editor}
      {mode === "preview" && preview}
      {mode === "split" && (
        <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-line">
          {editor}
          <div className="border-t border-line lg:border-t-0">{preview}</div>
        </div>
      )}
    </div>
  );
}
