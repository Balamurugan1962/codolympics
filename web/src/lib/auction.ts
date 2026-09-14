/**
 * The auction (LLD §4–5): bidding, awarding, and a clock that lives in the
 * database rather than in a timer, so it survives a restart (NFR-B-10).
 *
 * Balance is NOT debited when bidding. Lots are offered one at a time
 * (US-B3-01), so a participant's whole balance is always available for the
 * question in front of them and no funds reservation exists anywhere.
 *
 * Lock order is always lot -> participant. There is no second ordering.
 */
import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { bid, ledger, lot, ownership, participant, question } from "@/db/schema";

import { errors } from "./api";
import { audit } from "./audit";
import { getContest } from "./contest";
import { publish } from "./events";
import { assertNotBlackedOut } from "./powerups";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

export async function currentLot() {
  const [row] = await db
    .select({ lot, question, bidderName: user.name })
    .from(lot)
    .innerJoin(question, eq(question.id, lot.questionId))
    .leftJoin(user, eq(user.id, lot.currentBidderId))
    .where(eq(lot.state, "open"))
    .limit(1);
  return row ?? null;
}

/** Everything a client needs to render the auction. server_now for the clock. */
export async function auctionSnapshot(round: number) {
  const c = await getContest();
  const open = await currentLot();
  const order = await db
    .select({ id: lot.id, questionId: lot.questionId, title: question.title, difficulty: question.difficulty,
              score: question.score, basePrice: question.basePrice, state: lot.state, currentBid: lot.currentBid, order: lot.order,
              // Who bought it, for the board. The price is already public the
              // moment a lot closes, so the buyer is not a new disclosure —
              // and offline it is the only record the room gets.
              winnerId: ownership.participantId, pricePaid: ownership.pricePaid, winnerName: user.name })
    .from(lot)
    .innerJoin(question, eq(question.id, lot.questionId))
    .leftJoin(ownership, and(eq(ownership.questionId, lot.questionId), isNull(ownership.voidedAt)))
    .leftJoin(user, eq(user.id, ownership.participantId))
    .where(eq(lot.round, round))
    .orderBy(asc(lot.order));

  const recent = open
    ? await db
        .select({ id: bid.id, amount: bid.amount, participantId: bid.participantId, name: user.name, createdAt: bid.createdAt })
        .from(bid)
        .innerJoin(user, eq(user.id, bid.participantId))
        .where(eq(bid.lotId, open.lot.id))
        .orderBy(desc(bid.id))
        .limit(12)
    : [];

  return {
    round,
    /* Participants see this too: a frozen countdown with no explanation reads
     * as a broken page, and the first thing they do is reload. */
    mode: c.auctionMode,
    paused: c.auctionPausedAt !== null,
    paused_at: c.auctionPausedAt?.toISOString() ?? null,
    increment: c.bidIncrement,
    countdown_seconds: c.countdownSeconds,
    opening_window_seconds: c.openingWindowSeconds,
    recent_bids: recent.map((b) => ({ id: b.id, amount: b.amount, participant_id: b.participantId, name: b.name, at: b.createdAt.toISOString() })),
    lot: open
      ? {
          id: open.lot.id,
          question_id: open.question.id,
          title: open.question.title,
          difficulty: open.question.difficulty,
          score: open.question.score,
          base_price: open.question.basePrice,
          current_bid: open.lot.currentBid,
          current_bidder_id: open.lot.currentBidderId,
          current_bidder_name: open.bidderName,
          next_bid: nextBidAmount(open.lot.currentBid, open.question.basePrice, c.bidIncrement),
          no_bid_deadline: open.lot.noBidDeadline?.toISOString() ?? null,
          bidding_ends_at: open.lot.biddingEndsAt?.toISOString() ?? null,
          opened_at: open.lot.openedAt?.toISOString() ?? null,
        }
      : null,
    order: order.map((o) => ({
      ...o,
      base_price: o.basePrice,
      current_bid: o.currentBid,
      winner_id: o.winnerId,
      winner_name: o.winnerName,
      price_paid: o.pricePaid,
    })),
    server_now: Date.now(),
  };
}

/** First bid is the base price; every later bid is exactly one increment higher. */
export function nextBidAmount(currentBid: number | null, basePrice: number, increment: number): number {
  return currentBid === null ? basePrice : currentBid + increment;
}

// ---------------------------------------------------------------------------
// Bidding
// ---------------------------------------------------------------------------

export type BidRejection =
  | "auction_paused"
  | "bidding_closed"
  | "already_highest"
  | "wrong_increment"
  | "insufficient_balance"
  | "ownership_cap_reached"
  | "disqualified";

