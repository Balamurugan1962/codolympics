"use client";

/**
 * Two panes with a draggable divider, the way an IDE lays out problem and
 * code. Below the `lg` breakpoint it becomes a tab switch instead, so nothing
 * is squeezed. The ratio is remembered per browser.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export function SplitPane({ left, right, leftLabel = "Problem", rightLabel = "Code", storageKey = "split" }: {
  left: React.ReactNode; right: React.ReactNode; leftLabel?: string; rightLabel?: string; storageKey?: string;
}) {
  const [ratio, setRatio] = useState(0.45);
  const [wide, setWide] = useState(true);
  const [tab, setTab] = useState<"left" | "right">("left");
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    try { const v = localStorage.getItem(`split:${storageKey}`); if (v) setRatio(Math.min(0.75, Math.max(0.25, Number(v)))); } catch { /* fine */ }
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(mq.matches);
    on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [storageKey]);

  const onMove = useCallback((e: PointerEvent) => {
    if (!dragging.current || !box.current) return;
    const rect = box.current.getBoundingClientRect();
    const r = Math.min(0.75, Math.max(0.25, (e.clientX - rect.left) / rect.width));
    setRatio(r);
  }, []);
  const onUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.style.cursor = ""; document.body.style.userSelect = "";
    try { localStorage.setItem(`split:${storageKey}`, String(ratio)); } catch { /* fine */ }
  }, [ratio, storageKey]);
  useEffect(() => {
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [onMove, onUp]);

  if (!wide) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex border-b border-line bg-card" role="tablist">
          {(["left", "right"] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`flex-1 border-b-2 py-2 text-sm font-semibold ${tab === t ? "border-brand text-ink" : "border-transparent text-muted-foreground"}`}>
              {t === "left" ? leftLabel : rightLabel}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{tab === "left" ? left : right}</div>
      </div>
    );
  }

  return (
    <div ref={box} className="flex h-full min-h-0">
      <div className="min-h-0 overflow-auto" style={{ width: `${ratio * 100}%` }}>{left}</div>
      <div role="separator" aria-orientation="vertical" aria-label="Resize panes" tabIndex={0}
        onPointerDown={() => { dragging.current = true; document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; }}
        onKeyDown={(e) => { if (e.key === "ArrowLeft") setRatio((r) => Math.max(0.25, r - 0.02)); if (e.key === "ArrowRight") setRatio((r) => Math.min(0.75, r + 0.02)); }}
        className="group relative w-1.5 shrink-0 cursor-col-resize bg-line hover:bg-brand/60 focus:bg-brand focus:outline-none">
        <span className="absolute left-1/2 top-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2 rounded bg-line-2 group-hover:bg-brand" />
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">{right}</div>
    </div>
  );
}
