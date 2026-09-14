/**
 * The money transaction against a real Postgres (NFR-B-03, US-B3-01).
 * Twenty bidders fire at once; exactly one bid per rung is accepted, the
 * ladder is strictly increasing, and no balance ever goes negative.
 *
 * Needs the docker-compose Postgres and applied migrations.
 */
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db, sql as pg } from "@/db";
import { user } from "@/db/auth-schema";
import { bid, contest, ledger, lot, ownership, participant, question } from "@/db/schema";
import { closeLot, createLotsForRound, openNextLot, placeBid } from "@/lib/auction";

const N = 20;
const ids = Array.from({ length: N }, (_, i) => `test-bidder-${i}`);

async function reset() {
  await db.execute(sql`truncate table bid, ownership, ledger, lot, hint_purchase, submission, judgement, draft, notification, audit_log restart identity cascade`);
  await db.delete(participant).where(sql`${participant.userId} like 'test-bidder-%'`);
  await db.delete(user).where(sql`${user.id} like 'test-bidder-%'`);
  await db.delete(question).where(eq(question.id, "test-q"));
}

beforeAll(async () => {
  await reset();
  await db.insert(contest).values({ id: 1 }).onConflictDoNothing();
  await db.update(contest).set({ phase: "auction1", bidIncrement: 10, countdownSeconds: 60, openingWindowSeconds: 60, ownershipCap: null, auctionPausedAt: null }).where(eq(contest.id, 1));
  await db.insert(question).values({ id: "test-q", title: "Test", difficulty: "easy", score: 100, basePrice: 100, auctionOrder: 1 });
  for (const id of ids) {
    await db.insert(user).values({ id, name: id, email: `${id}@contest.local`, emailVerified: false, createdAt: new Date(), updatedAt: new Date(), role: "participant" } as never);
    await db.insert(participant).values({ userId: id, balance: 150 }); // enough for one or two rungs, not more
  }
  await createLotsForRound(1);
  await openNextLot(1);
});

afterAll(async () => {
  await reset();
  await pg.end();
});

describe("concurrent bidding", () => {
  it("accepts exactly one bid per rung and never lets balance go negative", async () => {
    const [l] = await db.select().from(lot).where(eq(lot.questionId, "test-q"));

    // Everyone tries to place the opening bid at the same instant.
    const results = await Promise.allSettled(ids.map((id) => placeBid(id, l.id, 100)));
    const accepted = results.filter((r) => r.status === "fulfilled").length;
    expect(accepted).toBe(1);
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    for (const r of rejected) expect(String(r.reason.code)).toMatch(/wrong_increment|already_highest/);

    // Now everyone tries the next rung at once; again exactly one wins.
    const second = await Promise.allSettled(ids.map((id) => placeBid(id, l.id, 110)));
    expect(second.filter((r) => r.status === "fulfilled").length).toBe(1);

    const bids = await db.select().from(bid).orderBy(bid.id);
    expect(bids.map((b) => b.amount)).toEqual([100, 110]);

    // A rung nobody can afford is rejected for the right reason, not by a crash.
    const [after] = await db.select().from(lot).where(eq(lot.id, l.id));
    const highest = after.currentBidderId!;
    const someoneElse = ids.find((id) => id !== highest)!;
    await db.update(participant).set({ balance: 5 }).where(eq(participant.userId, someoneElse));
    await expect(placeBid(someoneElse, l.id, 120)).rejects.toMatchObject({ code: "insufficient_balance" });

    // Award: exactly the winning bid is deducted, once.
    await db.update(contest).set({ phase: "auction1" }).where(eq(contest.id, 1));
    expect(await closeLot(l.id)).toBe("sold");
    const [winner] = await db.select().from(participant).where(eq(participant.userId, highest));
    expect(winner.balance).toBe(150 - 110);
    const [own] = await db.select().from(ownership).where(eq(ownership.questionId, "test-q"));
    expect(own.participantId).toBe(highest);
    expect(own.pricePaid).toBe(110);
    const entries = await db.select().from(ledger).where(eq(ledger.participantId, highest));
    expect(entries.map((e) => e.delta)).toEqual([-110]);

    // Nobody, anywhere, is negative.
    const [{ negative }] = await db.select({ negative: sql<number>`count(*)::int` }).from(participant).where(sql`${participant.balance} < 0`);
    expect(negative).toBe(0);
  });

  it("a second award of the same question is impossible", async () => {
    await expect(db.insert(ownership).values({ questionId: "test-q", participantId: ids[3], pricePaid: 1 })).rejects.toThrow();
  });
});