export async function placeBid(participantId: string, lotId: number, amount: number): Promise<void> {
  // Blacked out means blacked out: the overlay is what they see, this is what
  // stops a client that ignores it.
  await assertNotBlackedOut(participantId);
  const c = await getContest();

  await db.transaction(async (tx) => {
    // Serialise on the lot: every bid for this question queues here, which is
    // what makes ordering deterministic (US-B3-01).
    const [l] = await tx.select().from(lot).where(eq(lot.id, lotId)).for("update");
    if (!l) throw errors.notFound("lot");
    const [p] = await tx.select().from(participant).where(eq(participant.userId, participantId)).for("update");
    if (!p) throw errors.forbidden("not a participant");
    const [q] = await tx.select().from(question).where(eq(question.id, l.questionId));

    const reject = (code: BidRejection, message: string) => errors.conflict(code, message);
    if (p.disqualifiedAt) throw reject("disqualified", "your account is disqualified");
    if (c.auctionMode === "offline") throw reject("bidding_closed", "bidding for this contest happens in the room, not here");
    if (c.auctionPausedAt) throw reject("auction_paused", "the organisers have paused the auction");
    if (l.state !== "open") throw reject("bidding_closed", "bidding on this question has closed");
    if (l.currentBidderId === participantId) throw reject("already_highest", "you already hold the highest bid");
    const expected = nextBidAmount(l.currentBid, q.basePrice, c.bidIncrement);
    if (amount !== expected) throw reject("wrong_increment", `the next legal bid is ${expected}`);
    if (amount > p.balance) throw reject("insufficient_balance", `you have ${p.balance}; this bid is ${amount}`);
    if (c.ownershipCap !== null) {
      const [{ owned }] = await tx
        .select({ owned: count() })
        .from(ownership)
        .where(and(eq(ownership.participantId, participantId), isNull(ownership.voidedAt)));
      if (owned >= c.ownershipCap) throw reject("ownership_cap_reached", `you already own the maximum of ${c.ownershipCap} questions`);
    }

    await tx.insert(bid).values({ lotId, participantId, amount });
    await tx
      .update(lot)
      .set({
        currentBid: amount,
        currentBidderId: participantId,
        noBidDeadline: null,
        // The countdown restarts on every bid (US-B3-03). countdown_seconds of 0
        // means the administrator disabled it: manual close only.
        biddingEndsAt: c.countdownSeconds > 0 ? new Date(Date.now() + c.countdownSeconds * 1000) : null,
      })
      .where(eq(lot.id, lotId));
  });

  publish("auction", await auctionSnapshot(c.phase === "auction2" ? 2 : 1));
}

// ---------------------------------------------------------------------------
// Lot lifecycle
// ---------------------------------------------------------------------------

/** Create the lots for a round. Round 1: every question in auction order. Round 2: the unsold ones. */
export async function createLotsForRound(round: 1 | 2): Promise<number> {
  const qs = await db
    .select({ id: question.id, order: question.auctionOrder })
    .from(question)
    .where(round === 1 ? sql`${question.status} <> 'void'` : eq(question.status, "unsold"))
    .orderBy(asc(question.auctionOrder), asc(question.id));
  if (qs.length === 0) return 0;
  await db
    .insert(lot)
    .values(qs.map((q, i) => ({ questionId: q.id, round, order: i + 1, state: "pending" as const })))
    .onConflictDoNothing();
  return qs.length;
}

/** Open the next pending lot of the round, if any. Returns whether one opened. */
export async function openNextLot(round: number): Promise<boolean> {
  const c = await getContest();
  if (c.auctionPausedAt) return false;
  const opened = await db.transaction(async (tx) => {
    const [already] = await tx.select({ id: lot.id }).from(lot).where(eq(lot.state, "open")).limit(1);
    if (already) return false;
    const [next] = await tx
      .select()
      .from(lot)
      .where(and(eq(lot.round, round), eq(lot.state, "pending")))
      .orderBy(asc(lot.order))
      .limit(1)
      .for("update");
    if (!next) return false;
    const now = Date.now();
    // Offline, the auctioneer decides when a lot is done, so it opens with no
    // deadline at all — otherwise the scheduler would settle it as unsold from
    // under a room that is still bidding.
    const offline = c.auctionMode === "offline";
    await tx
      .update(lot)
      .set({
        state: "open",
        openedAt: new Date(now),
        // The opening window: no bid by then and the question goes unsold (US-B3-03).
        noBidDeadline: offline ? null : new Date(now + c.openingWindowSeconds * 1000),
        biddingEndsAt: null,
      })
      .where(eq(lot.id, next.id));
    return true;
  });
  if (opened) publish("auction", await auctionSnapshot(round));
  return opened;
}

