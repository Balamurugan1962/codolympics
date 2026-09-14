"use client";

/** A short list of strings, one input per line, with add, remove and reorder. */
import { Icon } from "../icons";
import { Button } from "./button";
import { Input } from "./input";

export function StringListEditor({
  items,
  onChange,
  placeholder,
  addLabel = "Add",
  numbered = true,
  max = 50,
  mono = false,
  disabled,
}: {
  items: string[];
  onChange: (v: string[]) => void;
  placeholder?: (i: number) => string;
  addLabel?: string;
  numbered?: boolean;
  max?: number;
  mono?: boolean;
  disabled?: boolean;
}) {
  const set = (i: number, v: string) => onChange(items.map((x, j) => (j === i ? v : x)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const n = [...items];
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };

  return (
    <div className="space-y-2">
      {items.map((v, i) => (
        <div key={i} className="flex items-center gap-1.5">
          {numbered && <span className="w-5 shrink-0 text-right text-[12px] font-semibold text-faint num">{i + 1}.</span>}
          <Input
            value={v}
            disabled={disabled}
            className={mono ? "font-mono" : ""}
            placeholder={placeholder?.(i)}
            onChange={(e) => set(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && i === items.length - 1 && items.length < max) {
                e.preventDefault();
                onChange([...items, ""]);
              }
            }}
          />
          <Button size="icon-sm" variant="ghost" aria-label={`Move item ${i + 1} up`} disabled={disabled || i === 0} onClick={() => move(i, -1)}>
            <Icon.ArrowUp size={14} />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label={`Move item ${i + 1} down`} disabled={disabled || i === items.length - 1} onClick={() => move(i, 1)}>
            <Icon.ArrowDown size={14} />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label={`Remove item ${i + 1}`} disabled={disabled} onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <Icon.X size={14} />
          </Button>
        </div>
      ))}
      {items.length < max && (
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => onChange([...items, ""])}>
          <Icon.Plus size={14} />
          {addLabel}
        </Button>
      )}
    </div>
  );
}
