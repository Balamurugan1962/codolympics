/**
 * The administrator's hands on the auction.
 *
 * Bidding itself is in auction.ts and is deliberately mechanical: a lot opens,
 * the clock runs, the highest bid wins. This file is everything that happens
 * when the room does not cooperate — a projector dies mid-lot, a package turns
 * out broken after it sold, somebody bids on the wrong question.
 *
 * Two rules hold for every function here, the same as everywhere else on the
 * admin side: nothing happens without a reason, and the audit row is written in
 * the same transaction as the change, so there is no state in which the contest
 * moved and the log does not say who moved it.
 *
 * The clock is the part that needs care. Deadlines are columns on `lot`, read
 * by the scheduler once a second (decision 66), which is what makes them
 * survive a restart. It also means a pause that only stops the scheduler would
 * leave the deadlines in the past: everything would settle at once the moment
 * the auction resumed. So a pause records when it started, and a resume pushes
 * every live deadline forward by exactly that long.
 */
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { bid, contest, hintPurchase, lot, ownership, participant, question } from "@/db/schema";
import { count } from "drizzle-orm";

import { credit, notify } from "./admin";
import { errors } from "./api";
import { auctionSnapshot, award, currentLot, openNextLot } from "./auction";
import { audit } from "./audit";
import { getContest } from "./contest";
import { publish } from "./events";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The round currently on the block, or null outside an auction phase. */
async function activeRound(): Promise<1 | 2 | null> {
  const c = await getContest();
  return c.phase === "auction1" ? 1 : c.phase === "auction2" ? 2 : null;
}

async function announce(): Promise<void> {
  const round = await activeRound();
  if (round) publish("auction", await auctionSnapshot(round));
}

// ---------------------------------------------------------------------------
// Pause and resume
// ---------------------------------------------------------------------------

/**
 * Hold the auction. The scheduler stops settling lots, bids are refused, and
 * the countdown on screen freezes where it is.
 */
export async function pauseAuction(actorId: string, reason: string): Promise<void> {
  if (!(await activeRound())) throw errors.conflict("not_auctioning", "no auction is running");
  await db.transaction(async (tx) => {
    const [c] = await tx.select().from(contest).where(eq(contest.id, 1)).for("update");
    if (c.auctionPausedAt) throw errors.conflict("already_paused", "the auction is already paused");
    await tx.update(contest).set({ auctionPausedAt: new Date() }).where(eq(contest.id, 1));
    const open = await tx.select({ id: lot.id }).from(lot).where(eq(lot.state, "open")).limit(1);
    await audit({ actorId, action: "auction.pause", target: open[0] ? String(open[0].id) : null, reason }, tx);
  });
  await announce();
}

/**
 * Let it run again, giving back exactly the time the pause took.
 *
 * Both deadlines move: the opening window on a lot nobody has bid on, and the
 * countdown on one somebody has. A lot with eight seconds left when it was
 * paused has eight seconds when it resumes, however long the interruption was.
 */
export async function resumeAuction(actorId: string, reason: string): Promise<number> {
  if (!(await activeRound())) throw errors.conflict("not_auctioning", "no auction is running");
  const heldMs = await db.transaction(async (tx) => {
    const [c] = await tx.select().from(contest).where(eq(contest.id, 1)).for("update");
    if (!c.auctionPausedAt) throw errors.conflict("not_paused", "the auction is not paused");
    const held = Date.now() - c.auctionPausedAt.getTime();

    // Postgres does the arithmetic so a slow round trip cannot shave the gap.
    const shift = sql`make_interval(secs => ${held / 1000})`;
    await tx
      .update(lot)
      .set({
        noBidDeadline: sql`case when ${lot.noBidDeadline} is null then null else ${lot.noBidDeadline} + ${shift} end`,
        biddingEndsAt: sql`case when ${lot.biddingEndsAt} is null then null else ${lot.biddingEndsAt} + ${shift} end`,
      })
      .where(eq(lot.state, "open"));

    await tx.update(contest).set({ auctionPausedAt: null }).where(eq(contest.id, 1));
    await audit({ actorId, action: "auction.resume", reason, detail: { held_ms: held } }, tx);
    return held;
  });
  await announce();
  return heldMs;
}