/** Settle an open lot: award to the highest bidder, or mark it unsold. */
export async function closeLot(lotId: number, actor?: { id: string; reason: string }): Promise<"sold" | "unsold"> {
  const outcome = await db.transaction(async (tx) => {
    const [l] = await tx.select().from(lot).where(eq(lot.id, lotId)).for("update");
    if (!l || l.state !== "open") throw errors.conflict("not_open", "that lot is not open");

    if (l.currentBidderId === null || l.currentBid === null) {
      await tx.update(lot).set({ state: "unsold", closedAt: new Date() }).where(eq(lot.id, lotId));
      if (actor) await audit({ actorId: actor.id, action: "lot.close", target: String(lotId), reason: actor.reason, detail: { outcome: "unsold" } }, tx);
      return "unsold" as const;
    }

    await award(tx, l.id, l.questionId, l.currentBidderId, l.currentBid);
    if (actor) await audit({ actorId: actor.id, action: "lot.close", target: String(lotId), reason: actor.reason, detail: { outcome: "sold", to: l.currentBidderId, price: l.currentBid } }, tx);
    return "sold" as const;
  });

  const c = await getContest();
  publish("auction", await auctionSnapshot(c.phase === "auction2" ? 2 : 1));
  publish("leaderboard", {});
  return outcome;
}

/** Exactly the winning bid is deducted, and ownership becomes sole and final (US-B3-03). */
export async function award(tx: Tx, lotId: number, questionId: string, winnerId: string, price: number): Promise<void> {
  const [p] = await tx.select().from(participant).where(eq(participant.userId, winnerId)).for("update");
  const balanceAfter = p.balance - price; // CHECK (balance >= 0) is the backstop
  await tx.update(participant).set({ balance: balanceAfter }).where(eq(participant.userId, winnerId));
  await tx.insert(ownership).values({ questionId, participantId: winnerId, pricePaid: price });
  await tx.insert(ledger).values({ participantId: winnerId, delta: -price, balanceAfter, reason: "bid_won", ref: questionId });
  await tx.update(lot).set({ state: "closed", closedAt: new Date() }).where(eq(lot.id, lotId));
  await tx.update(question).set({ status: "sold" }).where(eq(question.id, questionId));
  publish("balance", { balance: balanceAfter }, winnerId);
  publish("notify", { body: `You won **${questionId}** for ${price}.` }, winnerId);
}

/** Administrator: close bidding now. `bidding_ends_at = now()` in spirit, done directly. */
export async function closeLotNow(actorId: string, reason: string): Promise<void> {
  const open = await currentLot();
  if (!open) throw errors.conflict("no_open_lot", "no question is open for bidding");
  await closeLot(open.lot.id, { id: actorId, reason });
  const c = await getContest();
  await openNextLot(c.phase === "auction2" ? 2 : 1);
}

/**
 * The scheduler calls this every tick. Deadlines are columns, so a restart
 * loses nothing -- the loop rereads them and carries on (decision 66).
 */
export async function tickAuction(): Promise<void> {
  const c = await getContest();
  if (c.phase !== "auction1" && c.phase !== "auction2") return;
  if (c.auctionPausedAt) return; // held by an administrator; resume shifts the deadlines
  const round = c.phase === "auction2" ? 2 : 1;
  // Offline the app settles nothing: it opens the next lot when the previous
  // one has been recorded, and otherwise waits for a person.
  if (c.auctionMode === "offline") {
    if (!(await currentLot())) await openNextLot(round);
    return;
  }
  const open = await currentLot();
  const now = Date.now();

  if (!open) {
    await openNextLot(round);
    return;
  }
  const l = open.lot;
  const noBids = l.currentBidderId === null;
  const openingWindowPassed = noBids && l.noBidDeadline !== null && l.noBidDeadline.getTime() <= now;
  const countdownPassed = !noBids && l.biddingEndsAt !== null && l.biddingEndsAt.getTime() <= now;
  if (openingWindowPassed || countdownPassed) {
    await closeLot(l.id);
    await openNextLot(round);
  }
}

/** Administrator: hand an unsold question to a participant who owns nothing (US-B4-03). */
export async function assignQuestion(
  actorId: string,
  input: { questionId: string; participantId: string; price: number; reason: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [q] = await tx.select().from(question).where(eq(question.id, input.questionId)).for("update");
    if (!q) throw errors.notFound("question");
    if (q.status !== "unsold") throw errors.conflict("not_unsold", "only an unsold question can be assigned");
    const [p] = await tx.select().from(participant).where(eq(participant.userId, input.participantId)).for("update");
    if (!p) throw errors.notFound("participant");
    if (input.price > p.balance) throw errors.conflict("insufficient_balance", `they have ${p.balance}`);
    const balanceAfter = p.balance - input.price;
    await tx.update(participant).set({ balance: balanceAfter }).where(eq(participant.userId, input.participantId));
    await tx.insert(ownership).values({ questionId: q.id, participantId: input.participantId, pricePaid: input.price });
    await tx.insert(ledger).values({ participantId: input.participantId, delta: -input.price, balanceAfter, reason: "bid_won", ref: q.id });
    await tx.update(question).set({ status: "sold" }).where(eq(question.id, q.id));
    await audit({ actorId, action: "question.assign", target: q.id, reason: input.reason, detail: input }, tx);
  });
  publish("balance", {}, input.participantId);
  publish("notify", { body: `An organiser assigned you **${input.questionId}**.` }, input.participantId);
}
