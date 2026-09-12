"use client";

/**
 * The client's view of the contest. One SSE connection per page; on any
 * reconnect the whole state is re-read from /api/state -- cached local state
 * is never trusted (US-F2-03, US-F10-02).
 *
 * `serverNow()` returns the server's clock, from an offset measured on every
 * event, so countdowns never depend on the browser's clock (NFR-F-07).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/lib/client";

export type ContestState = {
  viewer: { id: string; name: string; username: string; role: "participant" | "evaluator" | "admin" };
  contest: { phase: string; phase_ends_at: string | null; registration_open: boolean; leaderboard_mode: string; server_now: number };
  announcements: { id: number; bodyMd: string; createdAt: string }[];
  me?: { balance: number; disqualified: boolean; advanced: boolean; p1_puzzles_finished: boolean; p1_hacking_finished: boolean } | null;
  questions?: { id: string; title: string; difficulty: string; score: number; status: string; price_paid: number; awarded_at: string }[];
  auction?: AuctionSnapshot | null;
  submit?: { in_flight: boolean; cooldown_ms: number; server_now: number };
  notifications?: { id: number; body_md: string; created_at: string }[];
};

export type AuctionSnapshot = {
  round: number;
  increment: number;
  countdown_seconds: number;
  lot: {
    id: number; question_id: string; title: string; difficulty: string; score: number; base_price: number;
    current_bid: number | null; current_bidder_id: string | null; current_bidder_name: string | null; next_bid: number;
    no_bid_deadline: string | null; bidding_ends_at: string | null; opened_at: string | null;
  } | null;
  order: { id: number; questionId: string; title: string; difficulty: string; score: number; base_price: number; state: string; current_bid: number | null; order: number }[];
  server_now: number;
};

type Ctx = {
  state: ContestState | null;
  connected: boolean;
  serverNow: () => number;
  refresh: () => Promise<void>;
  lastEvent: { name: string; data: unknown; at: number } | null;
};

const ContestContext = createContext<Ctx | null>(null);

export function ContestProvider({ initial, children }: { initial: ContestState; children: React.ReactNode }) {
  const [state, setState] = useState<ContestState | null>(initial);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<Ctx["lastEvent"]>(null);
  const offset = useRef(initial.contest.server_now - Date.now());

  const noteServerNow = (serverNow: unknown) => {
    if (typeof serverNow === "number") offset.current = serverNow - Date.now();
  };

  const refresh = useCallback(async () => {
    const fresh = await api.get<ContestState>("/api/state");
    noteServerNow(fresh.contest.server_now);
    setState(fresh);
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/events");
    let wasDown = false;
    es.onopen = () => {
      setConnected(true);
      if (wasDown) void refresh(); // reconciled from the server, never from cache
      wasDown = false;
    };
    es.onerror = () => { setConnected(false); wasDown = true; };

    const on = (name: string) => (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      noteServerNow(data.server_now);
      setLastEvent({ name, data, at: Date.now() });
      if (name === "auction") setState((s) => (s ? { ...s, auction: data } : s));
      else if (name === "phase") setState((s) => (s ? { ...s, contest: data } : s));
      else if (name === "balance" && typeof data.balance === "number") setState((s) => (s?.me ? { ...s, me: { ...s.me, balance: data.balance } } : s));
      else if (["balance", "notify", "announce", "verdict", "hack"].includes(name)) void refresh();
    };
    for (const name of ["hello", "ping", "phase", "auction", "balance", "verdict", "hack", "announce", "notify", "leaderboard"]) {
      es.addEventListener(name, on(name));
    }
    return () => es.close();
  }, [refresh]);

  const value = useMemo<Ctx>(() => ({
    state, connected, refresh, lastEvent,
    serverNow: () => Date.now() + offset.current,
  }), [state, connected, refresh, lastEvent]);

  return <ContestContext.Provider value={value}>{children}</ContestContext.Provider>;
}

export function useContest(): Ctx {
  const ctx = useContext(ContestContext);
  if (!ctx) throw new Error("useContest must be used inside ContestProvider");
  return ctx;
}
