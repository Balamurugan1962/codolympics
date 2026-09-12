"use client";

/**
 * A right-hand sheet for detail that would otherwise push the list off screen.
 * Escape closes it, the backdrop closes it, and focus returns to the page.
 */
import { useEffect } from "react";

import { Icon } from "../icons";

export function Drawer({ open, onClose, title, description, children, width = "lg" }: {
  open: boolean; onClose: () => void; title: React.ReactNode; description?: React.ReactNode; children: React.ReactNode; width?: "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  const w = { md: "max-w-md", lg: "max-w-2xl", xl: "max-w-4xl" }[width];

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}>
      <div className="absolute inset-0 bg-navy/40 animate-fade-in" onClick={onClose} />
      <div className={`absolute inset-y-0 right-0 flex w-full ${w} flex-col bg-card shadow-2xl animate-[drawer-in_.18s_ease-out]`}>
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold leading-snug">{title}</h2>
            {description && <p className="mt-0.5 text-[12px] text-muted">{description}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-box p-1.5 text-faint hover:bg-page hover:text-ink"><Icon.X size={18} /></button>
        </div>
        <div className="pane min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
