"use client";

import { useEffect, useState } from "react";

import { useContest } from "./contest-provider";

/** mm:ss until `until`, on the server's clock. Shows 00:00 once passed. */
export function Countdown({ until, className = "", warnUnderMs = 60_000 }: { until: string | null; className?: string; warnUnderMs?: number }) {
  const { serverNow } = useContest();
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);
  if (!until) return <span className={className}>—</span>;
  const ms = Math.max(0, Date.parse(until) - serverNow());
  const s = Math.floor(ms / 1000);
  const text = s >= 3600
    ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
    : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return <span className={`num ${ms < warnUnderMs && ms > 0 ? "text-red" : ""} ${className}`}>{text}</span>;
}

export function remainingMs(until: string | null, serverNow: () => number): number {
  return until ? Math.max(0, Date.parse(until) - serverNow()) : 0;
}