// ---------------------------------------------------------------------------
// The queue: withdraw, restore, reorder
// ---------------------------------------------------------------------------

/**
 * Pull a question off the block.
 *
 * A lot that has not been offered yet simply stops being offered. The lot that
 * is open right now can also be withdrawn — that is the case this exists for,
 * a package found broken while people are bidding on it — and withdrawing it
 * settles nothing: no winner, no money, and the bids are kept so the record
 * shows what was happening when it was pulled.
 */
export async function withdrawLot(actorId: string, lotId: number, reason: string): Promise<void> {
  const openedNext = await db.transaction(async (tx) => {
    const [l] = await tx.select().from(lot).where(eq(lot.id, lotId)).for("update");
    if (!l) throw errors.notFound("lot");
    if (l.state === "withdrawn") throw errors.conflict("already_withdrawn", "that question is already off the block");
    if (l.state === "closed" || l.state === "unsold") {
      throw errors.conflict("already_settled", "that lot has already been settled — take the question back instead");
    }
    const wasOpen = l.state === "open";
    await tx
      .update(lot)
      .set({ state: "withdrawn", closedAt: new Date(), noBidDeadline: null, biddingEndsAt: null })
      .where(eq(lot.id, lotId));
    await audit({ actorId, action: "lot.withdraw", target: String(lotId), reason, detail: { question: l.questionId, was: l.state, bids: l.currentBid } }, tx);
    return wasOpen;
  });
  await announce();
  // Withdrawing what was on the block leaves nothing open; the scheduler would
  // pick the next one up within a second, but doing it here keeps the screen
  // from showing a gap at the exact moment everyone is looking at it.
  if (openedNext) {
    const c = await getContest();
    if (!c.auctionPausedAt) {
      const { openNextLot } = await import("./auction");
      const round = await activeRound();
      if (round) await openNextLot(round);
    }
  }
}

/** Put a withdrawn question back at the end of the queue. */
export async function restoreLot(actorId: string, lotId: number, reason: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [l] = await tx.select().from(lot).where(eq(lot.id, lotId)).for("update");
    if (!l) throw errors.notFound("lot");
    if (l.state !== "withdrawn") throw errors.conflict("not_withdrawn", "that lot is not withdrawn");
    const [{ last }] = await tx
      .select({ last: sql<number>`coalesce(max(${lot.order}), 0)::int` })
      .from(lot)
      .where(eq(lot.round, l.round));
    await tx
      .update(lot)
      .set({ state: "pending", order: last + 1, closedAt: null, openedAt: null, currentBid: null, currentBidderId: null })
      .where(eq(lot.id, lotId));
    await audit({ actorId, action: "lot.restore", target: String(lotId), reason, detail: { question: l.questionId, order: last + 1 } }, tx);
  });
  await announce();
}

/**
 * Reorder what has not been offered yet.
 *
 * Only pending lots move. A lot that is open, settled or withdrawn keeps the
 * position it had, because its position is now a fact about what happened
 * rather than a plan — renumbering it would rewrite the record of the round.
 */
export async function reorderLots(actorId: string, round: number, lotIds: number[], reason: string): Promise<void> {
  await db.transaction(async (tx) => {
    const pending = await tx
      .select({ id: lot.id, order: lot.order })
      .from(lot)
      .where(and(eq(lot.round, round), eq(lot.state, "pending")))
      .orderBy(asc(lot.order));
    const known = new Set(pending.map((p) => p.id));
    if (lotIds.length !== known.size || lotIds.some((id) => !known.has(id))) {
      throw errors.invalid("the new order must list every question still to be offered, exactly once");
    }
    // The slots the pending lots already occupy are reused, so the order of
    // everything that has been offered stays where it is.
    const slots = pending.map((p) => p.order).sort((a, b) => a - b);
    for (let i = 0; i < lotIds.length; i++) {
      await tx.update(lot).set({ order: slots[i] }).where(eq(lot.id, lotIds[i]));
    }
    await audit({ actorId, action: "lot.reorder", target: String(round), reason, detail: { order: lotIds } }, tx);
  });
  await announce();
}

