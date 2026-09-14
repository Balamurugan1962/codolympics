/**
 * The administrator's controls over a running auction, against a real Postgres.
 *
 * The one that needs proving is pause: the clock is a pair of columns read by
 * the scheduler, so a pause that only stops the scheduler would leave deadlines
 * in the past and settle every lot at once on resume. What is asserted here is
 * that the time comes back — a lot with N seconds left before the hold has N
 * seconds after it, however long the hold was.
 */
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db, sql as pg } from "@/db";
import { user } from "@/db/auth-schema";
import { bid, contest, hintPurchase, ledger, lot, ownership, participant, question } from "@/db/schema";
import { closeLot, openNextLot, placeBid, tickAuction } from "@/lib/auction";
import { pauseAuction, restoreLot, resumeAuction, retractTopBid, takeBackQuestion, withdrawLot } from "@/lib/auction-control";

const A = "ctl-alice";
const B = "ctl-bob";
const ADMIN = "ctl-admin";
const Q1 = "ctl-q1";
const Q2 = "ctl-q2";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Leave nothing behind. The contest row is shared with every other database
 * test, and so is the question table: a leftover `ctl-` question would be
 * picked up by createLotsForRound in another file and open ahead of its lot.
 */
async function cleanup() {
  await db.execute(sql`truncate table bid, ownership, ledger, lot, hint_purchase, submission, judgement, draft, notification, audit_log restart identity cascade`);
  await db.delete(participant).where(sql`${participant.userId} like 'ctl-%'`);
  await db.delete(user).where(sql`${user.id} like 'ctl-%'`);
  await db.delete(question).where(sql`${question.id} like 'ctl-%'`);
  await db.update(contest).set({ auctionPausedAt: null }).where(eq(contest.id, 1));
}

async function reset() {
  await cleanup();
  await db.insert(contest).values({ id: 1 }).onConflictDoNothing();
  await db
    .update(contest)
    .set({ phase: "auction1", bidIncrement: 10, countdownSeconds: 60, openingWindowSeconds: 60, ownershipCap: null, auctionPausedAt: null })
    .where(eq(contest.id, 1));

  const now = new Date();
  for (const [id, name] of [[A, "Alice"], [B, "Bob"], [ADMIN, "Admin"]] as const) {
    await db.insert(user).values({ id, name, email: `${id}@t.invalid`, emailVerified: true, createdAt: now, updatedAt: now, role: id === ADMIN ? "admin" : "participant" });
  }
  for (const id of [A, B]) await db.insert(participant).values({ userId: id, balance: 1000 });
  await db.insert(question).values([
    { id: Q1, title: "First", difficulty: "easy", score: 100, basePrice: 100, auctionOrder: 1 },
    { id: Q2, title: "Second", difficulty: "easy", score: 100, basePrice: 100, auctionOrder: 2 },
  ]);
  await db.insert(lot).values([
    { questionId: Q1, round: 1, order: 1, state: "pending" },
    { questionId: Q2, round: 1, order: 2, state: "pending" },
  ]);
}

const openLot = async () => (await db.select().from(lot).where(eq(lot.state, "open")).limit(1))[0];

beforeEach(reset);
afterAll(async () => {
  await cleanup();
  await pg.end();
});

describe("pause and resume", () => {
  it("gives back exactly the time it held, on both clocks", async () => {
    await openNextLot(1);
    await placeBid(A, (await openLot()).id, 100); // arms bidding_ends_at
    const before = (await openLot()).biddingEndsAt!.getTime();

    await pauseAuction(ADMIN, "projector died");
    await sleep(1200);
    const held = await resumeAuction(ADMIN, "back on");

    const after = (await openLot()).biddingEndsAt!.getTime();
    expect(held).toBeGreaterThanOrEqual(1100);
    // The deadline moved forward by the hold, within a tolerance for round trips.
    expect(after - before).toBeGreaterThan(held - 200);
    expect(after - before).toBeLessThan(held + 400);
  });

  it("moves the opening window when nobody has bid", async () => {
    await openNextLot(1);
    const before = (await openLot()).noBidDeadline!.getTime();
    await pauseAuction(ADMIN, "hold");
    await sleep(600);
    await resumeAuction(ADMIN, "resume");
    const l = await openLot();
    expect(l.noBidDeadline!.getTime()).toBeGreaterThan(before + 400);
    expect(l.biddingEndsAt).toBeNull(); // still no bids: the countdown stays unarmed
  });

  it("refuses bids and settles nothing while held", async () => {
    await openNextLot(1);
    const id = (await openLot()).id;
    await pauseAuction(ADMIN, "hold");

    await expect(placeBid(A, id, 100)).rejects.toMatchObject({ code: "auction_paused" });

    // A deadline that has already passed must not settle while held. It stays
    // expired across the hold — the shift on resume is the length of the hold,
    // not an amnesty — so the scheduler settles it the moment the hold lifts.
    await db.update(lot).set({ noBidDeadline: new Date(Date.now() - 5000) }).where(eq(lot.id, id));
    await tickAuction();
    expect((await openLot()).id).toBe(id);
    expect((await db.select().from(lot).where(eq(lot.id, id)))[0].state).toBe("open");

    await resumeAuction(ADMIN, "resume");
    await tickAuction();
    expect((await db.select().from(lot).where(eq(lot.id, id)))[0].state).toBe("unsold");
    expect((await openLot()).questionId).toBe(Q2);
  });

  it("refuses a double pause and a resume that was never paused", async () => {
    await expect(resumeAuction(ADMIN, "x")).rejects.toMatchObject({ code: "not_paused" });
    await pauseAuction(ADMIN, "hold");
    await expect(pauseAuction(ADMIN, "again")).rejects.toMatchObject({ code: "already_paused" });
  });
});

