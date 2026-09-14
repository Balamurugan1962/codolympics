"use client";

/**
 * A timestamp in the reader's own timezone.
 *
 * Anything rendered on the server and hydrated in the browser cannot format a
 * time directly: the server is usually UTC and the hall is not, so the two
 * disagree and React throws away the markup (hydration error #418). This
 * formats after mount instead, so the server and the first client render agree.
 *
 * Data fetched in the browser has no such problem and can format inline.
 */
import { useEffect, useState } from "react";

export function LocalTime({ iso, withDate = false, className = "" }: { iso: string; withDate?: boolean; className?: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const d = new Date(iso);
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setText(withDate ? `${d.toLocaleDateString([], { day: "numeric", month: "short" })} · ${time}` : time);
  }, [iso, withDate]);
  // The placeholder is the width of "00:00" so the row does not jump.
  return <span className={`num ${className}`} suppressHydrationWarning>{text ?? "     "}</span>;
}

/** Markdown reduced to plain text, for one-line previews where `**bold**` would show its asterisks. */
export function plainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " code ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}[-*+]\s+/gm, "")
    .replace(/^\s{0,3}\d+\.\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/\s+/g, " ")
    .trim();
}
