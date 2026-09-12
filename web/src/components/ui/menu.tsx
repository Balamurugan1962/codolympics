"use client";

/** A small dropdown for secondary and destructive row actions. Closes on outside click and Escape. */
import { useEffect, useRef, useState } from "react";

import { Icon } from "../icons";

export type MenuItem = { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean };

export function Menu({ items, label = "More actions", align = "right" }: { items: MenuItem[]; label?: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-box text-muted hover:bg-page hover:text-ink focus:outline-none focus:ring-2 focus:ring-green/30">
        <Icon.More />
      </button>
      {open && (
        <div role="menu" className={`absolute z-30 mt-1 min-w-44 overflow-hidden rounded-box border border-line bg-card py-1 shadow-lg ${align === "right" ? "right-0" : "left-0"}`}>
          {items.map((it) => (
            <button key={it.label} role="menuitem" disabled={it.disabled} onClick={() => { setOpen(false); it.onSelect(); }}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-page disabled:cursor-not-allowed disabled:text-faint ${it.danger ? "text-red" : "text-ink"}`}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
