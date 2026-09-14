"use client";

/**
 * The vocabulary the judge activity list and its drawer share: what the three
 * kinds of work are called, how a state is coloured, and how a stretch of time
 * is written.
 *
 * It lives apart from both so the list and the detail cannot drift — a hack
 * labelled "Hack" in the table and "Hack attempt" in the drawer is the kind of
 * small inconsistency that makes an operator wonder if they are two things.
 */
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";

export type WorkKind = "submission" | "hack" | "validator";

export type Work = {
  kind: WorkKind;
  key: string;
  ref: string;
  job_id: string | null;
  state: "pending" | "queued" | "running" | "done" | "error";
  live: boolean;
  participant_id: string;
  name: string;
  target: string;
  problem_id: string | null;
  language: string | null;
  progress: { done: number; total: number } | null;
  verdict: string | null;
  label: string | null;
  tone: "success" | "destructive" | "warning" | "info" | "neutral";
  outcome: string | null;
  retries: number;
  attempt: number | null;
  superseded: boolean;
  created_at: string;
  ended_at: string | null;
  duration_ms: number | null;
};

export const KIND: Record<WorkKind, { noun: string; label: string; icon: React.ReactNode }> = {
  submission: { noun: "Submission", label: "Code", icon: <Icon.Code size={13} /> },
  hack: { noun: "Hack", label: "Hack", icon: <Icon.Bug size={13} /> },
  validator: { noun: "Validator run", label: "Validator", icon: <Icon.ListChecks size={13} /> },
};

/** Blue is waiting, amber is waiting too long, red is a failure of ours. */
export function stateTone(state: string): string {
  return (
    {
      pending: "text-amber",
      queued: "text-blue",
      running: "text-blue",
      done: "text-muted-foreground",
      error: "text-red",
    }[state] ?? "text-muted-foreground"
  );
}

/** What a state means, rather than what it is called in the database. */
export const STATE_WORDS: Record<string, string> = {
  pending: "Not accepted yet",
  queued: "Waiting in the judge's queue",
  running: "Running",
  done: "Finished",
  error: "The judge failed",
};

/** Short enough for a table cell: 840 ms, 2.4 s, 1m 12s. */
export function duration(ms: number | null): string {
  if (ms === null || Number.isNaN(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const m = Math.floor(ms / 60_000);
  return `${m}m ${Math.round((ms % 60_000) / 1000)}s`;
}

/**
 * How long this has been waiting, counting up.
 *
 * A static "sent at 14:32" makes you do the arithmetic; the number that matters
 * when something is stuck is how long it has been stuck, so it ticks.
 */
export function Elapsed({ since, className }: { since: string; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = now - new Date(since).getTime();
  return (
    <span className={className} title={new Date(since).toLocaleString()}>
      {duration(Math.max(0, ms))}
    </span>
  );
}
