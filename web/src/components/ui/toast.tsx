"use client";

/**
 * Feedback for every action. Toasts stack bottom-right, announce to screen
 * readers, and dismiss themselves. `useToast().toast({ title, tone })`.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { Icon } from "../icons";

type Tone = "success" | "error" | "info" | "warning";
type Toast = { id: number; title: string; description?: string; tone: Tone; duration: number };
type Ctx = { toast: (t: { title: string; description?: string; tone?: Tone; duration?: number }) => void };

const ToastContext = createContext<Ctx | null>(null);

const tones: Record<Tone, { bar: string; icon: React.ReactNode }> = {
  success: { bar: "bg-green", icon: <Icon.Check className="text-green-dark" /> },
  error: { bar: "bg-red", icon: <Icon.Alert className="text-red" /> },
  warning: { bar: "bg-amber", icon: <Icon.Alert className="text-[#9a6b00]" /> },
  info: { bar: "bg-blue", icon: <Icon.Info className="text-blue" /> },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const toast = useCallback<Ctx["toast"]>((t) => {
    const id = next.current++;
    const item: Toast = { id, title: t.title, description: t.description, tone: t.tone ?? "info", duration: t.duration ?? 5000 };
    setItems((xs) => [...xs.slice(-4), item]);
    if (item.duration > 0) setTimeout(() => dismiss(id), item.duration);
  }, [dismiss]);

  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4" role="region" aria-label="Notifications">
        {items.map((t) => (
          <div key={t.id} role="status" aria-live="polite"
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-box border border-line bg-card p-3 pr-2 shadow-lg animate-[toast-in_.18s_ease-out]">
            <span className={`absolute inset-y-0 left-0 w-1 ${tones[t.tone].bar}`} />
            <span className="mt-0.5 shrink-0">{tones[t.tone].icon}</span>
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-semibold">{t.title}</div>
              {t.description && <div className="mt-0.5 text-muted">{t.description}</div>}
            </div>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="rounded p-1 text-faint hover:bg-page hover:text-ink"><Icon.X /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Ctx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