// ---------------------------------------------------------------------------
// The open lot: timer and bids
// ---------------------------------------------------------------------------

export type TimerMode = "off" | "restart" | "adjust";

/**
 * Change the clock on the lot being bid on.
 *
 * "off" leaves it open until closed by hand. "restart" puts a full countdown
 * back, which is also how a disabled timer is turned on again. "adjust" adds
 * or removes seconds — the usual case is buying the room thirty more seconds
 * because somebody is still deciding.
 */
export async function setLotTimer(
  actorId: string,
  input: { mode: TimerMode; seconds?: number; reason: string },
): Promise<void> {
  const c = await getContest();
  const open = await currentLot();
  if (!open) throw errors.conflict("no_open_lot", "no question is open for bidding");
  const l = open.lot;
  /* Which clock is live depends on whether anyone has bid: before the first bid
   * it is the opening window, after it the countdown. Only one is ever set. */
  const bidding = l.currentBidderId !== null;

  let noBidDeadline: Date | null = l.noBidDeadline;
  let biddingEndsAt: Date | null = l.biddingEndsAt;

  if (input.mode === "off") {
    noBidDeadline = null;
    biddingEndsAt = null;
  } else if (input.mode === "restart") {
    const secs = bidding ? c.countdownSeconds : c.openingWindowSeconds;
    if (secs <= 0) throw errors.conflict("no_countdown", "the countdown is set to 0 in Settings, so there is nothing to restart");
    noBidDeadline = bidding ? null : new Date(Date.now() + secs * 1000);
    biddingEndsAt = bidding ? new Date(Date.now() + secs * 1000) : null;
  } else {
    const delta = Math.trunc(input.seconds ?? 0);
    if (!delta) throw errors.invalid("say how many seconds to add or remove");
    const live = bidding ? biddingEndsAt : noBidDeadline;
    if (!live) throw errors.conflict("timer_off", "this lot has no timer to adjust — restart it first");
    // Never push a deadline into the past: that would settle the lot on the
    // next tick, which is a close, not an adjustment. Closing is its own action.
    const next = new Date(Math.max(Date.now() + 1000, live.getTime() + delta * 1000));
    if (bidding) biddingEndsAt = next;
    else noBidDeadline = next;
  }

  await db.transaction(async (tx) => {
    await tx.update(lot).set({ noBidDeadline, biddingEndsAt }).where(eq(lot.id, l.id));
    await audit({
      actorId,
      action: "lot.timer",
      target: String(l.id),
      reason: input.reason,
      detail: { mode: input.mode, seconds: input.seconds ?? null, ends_at: (bidding ? biddingEndsAt : noBidDeadline)?.toISOString() ?? null },
    }, tx);
  });
  await announce();
}

/**
 * Undo the top bid on the open lot.
 *
 * For the misclick: the bid is removed and the lot goes back to whoever held it
 * before, with the clock restarted so the room gets the same chance to respond
 * that it would have had. No balance moves, because bidding never debits — only
 * winning does.
 */
