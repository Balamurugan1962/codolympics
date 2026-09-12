"use client";

/** A short list of strings, one input per line, with add, remove and reorder. */
import { Icon } from "../icons";
import { Button } from "./button";
import { Input } from "./input";

export function StringListEditor({ items, onChange, placeholder, addLabel = "Add", numbered = true, max = 50, mono = false, disabled }: {
  items: string[]; onChange: (v: string[]) => void; placeholder?: (i: number) => string; addLabel?: string; numbered?: boolean; max?: number; mono?: boolean; disabled?: boolean;
}) {
  const set = (i: number, v: string) => onChange(items.map((x, j) => (j === i ? v : x)));
  const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= items.length) return; const n = [...items]; [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
  return (
    <div className="space-y-2">
      {items.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          {numbered && <span className="w-5 shrink-0 text-right text-[12px] font-semibold tabular-nums text-faint">{i + 1}.</span>}
          <Input value={v} disabled={disabled} className={mono ? "font-mono" : ""} placeholder={placeholder?.(i)} onChange={(e) => set(i, e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && i === items.length - 1 && items.length < max) { e.preventDefault(); onChange([...items, ""]); } }} />
          <Button size="sm" variant="ghost" aria-label="Move up" disabled={disabled || i === 0} onClick={() => move(i, -1)}>↑</Button>
          <Button size="sm" variant="ghost" aria-label="Move down" disabled={disabled || i === items.length - 1} onClick={() => move(i, 1)}>↓</Button>
          <Button size="sm" variant="ghost" aria-label={`Remove item ${i + 1}`} disabled={disabled} onClick={() => onChange(items.filter((_, j) => j !== i))}><Icon.X size={15} /></Button>
        </div>
      ))}
      {items.length < max && <Button size="sm" variant="secondary" disabled={disabled} icon={<Icon.Plus size={14} />} onClick={() => onChange([...items, ""])}>{addLabel}</Button>}
    </div>
  );
}
