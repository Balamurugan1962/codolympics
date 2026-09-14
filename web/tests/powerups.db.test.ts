/**
 * The marketplace, against a real Postgres.
 *
 * The interesting cases are all concurrent, so most of these fire real parallel
 * transactions rather than calling things in order: one Shield against two
 * simultaneous attacks, two purchases racing the same balance, the same request
 * sent twice. Anything that only works when requests arrive politely one at a
 * time is not working.
 */
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db, sql as pg } from "@/db";
import { user } from "@/db/auth-schema";
import { blackout, contest, ledger, participant, powerup, powerupEvent, powerupInventory } from "@/db/schema";
import {
  assertNotBlackedOut,
  blackoutState,
  buyPowerup,
  ensurePowerups,
  marketplaceFor,
  savePowerup,
  usePowerup,
} from "@/lib/powerups";
import { submitSolution } from "@/lib/submissions";

const A = "pw-alice";
const B = "pw-bob";
const C = "pw-carol";
const ADMIN = "pw-admin";
let BLACKOUT = 0;
let SHIELD = 0;

const rid = () => `req-${Math.random().toString(36).slice(2)}-${Date.now()}`;

async function cleanup() {
  await db.execute(sql`truncate table powerup_event, powerup_inventory, blackout, ledger, notification, audit_log restart identity cascade`);
  await db.delete(participant).where(sql`${participant.userId} like 'pw-%'`);
  await db.delete(user).where(sql`${user.id} like 'pw-%'`);
  await db.delete(powerup);
  await db.update(contest).set({ marketplaceOpen: false }).where(eq(contest.id, 1));
}

async function reset() {
  await cleanup();
  await db.insert(contest).values({ id: 1 }).onConflictDoNothing();
  await db.update(contest).set({ phase: "coding1", marketplaceOpen: true }).where(eq(contest.id, 1));
  const now = new Date();
  for (const [id, name] of [[A, "Alice"], [B, "Bob"], [C, "Carol"], [ADMIN, "Admin"]] as const) {
    await db.insert(user).values({ id, name, email: `${id}@t.invalid`, emailVerified: true, createdAt: now, updatedAt: now, role: id === ADMIN ? "admin" : "participant" });
  }
  for (const id of [A, B, C]) await db.insert(participant).values({ userId: id, balance: 1000 });
  await ensurePowerups();
  const items = await db.select().from(powerup);
  BLACKOUT = items.find((i) => i.kind === "blackout")!.id;
  SHIELD = items.find((i) => i.kind === "shield")!.id;
  // A round 60 seconds keeps the stacking arithmetic obvious.
  await db.update(powerup).set({ durationSeconds: 60, price: 100, maxHeld: 10 }).where(eq(powerup.id, BLACKOUT));
  await db.update(powerup).set({ price: 100, maxHeld: 10 }).where(eq(powerup.id, SHIELD));
}

const give = async (who: string, id: number, n: number) =>
  db.insert(powerupInventory).values({ participantId: who, powerupId: id, quantity: n, purchased: n })
    .onConflictDoUpdate({ target: [powerupInventory.participantId, powerupInventory.powerupId], set: { quantity: n } });
const qty = async (who: string, id: number) =>
  (await db.select().from(powerupInventory).where(and(eq(powerupInventory.participantId, who), eq(powerupInventory.powerupId, id))))[0]?.quantity ?? 0;
const balanceOf = async (id: string) => (await db.select().from(participant).where(eq(participant.userId, id)))[0].balance;

beforeEach(reset);
afterAll(async () => { await cleanup(); await pg.end(); });

