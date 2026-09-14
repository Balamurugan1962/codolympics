"use client";

/**
 * The screen a blacked-out competitor sees.
 *
 * It is an overlay above whatever they were doing, not a navigation. That is
 * the whole trick for "put them back exactly where they were": nothing is
 * unmounted, so the editor keeps its buffer, the puzzle keeps its half-typed
 * answer and the scroll position is still there when the overlay lifts. A
 * redirect would have thrown all of that away and made the powerup destructive
 * rather than obstructive.
 *
 * The countdown is decoration. When it reaches zero the client asks the server
 * whether it is really over, and only the server's answer lifts the screen — so
 * a clock nudged forward, a tab that slept through the end, or a second window
 * all end up at the same answer.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Icon } from "@/components/icons";
import { api } from "@/lib/client";

type State = { active: boolean; ends_at: string | null; count: number; by: string[]; server_now: number };

/** Slow heartbeat, so a missed event still ends the blackout within a few seconds. */
const IDLE_MS = 15_000;

export function BlackoutOverlay() {
  const { state, lastEvent, serverNow } = useContest();
  const [live, setLive] = useState<State | null>(null);
  const checking = useRef(false);
  const [, tick] = useState(0);

  // The first paint after a refresh comes from the page's own state, so the
  // overlay is up immediately rather than a beat later.
  const initial = state?.blackout ?? null;
  const current = live ?? initial;

  const check = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    try {
      setLive(await api.get<State>("/api/blackout"));
    } catch {
      /* A failed check must never clear the screen: staying blacked out on a
         dropped connection is the safe way to be wrong. */
    } finally {
      checking.current = false;
    }
  }, []);

  // Pushed the instant one lands or is absorbed.
  useEffect(() => {
    if (lastEvent?.name === "powerup") void check();
  }, [lastEvent, check]);

  // A second hand for the countdown, and a heartbeat while it is up.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const t = setInterval(() => {
      if (!document.hidden) void check();
    }, IDLE_MS);
    return () => clearInterval(t);
  }, [check]);

  const endsAt = current?.active ? Date.parse(current.ends_at ?? "") : 0;
  const left = endsAt ? Math.max(0, endsAt - serverNow()) : 0;

  // Reached zero by the client's reckoning: ask, do not assume.
  useEffect(() => {
    if (current?.active && left === 0) void check();
  }, [current?.active, left, check]);

  if (!current?.active) return null;

  const secs = Math.ceil(left / 1000);
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  const who = current.by.filter((n, i, a) => a.indexOf(n) === i);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="You have been blacked out"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-navy px-6 text-center text-white"
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-white/10">
        <Icon.Ban size={26} />
      </div>

      <h1 className="mt-6 text-[26px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">You&apos;ve been blocked out</h1>

      <p className="mt-2.5 max-w-md text-[14px] leading-relaxed text-white/70">
        {who.length === 0
          ? "Someone used a Blackout on you."
          : who.length === 1
            ? `${who[0]} used a Blackout on you.`
            : `${who.slice(0, -1).join(", ")} and ${who[who.length - 1]} used Blackouts on you.`}
      </p>

      <div className="mt-8 font-mono text-[56px] leading-none font-semibold tabular-nums sm:text-[72px]" aria-live="off">
        {mm}:{String(ss).padStart(2, "0")}
      </div>

      {current.count > 1 && (
        <p className="mt-3 rounded-full bg-white/10 px-3 py-1 text-[12.5px] font-medium">
          {current.count} blackouts stacked · {secs}s total remaining
        </p>
      )}

      <p className="mt-8 max-w-sm text-[12.5px] leading-relaxed text-white/50">
        Nothing is lost. Your work is saved and you will come back to exactly where you were. Refreshing or opening another tab
        will not clear this — the clock is on the server.
      </p>
    </div>
  );
}
