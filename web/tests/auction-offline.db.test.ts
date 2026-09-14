/**
 * The offline auction: the room decides who wins, the app records it.
 *
 * What is worth proving is that "recorded" means exactly what "won" means —
 * the same debit, the same ownership row, the same ledger line — and that the
 * checks the online auction makes on every bid are still made here. An
 * auctioneer can accept a bid; an auctioneer cannot conjure money.
 */
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db, sql as pg } from "@/db";
import { user } from "@/db/auth-schema";
import { contest, ledger, lot, ownership, participant, question } from "@/db/schema";
import { openNextLot, placeBid, tickAuction } from "@/lib/auction";
import { bidderBalances, recordSale, recordUnsold } from "@/lib/auction-control";
import { updateContest } from "@/lib/admin";

const A = "off-alice";
const B = "off-bob";
const ADMIN = "off-admin";
const Q1 = "off-q1";
const Q2 = "off-q2";

async function cleanup() {
  await db.execute(sql`truncate table bid, ownership, ledger, lot, hint_purchase, submission, judgement, draft, notification, audit_log restart identity cascade`);
  await db.delete(participant).where(sql`${participant.userId} like 'off-%'`);
  await db.delete(user).where(sql`${user.id} like 'off-%'`);
  await db.delete(question).where(sql`${question.id} like 'off-%'`);
  await db.update(contest).set({ auctionMode: "online", auctionPausedAt: null }).where(eq(contest.id, 1));
}