describe("buying", () => {
  it("debits the bidding balance and writes a ledger line", async () => {
    const r = await buyPowerup(A, { powerupId: BLACKOUT, requestId: rid() });
    expect(r).toMatchObject({ balance: 900, owned: 1 });
    const [entry] = await db.select().from(ledger).where(eq(ledger.participantId, A));
    expect(entry).toMatchObject({ delta: -100, balanceAfter: 900, reason: "powerup" });
  });

  it("refuses when the balance will not cover it", async () => {
    await db.update(participant).set({ balance: 50 }).where(eq(participant.userId, A));
    await expect(buyPowerup(A, { powerupId: BLACKOUT, requestId: rid() })).rejects.toMatchObject({ code: "insufficient_balance" });
    expect(await balanceOf(A)).toBe(50);
  });

  it("refuses when the marketplace is closed", async () => {
    await db.update(contest).set({ marketplaceOpen: false }).where(eq(contest.id, 1));
    await expect(buyPowerup(A, { powerupId: BLACKOUT, requestId: rid() })).rejects.toMatchObject({ code: "marketplace_closed" });
  });

  it("honours the hold limit", async () => {
    await savePowerup(ADMIN, BLACKOUT, { maxHeld: 2 }, "cap for this test");
    for (let i = 0; i < 2; i++) await buyPowerup(A, { powerupId: BLACKOUT, requestId: rid() });
    await expect(buyPowerup(A, { powerupId: BLACKOUT, requestId: rid() })).rejects.toMatchObject({ code: "hold_limit" });
  });

  it("honours a whole-contest purchase limit even after spending them", async () => {
    await savePowerup(ADMIN, BLACKOUT, { maxPurchases: 1 }, "one each");
    await buyPowerup(A, { powerupId: BLACKOUT, requestId: rid() });
    await usePowerup(A, { powerupId: BLACKOUT, targetId: B, requestId: rid() });
    expect(await qty(A, BLACKOUT)).toBe(0);
    await expect(buyPowerup(A, { powerupId: BLACKOUT, requestId: rid() })).rejects.toMatchObject({ code: "purchase_limit" });
  });

  it("charges once for a repeated request id", async () => {
    const id = rid();
    const first = await buyPowerup(A, { powerupId: BLACKOUT, requestId: id });
    const again = await buyPowerup(A, { powerupId: BLACKOUT, requestId: id });
    expect(first.replayed).toBe(false);
    expect(again.replayed).toBe(true);
    expect(again.balance).toBe(900);
    expect(await balanceOf(A)).toBe(900);
    expect(await qty(A, BLACKOUT)).toBe(1);
  });

  it("cannot be raced past the balance", async () => {
    await db.update(participant).set({ balance: 250 }).where(eq(participant.userId, A));
    const tries = await Promise.allSettled(
      Array.from({ length: 6 }, () => buyPowerup(A, { powerupId: BLACKOUT, requestId: rid() })),
    );
    const ok = tries.filter((t) => t.status === "fulfilled").length;
    expect(ok).toBe(2); // 250 buys exactly two at 100
    expect(await balanceOf(A)).toBe(50);
    expect(await qty(A, BLACKOUT)).toBe(2);
  });
});