export async function retractTopBid(actorId: string, reason: string): Promise<{ removed: number; bidder: string }> {
  const result = await db.transaction(async (tx) => {
    const [l] = await tx.select().from(lot).where(eq(lot.state, "open")).limit(1).for("update");
    if (!l) throw errors.conflict("no_open_lot", "no question is open for bidding");
    const [top] = await tx.select().from(bid).where(eq(bid.lotId, l.id)).orderBy(desc(bid.id)).limit(1);
    if (!top) throw errors.conflict("no_bids", "there are no bids on this question to retract");

    await tx.delete(bid).where(eq(bid.id, top.id));
    const [prev] = await tx.select().from(bid).where(eq(bid.lotId, l.id)).orderBy(desc(bid.id)).limit(1);

    const c = await getContest();
    const now = Date.now();
    await tx
      .update(lot)
      .set({
        currentBid: prev?.amount ?? null,
        currentBidderId: prev?.participantId ?? null,
        // Back to whichever clock matches the state we just restored.
        noBidDeadline: prev ? null : new Date(now + c.openingWindowSeconds * 1000),
        biddingEndsAt: prev && c.countdownSeconds > 0 ? new Date(now + c.countdownSeconds * 1000) : null,
      })
      .where(eq(lot.id, l.id));

    await audit({
      actorId,
      action: "bid.retract",
      target: String(l.id),
      reason,
      detail: { amount: top.amount, bidder: top.participantId, restored_to: prev?.participantId ?? null },
    }, tx);
    await notify(tx, top.participantId, `Your bid of ${top.amount} was retracted by an organiser. Reason: ${reason}`);
    return { removed: top.amount, bidder: top.participantId };
  });
  await announce();
  return result;
}

// ---------------------------------------------------------------------------
// Undoing a sale
// ---------------------------------------------------------------------------

export type TakeBack = {
  questionId: string;
  refundPrice: boolean;
  refundHints: boolean;
  /** Put it back in the queue to be offered again, rather than leaving it unsold. */
  relist: boolean;
  reason: string;
};

/**
 * Take a sold question back off its owner.
 *
 * Distinct from voiding: voiding says the question was bad and removes it from
 * the contest for everyone. This says the sale was wrong, and the question is
 * fine — so it returns to unsold and can be offered or assigned again.
 *
 * Submissions and judgements are kept. Scoring already joins through a
 * non-voided ownership row, so the points stop counting the moment ownership is
 * voided, without deleting anything a dispute might need later.
 *
 * Refunded hints have their purchase rows removed as well. Leaving them would
 * mean the money came back and the hints stayed bought, so winning the question
 * again would unlock them for nothing.
 */
export async function takeBackQuestion(actorId: string, input: TakeBack): Promise<{ refunded: number; owner: string }> {
  const result = await db.transaction(async (tx) => {
    const [q] = await tx.select().from(question).where(eq(question.id, input.questionId)).for("update");
    if (!q) throw errors.notFound("question");
    const [own] = await tx
      .select()
      .from(ownership)
      .where(and(eq(ownership.questionId, q.id), isNull(ownership.voidedAt)));
    if (!own) throw errors.conflict("not_owned", "nobody owns that question");

    await tx.update(ownership).set({ voidedAt: new Date() }).where(eq(ownership.questionId, q.id));

    let refunded = 0;
    if (input.refundPrice) refunded += own.pricePaid;
    if (input.refundHints) {
      const hints = await tx
        .select()
        .from(hintPurchase)
        .where(and(eq(hintPurchase.questionId, q.id), eq(hintPurchase.participantId, own.participantId)));
      refunded += hints.reduce((s, h) => s + h.pricePaid, 0);
      if (hints.length) {
        await tx.delete(hintPurchase).where(and(eq(hintPurchase.questionId, q.id), eq(hintPurchase.participantId, own.participantId)));
      }
    }
    if (refunded > 0) await credit(tx, own.participantId, refunded, "refund", `takeback:${q.id}`);

    await tx.update(question).set({ status: "unsold" }).where(eq(question.id, q.id));
    if (input.relist) await relist(tx, q.id);

    await notify(
      tx,
      own.participantId,
      `**${q.title}** was taken back by the organisers${refunded ? ` and ${refunded} was refunded to you` : ""}. Reason: ${input.reason}`,
    );
    await audit({
      actorId,
      action: "question.take_back",
      target: q.id,
      reason: input.reason,
      detail: { owner: own.participantId, price: own.pricePaid, refunded, relisted: input.relist },
    }, tx);
    return { refunded, owner: own.participantId };
  });

  await announce();
  publish("balance", {}, result.owner);
  publish("leaderboard", {});
  return result;
}

