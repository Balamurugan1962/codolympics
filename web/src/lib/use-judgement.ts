"use client";

/**
 * Following one submission from "sent" to a verdict.
 *
 * The app already pushes verdict events over SSE, and for most of a contest
 * that is enough. It is not enough on its own: a laptop lid closes, a wifi
 * access point in a hall hands a machine to a different radio, the stream
 * drops for eleven seconds and comes back — and every event that happened in
 * between is simply gone, because SSE has no replay here. A competitor is then
 * looking at "Judging…" for a solution the judge finished long ago, and the
 * only way out is a refresh they have been told not to do.
 *
 * So the stream is treated as a hint to look, not as the source of truth. This
 * polls one narrow endpoint until the judgement reaches a terminal state, and
 * an arriving event just makes the next poll happen now instead of in a
 * second. Either path alone is sufficient; together the slow one covers the
 * fast one's gaps.
 *
 * What it is careful about, because forty machines do this at once:
 *
 *   - it asks only for the judgement, not for the whole question
 *   - one request at a time; a slow reply never stacks up behind itself
 *   - the interval backs off while nothing is changing and resets the moment
 *     something does, so a queued job is cheap and a running one is responsive
 *   - it stops dead on a terminal state — no trailing poll
 *   - it stops while the tab is hidden and catches up immediately on return
 *   - it aborts in flight on unmount
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type Judgement = {
  id: number;
  state: "pending" | "queued" | "running" | "done" | string;
  verdict: string | null;
  passed: number | null;
  total: number | null;
  first_fail: number | null;
  max_time_ms: number | null;
  max_memory_kb: number | null;
  compile_output: string | null;
  message: string | null;
  progress: { done: number; total: number };
  cancelled: boolean;
  created_at: string;
  ended_at: string | null;
};

/** How a competitor should be told about it, which is not the same as its state. */
export type Stage = "sending" | "queued" | "running" | "done" | "gone";

export function stageOf(j: Judgement | null): Stage {
  if (!j) return "gone";
  if (j.state === "done") return "done";
  if (j.state === "running") return "running";
  if (j.state === "queued") return "queued";
  return "sending";
}

const FIRST_MS = 350; // compiling is quick; look again almost at once
const MAX_MS = 2_000; // a queue can be long, and forty tabs are polling
const GROWTH = 1.5;
/** Long enough that a genuinely stuck job is worth mentioning, not so long nobody sees it. */
const STALLED_AFTER_MS = 20_000;

/** What a follower is told about the thing it follows. */
export type Followed<T> = {
  value: T | null;
  /** Nothing has changed for a while: the UI can say so rather than spinning silently. */
  stalled: boolean;
  /** The last poll failed. The next one is already scheduled; this is for the UI to be honest. */
  unreachable: boolean;
  /** The server said the thing no longer exists (or the session did): polling stopped for good. */
  gone: boolean;
  /** Ask now rather than waiting for the next tick. */
  poke: () => void;
};

/**
 * Follow one server-side job from "sent" to a terminal state.
 *
 * `url` is null when there is nothing to follow. `signature` is everything a
 * competitor would see move; while it stays the same the polling backs off,
 * and the moment it changes the loop watches closely again. `finished` says
 * when to stop.
 */
export function useFollow<T>(url: string | null, opts: {
  initial?: T | null;
  signature: (value: T) => string;
  finished: (value: T) => boolean;
}): Followed<T> {
  const { initial, signature, finished } = opts;
  const [value, setValue] = useState<T | null>(initial ?? null);
  const [stalled, setStalled] = useState(false);
  const [unreachable, setUnreachable] = useState(false);
  const [gone, setGone] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);
  const delay = useRef(FIRST_MS);
  const inFlight = useRef(false);
  const changedAt = useRef(Date.now());
  const seen = useRef("");
  const done = useRef(false);
  // The callbacks are read through refs so a caller's inline arrow does not
  // restart the loop on every render.
  const decide = useRef({ signature, finished });
  decide.current = { signature, finished };

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const poll = useCallback(async () => {
    if (url === null || done.current || inFlight.current) return;
    if (typeof document !== "undefined" && document.hidden) return;

    inFlight.current = true;
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;

    try {
      const res = await fetch(url, { signal: ctl.signal, headers: { accept: "application/json" } });
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        // Not a hiccup: the thing is not ours to see any more. Stop asking.
        done.current = true;
        setGone(true);
        clear();
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const next = (await res.json()) as T;
      setUnreachable(false);
      setValue(next);

      const sig = decide.current.signature(next);
      if (sig !== seen.current) {
        seen.current = sig;
        changedAt.current = Date.now();
        delay.current = FIRST_MS; // something moved: watch closely again
        setStalled(false);
      } else {
        delay.current = Math.min(MAX_MS, delay.current * GROWTH);
        if (Date.now() - changedAt.current > STALLED_AFTER_MS) setStalled(true);
      }

      if (decide.current.finished(next)) {
        done.current = true;
        clear();
        return;
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      // The judge or the network is unhappy. Keep asking, more slowly.
      setUnreachable(true);
      delay.current = Math.min(MAX_MS, delay.current * GROWTH);
    } finally {
      inFlight.current = false;
    }

    if (!done.current) {
      clear();
      timer.current = setTimeout(() => void poll(), delay.current);
    }
  }, [url]);

  const poke = useCallback(() => {
    if (done.current) return;
    delay.current = FIRST_MS;
    clear();
    void poll();
  }, [poll]);

  // A new url is a new life cycle.
  useEffect(() => {
    done.current = false;
    delay.current = FIRST_MS;
    seen.current = "";
    changedAt.current = Date.now();
    setStalled(false);
    setUnreachable(false);
    setGone(false);
    setValue(initial ?? null);
    if (url === null) {
      clear();
      return;
    }
    void poll();
    return () => {
      clear();
      abort.current?.abort();
    };
    // `initial` is a starting value only; re-running on every render of it
    // would restart the poll loop continuously.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, poll]);

  // A hidden tab costs the server nothing and learns nothing. Catch up on return.
  useEffect(() => {
    const onVisible = () => {
      if (document.hidden) clear();
      else poke();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [poke]);

  return { value, stalled, unreachable, gone, poke };
}

type Result = Omit<Followed<Judgement>, "value"> & { judgement: Judgement | null; stage: Stage };

export function useJudgement(submissionId: number | null, initial?: Judgement | null): Result {
  const { value, ...rest } = useFollow<{ judgement: Judgement }>(
    submissionId === null ? null : `/api/submissions/${submissionId}`,
    {
      initial: initial ? { judgement: initial } : null,
      signature: ({ judgement: j }) => `${j.state}:${j.progress.done}/${j.progress.total}:${j.verdict ?? ""}`,
      finished: ({ judgement: j }) => j.state === "done",
    },
  );
  const judgement = value?.judgement ?? null;
  return { judgement, stage: stageOf(judgement), ...rest };
}
