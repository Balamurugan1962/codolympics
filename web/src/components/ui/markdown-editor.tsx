"use client";

/**
 * Markdown in, rendered statement out. Write and Preview are one click apart so
 * an author sees exactly what a participant will read — tables, code blocks and
 * lists included — before saving.
 */
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { Markdown } from "../markdown";
import { imageToDataUri, joinStatement, nextImageName, splitStatement, widthOf, withWidth } from "@/lib/statement-images";

import { Segmented } from "./choice";

export function MarkdownEditor({
  value,
  onChange,
  rows = 10,
  placeholder,
  disabled,
  id,
  note = "Markdown · maths ($…$), tables, code blocks · paste or drop an image",
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
  const [problem, setProblem] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const { body, images } = splitStatement(value);

  async function addImages(files: File[]) {
    const pictures = files.filter((f) => f.type.startsWith("image/"));
    if (pictures.length === 0) return;
    setProblem(null);
    let nextBody = body;
    const nextImages = [...images];
    try {
      for (const file of pictures) {
        const uri = await imageToDataUri(file);
        const name = nextImageName(nextImages);
        nextImages.push({ name, uri });
        const at = area.current?.selectionStart ?? nextBody.length;
        const mark = `![Figure ${nextImages.length}][${name}]`;
        nextBody = `${nextBody.slice(0, at)}${mark}${nextBody.slice(at)}`;
      }
      const joined = joinStatement(nextBody, nextImages);
      if (joined.length > 200_000) throw new Error("Statements are limited to 200,000 characters, images included. Remove or shrink a picture.");
      onChange(joined);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "That picture could not be added.");
    }
  }

  function drop(next: typeof images) {
    onChange(joinStatement(body, next));
  }

  const editor = (
    <>
      <textarea
        id={id}
        ref={area}
        value={body}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(joinStatement(e.target.value, images))}
        onPaste={(e) => {
          const files = Array.from(e.clipboardData.files);
          if (files.some((f) => f.type.startsWith("image/"))) { e.preventDefault(); void addImages(files); }
        }}
        onDrop={(e) => {
          const files = Array.from(e.dataTransfer.files);
          if (files.some((f) => f.type.startsWith("image/"))) { e.preventDefault(); void addImages(files); }
        }}
        rows={rows}
        spellCheck
        className="block w-full resize-y bg-transparent px-3.5 py-3 font-mono text-[12.5px] leading-relaxed placeholder:text-faint focus:outline-none disabled:text-faint"
      />
      {(images.length > 0 || problem) && (
        <div className="flex flex-wrap items-center gap-2 border-t bg-muted/30 px-3 py-2">
          {images.map((img) => (
            <span key={img.name} className="relative inline-flex items-center gap-1.5 rounded-md border bg-card p-1 pr-2 text-[11.5px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.uri} alt={img.name} className="size-8 rounded object-cover" />
              <code>{img.name}</code>
              <input
                aria-label={`Width of ${img.name}`}
                title="Width in pixels (300) or a share of the statement (50%). Empty is the picture's own size."
                placeholder="width"
                disabled={disabled}
                defaultValue={widthOf(body, img.name)}
                onBlur={(e) => {
                  const next = withWidth(body, img.name, e.target.value);
                  if (next === null) { setProblem("A width is a number of pixels like 300, or a percentage like 50%."); return; }
                  setProblem(null);
                  onChange(joinStatement(next, images));
                }}
                className="h-6 w-16 rounded border bg-transparent px-1.5 text-[11.5px] placeholder:text-faint"
              />
              <button type="button" aria-label={`Remove ${img.name}`} disabled={disabled} className="ml-1 text-faint hover:text-destructive" onClick={() => drop(images.filter((i) => i.name !== img.name))}>×</button>
            </span>
          ))}
          {problem && <span className="text-[12px] text-destructive">{problem}</span>}
        </div>
      )}
    </>
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
        <div className="flex items-center gap-2">
          <input ref={picker} type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden onChange={(e) => { void addImages(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
          <button type="button" disabled={disabled} onClick={() => picker.current?.click()} className="rounded-md border bg-card px-2 py-1 text-[11.5px] font-semibold hover:bg-muted disabled:opacity-50">Add image</button>
          <span className="hidden pr-1 text-[11px] text-faint sm:block">{note}</span>
        </div>
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