describe("blackout", () => {
  it("lands, names the attacker, and locks the target out of contest actions", async () => {
    await give(A, BLACKOUT, 1);
    const r = await usePowerup(A, { powerupId: BLACKOUT, targetId: B, requestId: rid() });
    expect(r.outcome).toBe("blackout");

    const s = await blackoutState(B);
    expect(s.active).toBe(true);
    expect(s.count).toBe(1);
    expect(s.by).toEqual(["Alice"]);
    await expect(assertNotBlackedOut(B)).rejects.toMatchObject({ code: "blacked_out" });
    // And the gate is on the real action, not only the helper.
    await expect(submitSolution(B, { questionId: "nope", language: "python", source: "x" })).rejects.toMatchObject({ code: "blacked_out" });
    // The attacker is untouched.
    await expect(assertNotBlackedOut(A)).resolves.toBeUndefined();
  });

  it("stacks by adding, not overwriting", async () => {
    await give(A, BLACKOUT, 1);
    await give(C, BLACKOUT, 1);
    await usePowerup(A, { powerupId: BLACKOUT, targetId: B, requestId: rid() });
    const first = await blackoutState(B);
    await usePowerup(C, { powerupId: BLACKOUT, targetId: B, requestId: rid() });
    const second = await blackoutState(B);

    expect(second.count).toBe(2);
    expect(second.by.sort()).toEqual(["Alice", "Carol"]);
    const added = Date.parse(second.ends_at!) - Date.parse(first.ends_at!);
    expect(added).toBeGreaterThan(59_000);
    expect(added).toBeLessThan(61_000);
  });

  it("stacks correctly when two attacks arrive at the same instant", async () => {
    await give(A, BLACKOUT, 1);
    await give(C, BLACKOUT, 1);
    const before = Date.now();
    await Promise.all([
      usePowerup(A, { powerupId: BLACKOUT, targetId: B, requestId: rid() }),
      usePowerup(C, { powerupId: BLACKOUT, targetId: B, requestId: rid() }),
    ]);
    const s = await blackoutState(B);
    expect(s.count).toBe(2);
    // Two 60s blackouts must total ~120s from now, never ~60s.
    const total = Date.parse(s.ends_at!) - before;
    expect(total).toBeGreaterThan(118_000);
    expect(total).toBeLessThan(123_000);
  });

  it("refuses an attack on yourself", async () => {
    await give(A, BLACKOUT, 1);
    await expect(usePowerup(A, { powerupId: BLACKOUT, targetId: A, requestId: rid() })).rejects.toMatchObject({ code: "invalid_request" });
    expect(await qty(A, BLACKOUT)).toBe(1); // nothing spent
  });

  it("refuses a powerup you do not own", async () => {
    await expect(usePowerup(A, { powerupId: BLACKOUT, targetId: B, requestId: rid() })).rejects.toMatchObject({ code: "not_owned" });
  });

  it("refuses a target who is out of the contest", async () => {
    await give(A, BLACKOUT, 1);
    await db.update(participant).set({ disqualifiedAt: new Date() }).where(eq(participant.userId, B));
    await expect(usePowerup(A, { powerupId: BLACKOUT, targetId: B, requestId: rid() })).rejects.toMatchObject({ code: "target_inactive" });
    expect(await qty(A, BLACKOUT)).toBe(1);
  });

  it("refuses in a phase the powerup is not usable in", async () => {
    await give(A, BLACKOUT, 1);
    await db.update(contest).set({ phase: "auction1" }).where(eq(contest.id, 1));
    await expect(usePowerup(A, { powerupId: BLACKOUT, targetId: B, requestId: rid() })).rejects.toMatchObject({ code: "wrong_phase" });
  });

  it("spends the attack once for a repeated request id", async () => {
    await give(A, BLACKOUT, 2);
    const id = rid();
    await usePowerup(A, { powerupId: BLACKOUT, targetId: B, requestId: id });
    const again = await usePowerup(A, { powerupId: BLACKOUT, targetId: B, requestId: id });
    expect(again.replayed).toBe(true);
    expect(await qty(A, BLACKOUT)).toBe(1);
    expect((await blackoutState(B)).count).toBe(1);
  });

  it("expires on its own, with nothing running", async () => {
    await give(A, BLACKOUT, 1);
    await usePowerup(A, { powerupId: BLACKOUT, targetId: B, requestId: rid() });
    // Reach into the row rather than waiting a minute.
    await db.update(blackout).set({ endsAt: new Date(Date.now() - 1000) }).where(eq(blackout.participantId, B));
    expect((await blackoutState(B)).active).toBe(false);
    await expect(assertNotBlackedOut(B)).resolves.toBeUndefined();
  });

  it("stops mattering once the contest has ended", async () => {
    await give(A, BLACKOUT, 1);
    await usePowerup(A, { powerupId: BLACKOUT, targetId: B, requestId: rid() });
    expect((await blackoutState(B)).active).toBe(true);
    await db.update(contest).set({ phase: "ended" }).where(eq(contest.id, 1));
    expect((await blackoutState(B)).active).toBe(false);
  });
});

