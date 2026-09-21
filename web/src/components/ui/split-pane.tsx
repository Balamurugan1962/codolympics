"use client";

/**
 * Two panes with a draggable divider, the way an IDE lays out problem and
 * code. Below the `lg` breakpoint it becomes a tab switch instead, so nothing
 * is squeezed. The ratio is remembered per browser.
 */
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The share of a split given to one pane, dragged with the pointer or nudged
 * with the arrow keys, clamped to [min, max] and remembered per browser.
 * `axis` says which way the divider moves; `measure` turns a pointer position
 * into a share of the box.
 */
function useSplitRatio({ storageKey, initial, min, max, axis }: { storageKey: string; initial: number; min: number; max: number; axis: "x" | "y" }) {
  const [ratio, setRatio] = useState(initial);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const latest = useRef(ratio);
  latest.current = ratio;

  useEffect(() => {
    try { const v = localStorage.getItem(`split:${storageKey}`); if (v) setRatio(Math.min(max, Math.max(min, Number(v)))); } catch { /* fine */ }
  }, [storageKey, min, max]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current || !box.current) return;
      const rect = box.current.getBoundingClientRect();
      const share = axis === "x" ? (e.clientX - rect.left) / rect.width : (rect.bottom - e.clientY) / rect.height;
      setRatio(Math.min(max, Math.max(min, share)));
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = ""; document.body.style.userSelect = "";
      try { localStorage.setItem(`split:${storageKey}`, String(latest.current)); } catch { /* fine */ }
    };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [storageKey, min, max, axis]);

  const startDrag = useCallback(() => {
    dragging.current = true;
    document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  }, [axis]);
  const nudge = useCallback((by: number) => setRatio((r) => Math.min(max, Math.max(min, r + by))), [min, max]);

  return { ratio, box, startDrag, nudge };
}

export function SplitPane({ left, right, leftLabel = "Problem", rightLabel = "Code", storageKey = "split" }: {
  left: React.ReactNode; right: React.ReactNode; leftLabel?: string; rightLabel?: string; storageKey?: string;
}) {
  const { ratio, box, startDrag, nudge } = useSplitRatio({ storageKey, initial: 0.45, min: 0.25, max: 0.75, axis: "x" });
  const [wide, setWide] = useState(true);
  const [tab, setTab] = useState<"left" | "right">("left");

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(mq.matches);
    on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

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
        onPointerDown={startDrag}
        onKeyDown={(e) => { if (e.key === "ArrowLeft") nudge(-0.02); if (e.key === "ArrowRight") nudge(0.02); }}
        className="group relative w-1.5 shrink-0 cursor-col-resize bg-line hover:bg-brand/60 focus:bg-brand focus:outline-none">
        <span className="absolute left-1/2 top-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2 rounded bg-line-2 group-hover:bg-brand" />
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-auto">{right}</div>
    </div>
  );
}

/**
 * Editor above, console below, with a draggable bar between them: the way a
 * contest workspace stacks code over its test cases. `open` false folds the
 * bottom pane to whatever its own header measures.
 */
export function VerticalSplit({ top, bottom, open, storageKey = "vsplit" }: {
  top: React.ReactNode; bottom: React.ReactNode; open: boolean; storageKey?: string;
}) {
  const { ratio, box, startDrag, nudge } = useSplitRatio({ storageKey, initial: 0.38, min: 0.15, max: 0.7, axis: "y" });
  return (
    <div ref={box} className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">{top}</div>
      {open && (
        <div role="separator" aria-orientation="horizontal" aria-label="Resize console" tabIndex={0}
          onPointerDown={startDrag}
          onKeyDown={(e) => { if (e.key === "ArrowUp") nudge(0.02); if (e.key === "ArrowDown") nudge(-0.02); }}
          className="group relative h-1.5 shrink-0 cursor-row-resize bg-white/10 hover:bg-brand/60 focus:bg-brand focus:outline-none">
          <span className="absolute left-1/2 top-1/2 h-1 w-8 -translate-x-1/2 -translate-y-1/2 rounded bg-white/25 group-hover:bg-brand" />
        </div>
      )}
      <div className="flex min-h-0 shrink-0 flex-col" style={open ? { height: `${ratio * 100}%` } : undefined}>{bottom}</div>
    </div>
  );
}