/** Put a question back at the end of the current round's queue. */
async function relist(tx: Tx, questionId: string): Promise<void> {
  const [c] = await tx.select().from(contest).where(eq(contest.id, 1));
  const round = c.phase === "auction2" ? 2 : 1;
  const [{ last }] = await tx
    .select({ last: sql<number>`coalesce(max(${lot.order}), 0)::int` })
    .from(lot)
    .where(eq(lot.round, round));
  const fresh = {
    state: "pending" as const,
    order: last + 1,
    openedAt: null,
    closedAt: null,
    currentBid: null,
    currentBidderId: null,
    noBidDeadline: null,
    biddingEndsAt: null,
  };
  const [existing] = await tx.select({ id: lot.id }).from(lot).where(and(eq(lot.questionId, questionId), eq(lot.round, round)));
  if (existing) await tx.update(lot).set(fresh).where(eq(lot.id, existing.id));
  else await tx.insert(lot).values({ questionId, round, ...fresh });
}

// ---------------------------------------------------------------------------
// What the control page reads
// ---------------------------------------------------------------------------

/** Every lot of the round with its owner, for the administrator's view only. */
export async function auctionControlSnapshot() {
  const c = await getContest();
  const round = c.phase === "auction2" ? 2 : 1;
  const rows = await db
    .select({
      id: lot.id,
      questionId: lot.questionId,
      title: question.title,
      difficulty: question.difficulty,
      score: question.score,
      basePrice: question.basePrice,
      status: question.status,
      state: lot.state,
      order: lot.order,
      currentBid: lot.currentBid,
      openedAt: lot.openedAt,
      closedAt: lot.closedAt,
      ownerId: ownership.participantId,
      ownerName: user.name,
      pricePaid: ownership.pricePaid,
    })
    .from(lot)
    .innerJoin(question, eq(question.id, lot.questionId))
    .leftJoin(ownership, and(eq(ownership.questionId, lot.questionId), isNull(ownership.voidedAt)))
    .leftJoin(user, eq(user.id, ownership.participantId))
    .where(eq(lot.round, round))
    .orderBy(asc(lot.order));

  return {
    round,
    mode: c.auctionMode,
    paused_at: c.auctionPausedAt?.toISOString() ?? null,
    countdown_seconds: c.countdownSeconds,
    opening_window_seconds: c.openingWindowSeconds,
    lots: rows.map((r) => ({
      id: r.id,
      question_id: r.questionId,
      title: r.title,
      difficulty: r.difficulty,
      score: r.score,
      base_price: r.basePrice,
      status: r.status,
      state: r.state,
      order: r.order,
      current_bid: r.currentBid,
      opened_at: r.openedAt?.toISOString() ?? null,
      closed_at: r.closedAt?.toISOString() ?? null,
      owner_id: r.ownerId,
      owner_name: r.ownerName,
      price_paid: r.pricePaid,
    })),
    // Only ever sent to an administrator: this route is admin-gated, and a
    // participant's own snapshot carries their balance and nobody else's.
    balances: await bidderBalances(),
    server_now: Date.now(),
  };
}


// ---------------------------------------------------------------------------
// The offline auction
// ---------------------------------------------------------------------------

/**
 * Record a sale the auctioneer made in the room.
 *
 * Offline, the app decides nothing: a person calls the lot, a hand goes up, and
 * this writes down what happened. What it still does is refuse to write down
 * something impossible — a price the buyer cannot cover, a question somebody
 * already owns, a buyer past the ownership cap — because those are not
 * judgement calls the room can make. The money is inside the contest whether it
 * was bid on a screen or shouted across a hall.
 *
 * Settlement goes through the same `award` the online close uses. There is one
 * way to pay for a question, not two.
 */
