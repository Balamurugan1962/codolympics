"use client";

import { useEffect, useRef } from "react";

/**
 * A modal on the native <dialog> element: focus trapping, Escape to close and
 * the backdrop come from the browser, not from a library.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // backdrop click
      }}
      className="w-full max-w-lg rounded-box border border-line bg-card p-0 text-ink shadow-xl
        backdrop:bg-navy/60 open:animate-none"
    >
      <div onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-line px-5 py-3 text-[15px] font-semibold">{title}</div>
        <div className="p-5">{children}</div>
      </div>
    </dialog>
  );
}
