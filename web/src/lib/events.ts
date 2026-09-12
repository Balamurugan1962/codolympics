/**
 * Server-Sent Events, in-process (decision 67).
 *
 * Every realtime flow here is server -> client: auction state, phase changes,
 * verdicts, announcements. One backend process serves the whole hall, so the
 * subscriber list is a Set in memory. A restart drops connections; browsers
 * reconnect on their own and re-read /api/state, which is the point of SSE.
 */

export type EventName =
  | "phase"        // phase or deadline changed
  | "auction"      // lot state, bid, countdown
  | "balance"      // one participant's balance changed
  | "verdict"      // one participant's judgement progressed
  | "hack"         // one participant's hack attempt progressed
  | "announce"     // broadcast announcement
  | "notify"       // one participant was notified
  | "leaderboard"; // standings may have changed

type Subscriber = {
  userId: string;
  role: string;
  send: (name: EventName, data: unknown) => void;
};

// Survive Next's dev-mode module reloads with one bus.
const g = globalThis as unknown as { __eventBus?: Set<Subscriber> };
const subscribers: Set<Subscriber> = g.__eventBus ?? new Set();
g.__eventBus = subscribers;

export function subscribe(sub: Subscriber): () => void {
  subscribers.add(sub);
  return () => subscribers.delete(sub);
}

/** Send to everyone, or to one participant when `to` is given. */
export function publish(name: EventName, data: unknown, to?: string): void {
  // Every deadline-carrying payload also carries server_now, so clients can
  // compute a clock offset and never trust their own clock (NFR-F-07).
  const payload = { ...(data as object), server_now: Date.now() };
  for (const sub of subscribers) {
    if (to && sub.userId !== to) continue;
    try {
      sub.send(name, payload);
    } catch {
      subscribers.delete(sub);
    }
  }
}

export function subscriberCount(): number {
  return subscribers.size;
}