describe("withdraw and restore", () => {
  it("pulls the open lot without selling it, and opens the next", async () => {
    await openNextLot(1);
    const first = await openLot();
    await placeBid(A, first.id, 100);

    await withdrawLot(ADMIN, first.id, "package is broken");

    const [pulled] = await db.select().from(lot).where(eq(lot.id, first.id));
    expect(pulled.state).toBe("withdrawn");
    expect(await db.select().from(ownership)).toHaveLength(0);
    expect((await db.select().from(participant).where(eq(participant.userId, A)))[0].balance).toBe(1000);
    // The bid is kept: it is the record of what was happening when it was pulled.
    expect(await db.select().from(bid)).toHaveLength(1);
    // And the round carries on.
    expect((await openLot()).questionId).toBe(Q2);
  });

  it("puts a withdrawn question back at the end of the queue", async () => {
    const [l] = await db.select().from(lot).where(eq(lot.questionId, Q1));
    await withdrawLot(ADMIN, l.id, "pulled");
    await restoreLot(ADMIN, l.id, "fixed");
    const [back] = await db.select().from(lot).where(eq(lot.id, l.id));
    expect(back.state).toBe("pending");
    expect(back.order).toBe(3); // after Q2
  });

  it("will not withdraw something already settled", async () => {
    await openNextLot(1);
    const l = await openLot();
    await placeBid(A, l.id, 100);
    await closeLot(l.id);
    await expect(withdrawLot(ADMIN, l.id, "too late")).rejects.toMatchObject({ code: "already_settled" });
  });
});

describe("retracting a bid", () => {
  it("restores the previous bidder and moves no money", async () => {
    await openNextLot(1);
    const id = (await openLot()).id;
    await placeBid(A, id, 100);
    await placeBid(B, id, 110);

    const out = await retractTopBid(ADMIN, "misclick");
    expect(out).toMatchObject({ removed: 110, bidder: B });

    const l = await openLot();
    expect(l.currentBid).toBe(100);
    expect(l.currentBidderId).toBe(A);
    expect(await db.select().from(bid)).toHaveLength(1);
    for (const id of [A, B]) {
      expect((await db.select().from(participant).where(eq(participant.userId, id)))[0].balance).toBe(1000);
    }
  });

  it("clears the lot back to no bids when the only bid goes", async () => {
    await openNextLot(1);
    const id = (await openLot()).id;
    await placeBid(A, id, 100);
    await retractTopBid(ADMIN, "misclick");
    const l = await openLot();
    expect(l.currentBid).toBeNull();
    expect(l.currentBidderId).toBeNull();
    expect(l.noBidDeadline).not.toBeNull(); // back to the opening window
  });
});

describe("taking a question back", () => {
  async function sell() {
    await openNextLot(1);
    const l = await openLot();
    await placeBid(A, l.id, 100);
    await closeLot(l.id);
    await db.insert(hintPurchase).values({ questionId: Q1, hintIdx: 0, participantId: A, pricePaid: 25 });
    await db.update(participant).set({ balance: sql`${participant.balance} - 25` }).where(eq(participant.userId, A));
  }

  it("refunds the price and the hints, and relists it", async () => {
    await sell();
    expect((await db.select().from(participant).where(eq(participant.userId, A)))[0].balance).toBe(875);

    const out = await takeBackQuestion(ADMIN, { questionId: Q1, refundPrice: true, refundHints: true, relist: true, reason: "wrong sale" });

    expect(out.refunded).toBe(125);
    expect((await db.select().from(participant).where(eq(participant.userId, A)))[0].balance).toBe(1000);
    // The hint purchase goes with the refund, so winning it back costs again.
    expect(await db.select().from(hintPurchase)).toHaveLength(0);
    expect((await db.select().from(ownership))[0].voidedAt).not.toBeNull();
    expect((await db.select().from(question).where(eq(question.id, Q1)))[0].status).toBe("unsold");
    const [relisted] = await db.select().from(lot).where(eq(lot.questionId, Q1));
    expect(relisted.state).toBe("pending");
    expect(relisted.currentBid).toBeNull();
  });

  it("can take it back without refunding, and without relisting", async () => {
    await sell();
    const out = await takeBackQuestion(ADMIN, { questionId: Q1, refundPrice: false, refundHints: false, relist: false, reason: "keep the money" });
    expect(out.refunded).toBe(0);
    expect((await db.select().from(participant).where(eq(participant.userId, A)))[0].balance).toBe(875);
    expect(await db.select().from(hintPurchase)).toHaveLength(1);
    const [l] = await db.select().from(lot).where(eq(lot.questionId, Q1));
    expect(l.state).toBe("closed"); // not put back on the block
    expect((await db.select().from(question).where(eq(question.id, Q1)))[0].status).toBe("unsold");
  });

  it("refuses when nobody owns it", async () => {
    await expect(
      takeBackQuestion(ADMIN, { questionId: Q1, refundPrice: true, refundHints: true, relist: false, reason: "x" }),
    ).rejects.toMatchObject({ code: "not_owned" });
  });

  it("writes a refund to the ledger so the balance is explainable", async () => {
    await sell();
    await takeBackQuestion(ADMIN, { questionId: Q1, refundPrice: true, refundHints: true, relist: true, reason: "wrong sale" });
    const rows = await db.select().from(ledger).where(eq(ledger.participantId, A));
    const refund = rows.find((r) => r.reason === "refund");
    expect(refund).toBeTruthy();
    expect(refund!.delta).toBe(125);
    expect(refund!.ref).toBe(`takeback:${Q1}`);
  });
});