describe("shield", () => {
  it("absorbs one attack and is consumed", async () => {
    await give(A, BLACKOUT, 1);
    await give(B, SHIELD, 1);
    const r = await usePowerup(A, { powerupId: BLACKOUT, targetId: B, requestId: rid() });
    expect(r.outcome).toBe("shielded");
    expect(await qty(B, SHIELD)).toBe(0);
    expect(await qty(A, BLACKOUT)).toBe(0); // the attack is still spent
    expect((await blackoutState(B)).active).toBe(false);
  });

  it("is consumed one at a time, and the blackout lands once they run out", async () => {
    await give(A, BLACKOUT, 3);
    await give(B, SHIELD, 2);
    for (let i = 0; i < 2; i++) await usePowerup(A, { powerupId: BLACKOUT, targetId: B, requestId: rid() });
    expect(await qty(B, SHIELD)).toBe(0);
    expect((await blackoutState(B)).active).toBe(false);
    await usePowerup(A, { powerupId: BLACKOUT, targetId: B, requestId: rid() });
    expect((await blackoutState(B)).active).toBe(true);
  });

  it("is eaten by exactly one of two simultaneous attacks", async () => {
    await give(A, BLACKOUT, 1);
    await give(C, BLACKOUT, 1);
    await give(B, SHIELD, 1);
    const results = await Promise.all([
      usePowerup(A, { powerupId: BLACKOUT, targetId: B, requestId: rid() }),
      usePowerup(C, { powerupId: BLACKOUT, targetId: B, requestId: rid() }),
    ]);
    const outcomes = results.map((r) => r.outcome).sort();
    expect(outcomes).toEqual(["blackout", "shielded"]);
    expect(await qty(B, SHIELD)).toBe(0);
    const s = await blackoutState(B);
    expect(s.active).toBe(true);
    expect(s.count).toBe(1); // exactly one got through
  });

  it("never goes negative under a burst of concurrent attacks", async () => {
    await give(A, BLACKOUT, 5);
    await give(B, SHIELD, 2);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => usePowerup(A, { powerupId: BLACKOUT, targetId: B, requestId: rid() })),
    );
    expect(results.filter((r) => r.outcome === "shielded")).toHaveLength(2);
    expect(results.filter((r) => r.outcome === "blackout")).toHaveLength(3);
    expect(await qty(B, SHIELD)).toBe(0);
    expect((await blackoutState(B)).count).toBe(3);
  });

  it("cannot be activated — it works by being held", async () => {
    await give(A, SHIELD, 1);
    await expect(usePowerup(A, { powerupId: SHIELD, targetId: B, requestId: rid() })).rejects.toMatchObject({ code: "passive" });
    expect(await qty(A, SHIELD)).toBe(1);
  });
});

describe("configuration", () => {
  it("takes effect on the next use but never changes a blackout already running", async () => {
    await give(A, BLACKOUT, 2);
    await usePowerup(A, { powerupId: BLACKOUT, targetId: B, requestId: rid() });
    const before = (await blackoutState(B)).ends_at!;
    await savePowerup(ADMIN, BLACKOUT, { durationSeconds: 600 }, "much longer now");
    expect((await blackoutState(B)).ends_at).toBe(before); // untouched

    await usePowerup(A, { powerupId: BLACKOUT, targetId: C, requestId: rid() });
    const carol = await blackoutState(C);
    expect(Date.parse(carol.ends_at!) - Date.now()).toBeGreaterThan(500_000);
  });

  it("refuses a blackout with no duration", async () => {
    await expect(savePowerup(ADMIN, BLACKOUT, { durationSeconds: null }, "break it")).rejects.toMatchObject({ code: "invalid_request" });
  });

  it("a disabled powerup cannot be bought or used", async () => {
    await give(A, BLACKOUT, 1);
    await savePowerup(ADMIN, BLACKOUT, { enabled: false }, "switching it off");
    await expect(buyPowerup(A, { powerupId: BLACKOUT, requestId: rid() })).rejects.toMatchObject({ code: "powerup_disabled" });
    await expect(usePowerup(A, { powerupId: BLACKOUT, targetId: B, requestId: rid() })).rejects.toMatchObject({ code: "powerup_disabled" });
  });
});

describe("what a participant is told", () => {
  it("explains why each action is unavailable, and never offers themselves as a target", async () => {
    await db.update(participant).set({ balance: 50 }).where(eq(participant.userId, A));
    const m = await marketplaceFor(A);
    const bo = m.items.find((i) => i.kind === "blackout")!;
    expect(bo.buy_blocked).toMatch(/you have 50/i);
    expect(bo.use_blocked).toBe("You do not own one.");
    expect(m.targets.map((t) => t.id)).not.toContain(A);
    expect(m.targets.map((t) => t.id).sort()).toEqual([B, C].sort());
  });

  it("shows who is shielded, so spending an attack is a decision", async () => {
    await give(B, SHIELD, 1);
    const m = await marketplaceFor(A);
    expect(m.targets.find((t) => t.id === B)!.shielded).toBe(true);
    expect(m.targets.find((t) => t.id === C)!.shielded).toBe(false);
  });

  it("records every purchase and attack", async () => {
    await buyPowerup(A, { powerupId: BLACKOUT, requestId: rid() });
    await usePowerup(A, { powerupId: BLACKOUT, targetId: B, requestId: rid() });
    const events = await db.select().from(powerupEvent).orderBy(powerupEvent.id);
    expect(events.map((e) => e.kind)).toEqual(["purchase", "use"]);
    expect(events[1].targetId).toBe(B);
  });
});
