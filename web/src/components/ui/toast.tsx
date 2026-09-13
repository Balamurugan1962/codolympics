"use client";

/**
 * Feedback for every action, on sonner (shadcn's toaster).
 *
 * `useToast().toast({ title, description, tone })` is kept as the call shape
 * because feedback in this app is fired from event handlers all over the tree —
 * a hook that needs no provider is less to get wrong than a context, and sonner
 * already renders, stacks, announces and dismisses.
 */
import { toast as sonner } from "sonner";

export { Toaster } from "./sonner";

export type Tone = "success" | "error" | "info" | "warning";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: Tone;
  /** Milliseconds. 0 keeps it up until dismissed. */
  duration?: number;
  action?: { label: string; onClick: () => void };
};

function show({ title, description, tone = "info", duration = 5000, action }: ToastInput) {
  const fn = tone === "success" ? sonner.success : tone === "error" ? sonner.error : tone === "warning" ? sonner.warning : sonner.info;
  fn(title, { description, duration: duration === 0 ? Infinity : duration, action });
}

export function useToast() {
  return { toast: show, dismiss: sonner.dismiss };
}

/** For places that are not React components. */
export const toast = show;
