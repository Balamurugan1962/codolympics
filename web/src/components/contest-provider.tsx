"use client";

/**
 * The client's view of the contest, kept live by polling the engine.
 *
 * About once a second the page asks `/api/poll?after=<cursor>` for the events
 * since the last one it saw. They are the same events the engine used to push
 * over SSE. The cursor starts at the `event_cursor` the initial state was read
 * at, so nothing between that read and the first poll is missed.
 *
 * Events are delivered to components by subscription (`useEngineEvent`), never
 * as a piece of rendered state. A rendered "last event" loses any event that
 * arrives in the same batch as another: a finished hack publishes `hack` and
 * then `leaderboard`, React collapsed both into one render, and Section B only
 * ever saw `leaderboard` -- so a verdict sat at "judging" until the page was
 * reloaded. A subscription runs once per event, whatever React does with the
 * renders that follow.
 *
 * Local state is never trusted after a gap: if a poll fails, or the engine says
 * events were pruned while this tab was away, the whole state is re-read.
 *
 * `serverNow()` returns the server's clock, from an offset measured on every
 * poll, so countdowns never depend on the browser's clock.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/lib/client";

export type ContestState = {
  viewer: { id: string; name: string; username: string; role: "participant" | "evaluator" | "admin" };
  contest: { phase: string; phase_ends_at: string | null; registration_open: boolean; leaderboard_mode: string; p1_leaderboard_mode: string; in_phase2: boolean; proctoring: boolean; server_now: number };
  announcements: { id: number; bodyMd: string; createdAt: string }[];
  /** The newest event id when this state was read: where polling starts. */
  event_cursor: number;
  me?: {
    balance: number; disqualified: boolean; advanced: boolean; p1_puzzles_finished: boolean; p1_hacking_finished: boolean; preferred_language: string | null;
    /** Whether the page must hold full screen, and how many times they have left it. */
    proctor: { enabled: boolean; alerts: number; warnings: number; locked: boolean };
  } | null;
  questions?: { id: string; title: string; difficulty: string | null; score: number | null; common?: boolean; status: string; price_paid: number; awarded_at: string; attempts: number; progress: "solved" | "judging" | "attempted" | "unattempted" }[];
  rank?: { rank: number; score: number; solved: number; total_time_ms: number } | null;
  auction?: AuctionSnapshot | null;
  submit?: { in_flight: boolean; cooldown_ms: number; server_now: number };
  notifications?: { id: number; body_md: string; created_at: string }[];
  /** Server-decided. Present from the first paint so the overlay is never late. */
  blackout?: { active: boolean; ends_at: string | null; count: number; by: string[]; server_now: number };
  /** The shield that is up, if any (ends_at null means until it absorbs an attack), and how many wait behind it. */
  shield?: { active: boolean; ends_at: string | null; queued: number; server_now: number };
  /** A break from being attacked, after the cap was reached: nobody can attack them until it ends. */
  attack_break?: { active: boolean; ends_at: string | null; number: number; server_now: number };
  /** Just after a blackout ends, nobody can attack them for a while. */
  attack_cooldown?: { active: boolean; ends_at: string | null; server_now: number };
};

export type AuctionSnapshot = {
  round: number;
  /** "offline" means the room bids out loud and an organiser records each sale. */
  mode: "online" | "offline";
  /** An administrator is holding the auction: the clock is stopped and bids are refused. */
  paused: boolean;
  paused_at: string | null;
  increment: number;
  countdown_seconds: number;
  opening_window_seconds: number;
  recent_bids: { id: number; amount: number; participant_id: string; name: string; at: string }[];
  /* Blind bidding: a lot says what it is about and what it is worth, never
     which problem it is. The winner reads the real thing once it is theirs. */
  lot: {
    id: number; topic: string; difficulty: string; score: number; base_price: number;
    current_bid: number | null; current_bidder_id: string | null; current_bidder_name: string | null; next_bid: number;
    no_bid_deadline: string | null; bidding_ends_at: string | null; opened_at: string | null;
  } | null;
  order: {
    id: number; topic: string; difficulty: string; score: number; base_price: number;
    state: string; current_bid: number | null; order: number;
    winner_id: string | null; winner_name: string | null; price_paid: number | null;
  }[];
  server_now: number;
};

export type EngineEvent = { id: number; name: string; data: Record<string, unknown> };
type Listener = (event: EngineEvent) => void;
type Poll = { events: EngineEvent[]; cursor: number; reset: boolean; server_now: number };

const POLL_MS = 1_000;
/** Consecutive failed polls before the chrome reports the connection lost. */
const LOST_AFTER_FAILURES = 3;

/**
 * "connecting" is before the first successful poll. It is not an error and must
 * never be reported as one; only failures after that raise the alarm.
 */
export type Connection = "connecting" | "open" | "lost";

type Ctx = {
  state: ContestState | null;
  connection: Connection;
  serverNow: () => number;
  refresh: () => Promise<void>;
  /** Call for every event until the returned function is called. Use `useEngineEvent`. */
  subscribe: (listener: Listener) => () => void;
};

