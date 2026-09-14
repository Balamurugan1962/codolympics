"use client";

/**
 * A list you can put in order by dragging.
 *
 * Drag-and-drop is the fast path, not the only one: every row also has move
 * up/down buttons and answers the arrow keys while focused, because dragging
 * is unusable with a keyboard, awkward on a trackpad, and impossible on a long
 * list that scrolls. The buttons are the accessible route and the honest one.
 *
 * Native HTML5 drag events, no library — the page has to work on a machine
 * with no internet and one more dependency buys nothing here.
 */
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { Icon } from "../icons";
import { Button } from "./button";

export function ReorderList<T>({
  items,
  onChange,
  keyOf,
  children,
  disabled,
  className,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  keyOf: (item: T) => string | number;
  children: (item: T, index: number) => React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const live = useRef<HTMLParagraphElement>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    onChange(next);
    if (live.current) live.current.textContent = `Moved to position ${to + 1} of ${items.length}.`;
  };

  return (
    <>
      <ol className={cn("divide-y", className)}>
        {items.map((item, i) => (
          <li
            key={keyOf(item)}
            draggable={!disabled}
            onDragStart={(e) => {
              setDragging(i);
              e.dataTransfer.effectAllowed = "move";
              // Firefox will not start a drag without payload.
              e.dataTransfer.setData("text/plain", String(i));
            }}
            onDragEnd={() => {
              setDragging(null);
              setOver(null);
            }}
            onDragOver={(e) => {
              if (dragging === null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setOver(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragging !== null) move(dragging, i);
              setDragging(null);
              setOver(null);
            }}
            className={cn(
              "flex items-center gap-3 bg-card px-4 py-2.5 transition-colors",
              dragging === i && "opacity-40",
              over === i && dragging !== i && "bg-brand-tint",
            )}
          >
            <span
              aria-hidden
              className={cn("shrink-0 text-faint", disabled ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing")}
            >
              <Icon.Grip size={16} />
            </span>

            <span className="w-6 shrink-0 text-right text-[12px] font-semibold text-faint num">{i + 1}</span>

            <div
              tabIndex={0}
              role="button"
              aria-label={`Position ${i + 1} of ${items.length}. Use the arrow keys to move it.`}
              onKeyDown={(e) => {
                if (disabled) return;
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  move(i, i - 1);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  move(i, i + 1);
                }
              }}
              className="min-w-0 flex-1 rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
            >
              {children(item, i)}
            </div>

            <div className="flex shrink-0 items-center gap-0.5">
              <Button size="icon-sm" variant="ghost" aria-label={`Move up`} disabled={disabled || i === 0} onClick={() => move(i, i - 1)}>
                <Icon.ArrowUp size={14} />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Move down`}
                disabled={disabled || i === items.length - 1}
                onClick={() => move(i, i + 1)}
              >
                <Icon.ArrowDown size={14} />
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <p ref={live} className="sr-only" aria-live="polite" />
    </>
  );
}