async function reset() {
  await cleanup();
  await db.insert(contest).values({ id: 1 }).onConflictDoNothing();
  await db
    .update(contest)
    .set({ phase: "auction1", auctionMode: "offline", ownershipCap: null, auctionPausedAt: null, bidIncrement: 10 })
    .where(eq(contest.id, 1));
  const now = new Date();
  for (const [id, name] of [[A, "Alice"], [B, "Bob"], [ADMIN, "Admin"]] as const) {
    await db.insert(user).values({ id, name, email: `${id}@t.invalid`, emailVerified: true, createdAt: now, updatedAt: now, role: id === ADMIN ? "admin" : "participant" });
  }
  await db.insert(participant).values({ userId: A, balance: 500 });
  await db.insert(participant).values({ userId: B, balance: 120 });
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
const balanceOf = async (id: string) => (await db.select().from(participant).where(eq(participant.userId, id)))[0].balance;

beforeEach(reset);
afterAll(async () => {
  await cleanup();
  await pg.end();
});

describe("opening a lot offline", () => {
  it("opens with no clock at all", async () => {
    await openNextLot(1);
    const l = await openLot();
    expect(l.noBidDeadline).toBeNull();
    expect(l.biddingEndsAt).toBeNull();
  });

  it("never settles itself, however long it sits", async () => {
    await openNextLot(1);
    const id = (await openLot()).id;
    // Even with a deadline forced into the past, nothing settles offline.
    await db.update(lot).set({ noBidDeadline: new Date(Date.now() - 60_000) }).where(eq(lot.id, id));
    await tickAuction();
    await tickAuction();
    expect((await openLot()).id).toBe(id);
  });

  it("refuses a bid from a seat", async () => {
    await openNextLot(1);
    await expect(placeBid(A, (await openLot()).id, 100)).rejects.toMatchObject({ code: "bidding_closed" });
  });
});

describe("recording a sale", () => {
  it("moves the money and the ownership exactly as a won bid does", async () => {
    await openNextLot(1);
    const l = await openLot();
    await recordSale(ADMIN, { lotId: l.id, participantId: A, price: 180, reason: "Alice won it in the room" });

    expect(await balanceOf(A)).toBe(320);
    const [own] = await db.select().from(ownership);
    expect(own).toMatchObject({ questionId: Q1, participantId: A, pricePaid: 180 });
    expect((await db.select().from(question).where(eq(question.id, Q1)))[0].status).toBe("sold");
    const [settled] = await db.select().from(lot).where(eq(lot.id, l.id));
    expect(settled.state).toBe("closed");

    const [entry] = await db.select().from(ledger).where(eq(ledger.participantId, A));
    expect(entry).toMatchObject({ delta: -180, balanceAfter: 320, reason: "bid_won", ref: Q1 });
  });

  it("opens the next question straight after", async () => {
    await openNextLot(1);
    await recordSale(ADMIN, { lotId: (await openLot()).id, participantId: A, price: 100, reason: "sold" });
    expect((await openLot()).questionId).toBe(Q2);
  });

  it("refuses a price the winner cannot cover", async () => {
    await openNextLot(1);
    const l = await openLot();
    await expect(recordSale(ADMIN, { lotId: l.id, participantId: B, price: 200, reason: "x" })).rejects.toMatchObject({
      code: "insufficient_balance",
    });
    expect(await balanceOf(B)).toBe(120);
    expect(await db.select().from(ownership)).toHaveLength(0);
  });

  it("refuses a price below the published base", async () => {
    await openNextLot(1);
    await expect(recordSale(ADMIN, { lotId: (await openLot()).id, participantId: A, price: 40, reason: "x" })).rejects.toMatchObject({
      code: "below_base",
    });
  });

  it("takes any whole number at or above the base, not only increments", async () => {
    await openNextLot(1);
    // 137 is not on the 100/110/120 ladder; offline the room sets the price.
    await recordSale(ADMIN, { lotId: (await openLot()).id, participantId: A, price: 137, reason: "jump bid" });
    expect((await db.select().from(ownership))[0].pricePaid).toBe(137);
  });

  it("refuses once the ownership cap is reached", async () => {
    await updateContest(ADMIN, { ownershipCap: 1 }, "cap of one for this test");
    await openNextLot(1);
    await recordSale(ADMIN, { lotId: (await openLot()).id, participantId: A, price: 100, reason: "first" });
    await expect(recordSale(ADMIN, { lotId: (await openLot()).id, participantId: A, price: 100, reason: "second" })).rejects.toMatchObject({
      code: "ownership_cap_reached",
    });
  });

  it("refuses a disqualified buyer", async () => {
    await db.update(participant).set({ disqualifiedAt: new Date() }).where(eq(participant.userId, A));
    await openNextLot(1);
    await expect(recordSale(ADMIN, { lotId: (await openLot()).id, participantId: A, price: 100, reason: "x" })).rejects.toMatchObject({
      code: "disqualified",
    });
  });

  it("refuses while the auction is held", async () => {
    await openNextLot(1);
    await db.update(contest).set({ auctionPausedAt: new Date() }).where(eq(contest.id, 1));
    await expect(recordSale(ADMIN, { lotId: (await openLot()).id, participantId: A, price: 100, reason: "x" })).rejects.toMatchObject({
      code: "auction_paused",
    });
  });

  it("refuses entirely when the contest runs its auction online", async () => {
    await db.update(contest).set({ auctionMode: "online" }).where(eq(contest.id, 1));
    await openNextLot(1);
    await expect(recordSale(ADMIN, { lotId: (await openLot()).id, participantId: A, price: 100, reason: "x" })).rejects.toMatchObject({
      code: "not_offline",
    });
  });
});

describe("nobody bid", () => {
  it("closes the lot unsold, moves no money, and opens the next", async () => {
    await openNextLot(1);
    const l = await openLot();
    await recordUnsold(ADMIN, { lotId: l.id, reason: "no hands went up" });
    const [closed] = await db.select().from(lot).where(eq(lot.id, l.id));
    expect(closed.state).toBe("unsold");
    expect(await db.select().from(ledger)).toHaveLength(0);
    expect(await balanceOf(A)).toBe(500);
    expect((await openLot()).questionId).toBe(Q2);
  });
});

describe("the mode itself", () => {
  it("cannot be changed while an auction round is open", async () => {
    await expect(updateContest(ADMIN, { auctionMode: "online" }, "switching mid-round")).rejects.toMatchObject({
      code: "auction_running",
    });
  });

  it("can be changed outside an auction round", async () => {
    await db.update(contest).set({ phase: "review" }).where(eq(contest.id, 1));
    await updateContest(ADMIN, { auctionMode: "online" }, "back to online");
    const [c] = await db.select().from(contest);
    expect(c.auctionMode).toBe("online");
  });
});

describe("balances for the organiser", () => {
  it("lists every bidder, richest first, with what they own", async () => {
    await openNextLot(1);
    await recordSale(ADMIN, { lotId: (await openLot()).id, participantId: A, price: 200, reason: "sold" });
    const rows = (await bidderBalances()).filter((r) => r.id.startsWith("off-"));
    expect(rows.map((r) => r.id)).toEqual([A, B]); // 300 then 120
    expect(rows[0]).toMatchObject({ balance: 300, owned: 1 });
    expect(rows[1]).toMatchObject({ balance: 120, owned: 0 });
  });
});