export async function recordSale(
  actorId: string,
  input: { lotId: number; participantId: string; price: number; reason: string },
): Promise<void> {
  const c = await getContest();
  if (c.auctionMode !== "offline") throw errors.conflict("not_offline", "this contest runs its auction online");
  if (!(await activeRound())) throw errors.conflict("not_auctioning", "no auction is running");
  if (c.auctionPausedAt) throw errors.conflict("auction_paused", "the auction is paused — resume it before recording a sale");
  if (!Number.isInteger(input.price) || input.price < 0) throw errors.invalid("the price must be a whole number");

  await db.transaction(async (tx) => {
    const [l] = await tx.select().from(lot).where(eq(lot.id, input.lotId)).for("update");
    if (!l) throw errors.notFound("lot");
    if (l.state !== "open") throw errors.conflict("not_open", "that question is not on the block");

    const [q] = await tx.select().from(question).where(eq(question.id, l.questionId));
    // The base price is published in advance; a sale under it is a different
    // question from the one everyone was bidding on.
    if (input.price < q.basePrice) throw errors.conflict("below_base", `the base price is ${q.basePrice}`);

    const [p] = await tx.select().from(participant).where(eq(participant.userId, input.participantId)).for("update");
    if (!p) throw errors.notFound("participant");
    if (p.disqualifiedAt) throw errors.conflict("disqualified", "that account is disqualified");
    if (input.price > p.balance) throw errors.conflict("insufficient_balance", `they have ${p.balance}, and this sale is ${input.price}`);

    if (c.ownershipCap !== null) {
      const [{ owned }] = await tx
        .select({ owned: count() })
        .from(ownership)
        .where(and(eq(ownership.participantId, input.participantId), isNull(ownership.voidedAt)));
      if (owned >= c.ownershipCap) throw errors.conflict("ownership_cap_reached", `they already own the maximum of ${c.ownershipCap}`);
    }

    await award(tx, l.id, l.questionId, input.participantId, input.price);
    await audit({
      actorId,
      action: "lot.record_sale",
      target: String(l.id),
      reason: input.reason,
      detail: { question: l.questionId, to: input.participantId, price: input.price, mode: "offline" },
    }, tx);
  });

  await announce();
  publish("leaderboard", {});
  const round = await activeRound();
  if (round) await openNextLot(round);
}

/** Nobody bid, or nobody bid enough: close the lot with nothing sold. */
export async function recordUnsold(actorId: string, input: { lotId: number; reason: string }): Promise<void> {
  const c = await getContest();
  if (c.auctionMode !== "offline") throw errors.conflict("not_offline", "this contest runs its auction online");
  await db.transaction(async (tx) => {
    const [l] = await tx.select().from(lot).where(eq(lot.id, input.lotId)).for("update");
    if (!l) throw errors.notFound("lot");
    if (l.state !== "open") throw errors.conflict("not_open", "that question is not on the block");
    await tx.update(lot).set({ state: "unsold", closedAt: new Date(), noBidDeadline: null, biddingEndsAt: null }).where(eq(lot.id, l.id));
    await audit({ actorId, action: "lot.record_unsold", target: String(l.id), reason: input.reason, detail: { question: l.questionId, mode: "offline" } }, tx);
  });
  await announce();
  const round = await activeRound();
  if (round) await openNextLot(round);
}

/**
 * Who can still afford what, for the organiser running the room.
 *
 * The auctioneer's question between lots is "who is still in this" — and with
 * bidding happening out loud rather than on screens, nothing else on the admin
 * side answers it. Administrators only: a participant sees their own balance
 * and no one else's, the same as in an online round.
 */
export async function bidderBalances() {
  const rows = await db
    .select({ id: participant.userId, name: user.name, balance: participant.balance, disqualified: participant.disqualifiedAt })
    .from(participant)
    .innerJoin(user, eq(user.id, participant.userId))
    .orderBy(desc(participant.balance));
  const owned = await db
    .select({ pid: ownership.participantId, n: count() })
    .from(ownership)
    .where(isNull(ownership.voidedAt))
    .groupBy(ownership.participantId);
  const by = new Map(owned.map((o) => [o.pid, o.n]));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    balance: r.balance,
    owned: by.get(r.id) ?? 0,
    disqualified: Boolean(r.disqualified),
  }));
}