const ContestContext = createContext<Ctx | null>(null);

export function ContestProvider({ initial, children }: { initial: ContestState; children: React.ReactNode }) {
  const [state, setState] = useState<ContestState | null>(initial);
  const [connection, setConnection] = useState<Connection>("connecting");
  const offset = useRef(initial.contest.server_now - Date.now());
  const listeners = useRef(new Set<Listener>());

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const noteServerNow = (serverNow: unknown) => {
    if (typeof serverNow === "number") offset.current = serverNow - Date.now();
  };

  // Single flight: a burst of events asks for one re-read, plus one more if
  // anything arrived while it ran -- never one full state read per event.
  const reading = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const refresh = useCallback(async (): Promise<void> => {
    if (reading.current) {
      again.current = true;
      return reading.current;
    }
    reading.current = (async () => {
      do {
        again.current = false;
        const fresh = await api.get<ContestState>("/api/state");
        noteServerNow(fresh.contest.server_now);
        setState(fresh);
      } while (again.current);
    })().finally(() => { reading.current = null; });
    return reading.current;
  }, []);

  const apply = useCallback((event: EngineEvent) => {
    const { name, data } = event;
    noteServerNow(data.server_now);
    // Every listener hears every event, before any re-render decides anything.
    for (const listener of listeners.current) {
      try {
        listener(event);
      } catch {
        // One screen's handler must not stop the others, or the poll loop.
      }
    }
    if (name === "auction") setState((s) => (s ? { ...s, auction: data as unknown as AuctionSnapshot } : s));
    else if (name === "phase") setState((s) => (s ? { ...s, contest: data as unknown as ContestState["contest"] } : s));
    else if (name === "balance" && typeof data.balance === "number") {
      const balance = data.balance;
      setState((s) => (s?.me ? { ...s, me: { ...s.me, balance } } : s));
    } else if (name === "verdict") {
      // A running judgement reports progress about once a second. Only a finished
      // one moves anything else -- the score, the cooldown, the leaderboard -- so
      // only that re-reads the contest; the workspace polls its own submission.
      if (data.state === "done" || data.cancelled || data.rejudge) void refresh().catch(() => undefined);
    } else if (["balance", "notify", "announce", "hack", "powerup"].includes(name)) void refresh().catch(() => undefined);
  }, [refresh]);

  useEventPolling(initial.event_cursor, { apply, refresh, setConnection, noteServerNow });

  const value = useMemo<Ctx>(() => ({
    state, connection, refresh, subscribe,
    serverNow: () => Date.now() + offset.current,
  }), [state, connection, refresh, subscribe]);

  return <ContestContext.Provider value={value}>{children}</ContestContext.Provider>;
}

/**
 * Ask the engine for new events about once a second, and apply each in turn.
 *
 * Hidden tabs do not poll; the first poll back picks up everything since. Any
 * gap -- a failed poll, or events pruned while away -- re-reads the whole state.
 */
type PollingHandlers = {
  apply: (event: EngineEvent) => void;
  refresh: () => Promise<void>;
  setConnection: React.Dispatch<React.SetStateAction<Connection>>;
  /** Every poll carries the server's clock, so countdowns stay honest even when nothing happens. */
  noteServerNow: (serverNow: unknown) => void;
};

function useEventPolling(startCursor: number, { apply, refresh, setConnection, noteServerNow }: PollingHandlers) {
  useEffect(() => {
    let cursor = startCursor;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const pollOnce = async () => {
      const poll = await api.get<Poll>(`/api/poll?after=${cursor}`);
      noteServerNow(poll.server_now);
      if (poll.reset || failures > 0) await refresh();
      failures = 0;
      setConnection("open");
      for (const event of poll.events) apply(event);
      cursor = poll.cursor;
    };

    const tick = async () => {
      if (!document.hidden) {
        try {
          await pollOnce();
        } catch {
          failures += 1;
          if (failures >= LOST_AFTER_FAILURES) setConnection((c) => (c === "connecting" ? c : "lost"));
        }
      }
      if (!stopped) timer = setTimeout(() => void tick(), POLL_MS);
    };

    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
    // The cursor starts from the state the page was rendered with, once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apply, refresh, setConnection]);
}

export function useContest(): Ctx {
  const ctx = useContext(ContestContext);
  if (!ctx) throw new Error("useContest must be used inside ContestProvider");
  return ctx;
}

/**
 * Run `handler` for each named event, for as long as the component is mounted.
 *
 * Pass "*" to hear everything. The handler may change on every render without
 * resubscribing, so it can close over fresh props and state.
 */
export function useEngineEvent(names: string | readonly string[], handler: (event: EngineEvent) => void): void {
  const { subscribe } = useContest();
  const latest = useRef(handler);
  latest.current = handler;
  const key = Array.isArray(names) ? names.join(",") : (names as string);
  useEffect(() => {
    const wanted = key.split(",");
    return subscribe((event) => {
      if (wanted.includes("*") || wanted.includes(event.name)) latest.current(event);
    });
  }, [subscribe, key]);
}
