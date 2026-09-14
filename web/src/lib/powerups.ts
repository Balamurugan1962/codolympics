/**
 * The marketplace: buying powerups, and using them on other people.
 *
 * The server is the only authority here. A client may display a countdown, a
 * price or an inventory, but every one of those is re-read and re-checked
 * inside the transaction that acts on it — a blackout that has expired
 * according to the browser is still a blackout until the database says
 * otherwise, and a Shield the client thinks it owns is worth nothing unless the
 * row says so.
 *
 * Three things carry the correctness:
 *
 *   The participant row is the lock. Every purchase locks the buyer, every
 *   attack locks the target. Two attacks on one person therefore serialise, so
 *   a single Shield is consumed by exactly one of them and the other lands —
 *   never both consuming it, never both blocked by it.
 *
 *   Stacking is adjacency, not overlap. A new blackout starts where the last
 *   one ends, so simultaneous attacks queue back to back and the total is the
 *   sum by construction. Remaining time is `max(ends_at) - now`: nothing to
 *   keep in step, nothing to drift.
 *
 *   Every action carries a request id, unique per actor. A double click, a
 *   retry after a dropped connection, a refresh that resubmits — all collapse
 *   onto the first attempt, because the unique index refuses the second and we
 *   return what the first one did.
 */
import { and, asc, desc, eq, gt, sql } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/auth-schema";
import {
  blackout,
  ledger,
  notification,
  participant,
  powerup,
  powerupEvent,
  powerupInventory,
  type Phase,
  type PowerupKind,
} from "@/db/schema";

import { errors } from "./api";
import { audit } from "./audit";
import { getContest } from "./contest";
import { publish } from "./events";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * A Postgres unique violation — here, always the idempotency index.
 *
 * Drizzle wraps driver errors, so the code is rarely on the error it hands you;
 * it is on a `cause` a level or two down. Checking only the top level silently
 * turns "this request was already handled" into a 500, which is the opposite of
 * idempotent.
 */
function isDuplicate(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e && depth < 5; e = (e as { cause?: unknown }).cause, depth++) {
    if (typeof e === "object" && (e as { code?: string }).code === "23505") return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Blackout state
// ---------------------------------------------------------------------------

export type BlackoutState = {
  active: boolean;
  /** When the whole stack lifts. Null when nothing is active. */
  ends_at: string | null;
  /** How many separate blackouts are still queued, for "3 blackouts stacked". */
  count: number;
  /** Who landed them, in order, newest last. Named: the target gets to know. */
  by: string[];
  /** The server's clock, so a client can correct its own rather than trust it. */
  server_now: number;
};

const NONE: Omit<BlackoutState, "server_now"> = { active: false, ends_at: null, count: 0, by: [] };

/**
 * What is currently sitting on this participant.
 *
 * Expiry is a comparison against now, not a job: a blackout that ran out while
 * the participant was disconnected is simply no longer returned, so nothing has
 * to have been running for it to end correctly.
 */
export async function blackoutState(participantId: string): Promise<BlackoutState> {
  const c = await getContest();
  const now = Date.now();
  // Once the contest is over a blackout is meaningless, and holding someone on
  // a black screen after the final whistle is just cruel.
  if (c.phase === "ended") return { ...NONE, server_now: now };

  const rows = await db
    .select({ endsAt: blackout.endsAt, by: user.name })
    .from(blackout)
    .innerJoin(user, eq(user.id, blackout.byId))
    .where(and(eq(blackout.participantId, participantId), gt(blackout.endsAt, new Date(now))))
    .orderBy(asc(blackout.endsAt));

  if (rows.length === 0) return { ...NONE, server_now: now };
  return {
    active: true,
    ends_at: rows[rows.length - 1].endsAt.toISOString(),
    count: rows.length,
    by: rows.map((r) => r.by ?? "someone"),
    server_now: now,
  };
}

/**
 * The gate every contest action passes through.
 *
 * Called inside the domain functions rather than in the routes, so there is no
 * route a determined client can find that skips it.
 */
export async function assertNotBlackedOut(participantId: string): Promise<void> {
  const s = await blackoutState(participantId);
  if (!s.active) return;
  const left = Math.ceil((Date.parse(s.ends_at!) - s.server_now) / 1000);
  throw errors.conflict("blacked_out", `you are blacked out for another ${left} second${left === 1 ? "" : "s"}`);
}

// ---------------------------------------------------------------------------
// Reading the marketplace
// ---------------------------------------------------------------------------

/**
 * Everything on sale.
 *
 * Seeds the defaults if the table is empty rather than relying on the server
 * having been restarted since the feature shipped — an empty marketplace that
 * needs a restart to appear is indistinguishable from a broken one, and the
 * check is a single indexed row read.
 */
export async function catalogue() {
  await ensurePowerups();
  return db.select().from(powerup).orderBy(asc(powerup.sortOrder), asc(powerup.id));
}

/** The marketplace as one participant sees it: prices, what they hold, and why they cannot act. */
export async function marketplaceFor(participantId: string) {
  const c = await getContest();
  const [p] = await db.select().from(participant).where(eq(participant.userId, participantId));
  if (!p) throw errors.forbidden("not a participant");

  const items = await catalogue();
  const held = await db.select().from(powerupInventory).where(eq(powerupInventory.participantId, participantId));
  const heldBy = new Map(held.map((h) => [h.powerupId, h]));

  return {
    open: c.marketplaceOpen,
    phase: c.phase,
    balance: p.balance,
    items: items
      .filter((i) => i.enabled)
      .map((i) => {
        const h = heldBy.get(i.id);
        const owned = h?.quantity ?? 0;
        const bought = h?.purchased ?? 0;
        return {
          id: i.id,
          kind: i.kind,
          name: i.name,
          description: i.description,
          price: i.price,
          duration_seconds: i.durationSeconds,
          owned,
          max_held: i.maxHeld,
          max_purchases: i.maxPurchases,
          purchased: bought,
          usable_phases: i.usablePhases,
          usable_now: i.usablePhases.includes(c.phase),
          /* Every reason a buy would be refused, computed on the server and
           * sent as a sentence, so the button and the API agree about why. */
          buy_blocked:
            !c.marketplaceOpen ? "The marketplace is closed."
            : p.disqualifiedAt ? "Your account is disqualified."
            : i.price > p.balance ? `You have ${p.balance}; this costs ${i.price}.`
            : i.maxHeld !== null && owned >= i.maxHeld ? `You can hold at most ${i.maxHeld}.`
            : i.maxPurchases !== null && bought >= i.maxPurchases ? `You have used your ${i.maxPurchases} for this contest.`
            : null,
          use_blocked:
            owned <= 0 ? "You do not own one."
            : !i.usablePhases.includes(c.phase) ? "Not usable in this part of the contest."
            : null,
        };
      }),
    /* Who may be attacked, and who cannot be. Everything the client needs to
     * draw the target list, decided here so the list cannot be widened. */
    targets: await attackableTargets(participantId),
    server_now: Date.now(),
  };
}

/** Everyone who may legally be attacked right now, and what shields they show. */
async function attackableTargets(actorId: string) {
  const rows = await db
    .select({ id: participant.userId, name: user.name, disqualified: participant.disqualifiedAt })
    .from(participant)
    .innerJoin(user, eq(user.id, participant.userId))
    .orderBy(asc(user.name));

  const shielded = await db
    .select({ pid: powerupInventory.participantId })
    .from(powerupInventory)
    .innerJoin(powerup, eq(powerup.id, powerupInventory.powerupId))
    .where(and(eq(powerup.kind, "shield"), gt(powerupInventory.quantity, 0)));
  const hasShield = new Set(shielded.map((s) => s.pid));

  const now = new Date();
  const under = await db
    .select({ pid: blackout.participantId })
    .from(blackout)
    .where(gt(blackout.endsAt, now));
  const blacked = new Set(under.map((u) => u.pid));

  return rows
    .filter((r) => r.id !== actorId) // you cannot black out yourself
    .map((r) => ({
      id: r.id,
      name: r.name,
      disqualified: Boolean(r.disqualified),
      /* Shields are visible: an attacker deciding whether to spend one should
       * know it may be eaten, and it is the only way "1 shield blocks 1 attack"
       * reads as a decision rather than a dice roll. */
      shielded: hasShield.has(r.id),
      blacked_out: blacked.has(r.id),
    }));
}

// ---------------------------------------------------------------------------
// Buying
// ---------------------------------------------------------------------------

export type BuyResult = { ok: true; balance: number; owned: number; replayed: boolean };

/**
 * Buy one powerup.
 *
 * The buyer's row is locked first, so two purchases racing cannot both read the
 * same balance and both succeed. Price, limits and the marketplace switch are
 * all re-read inside the transaction: whatever the client was showing is a
 * suggestion.
 */
export async function buyPowerup(
  participantId: string,
  input: { powerupId: number; requestId: string },
): Promise<BuyResult> {
  const c = await getContest();
  if (!c.marketplaceOpen) throw errors.conflict("marketplace_closed", "the marketplace is closed");

  try {
    return await db.transaction(async (tx) => {
      const [p] = await tx.select().from(participant).where(eq(participant.userId, participantId)).for("update");
      if (!p) throw errors.forbidden("not a participant");
      if (p.disqualifiedAt) throw errors.forbidden("your account is disqualified");

      const [item] = await tx.select().from(powerup).where(eq(powerup.id, input.powerupId));
      if (!item) throw errors.notFound("powerup");
      if (!item.enabled) throw errors.conflict("powerup_disabled", `${item.name} is not on sale`);
      if (item.price > p.balance) throw errors.conflict("insufficient_balance", `you have ${p.balance}; this costs ${item.price}`);

      const [inv] = await tx
        .select()
        .from(powerupInventory)
        .where(and(eq(powerupInventory.participantId, participantId), eq(powerupInventory.powerupId, item.id)));
      const owned = inv?.quantity ?? 0;
      const bought = inv?.purchased ?? 0;
      if (item.maxHeld !== null && owned >= item.maxHeld) {
        throw errors.conflict("hold_limit", `you can hold at most ${item.maxHeld} ${item.name}`);
      }
      if (item.maxPurchases !== null && bought >= item.maxPurchases) {
        throw errors.conflict("purchase_limit", `you have used your ${item.maxPurchases} for this contest`);
      }

      const balanceAfter = p.balance - item.price;
      await tx.update(participant).set({ balance: balanceAfter }).where(eq(participant.userId, participantId));
      await tx.insert(ledger).values({ participantId, delta: -item.price, balanceAfter, reason: "powerup", ref: item.name });
      await tx
        .insert(powerupInventory)
        .values({ participantId, powerupId: item.id, quantity: 1, purchased: 1 })
        .onConflictDoUpdate({
          target: [powerupInventory.participantId, powerupInventory.powerupId],
          set: { quantity: sql`${powerupInventory.quantity} + 1`, purchased: sql`${powerupInventory.purchased} + 1` },
        });
      // Last, so a replay collides here and rolls the whole thing back.
      await tx.insert(powerupEvent).values({
        kind: "purchase",
        powerupId: item.id,
        actorId: participantId,
        cost: item.price,
        requestId: input.requestId,
        detail: { name: item.name },
      });

      return { ok: true as const, balance: balanceAfter, owned: owned + 1, replayed: false };
    });
  } catch (err) {
    if (!isDuplicate(err)) throw err;
    // Already done, by an earlier copy of this same request. Report the state
    // that request produced rather than charging for it twice.
    return { ...(await replayOf(participantId, input.requestId)), replayed: true };
  }
}

/** What the first copy of a replayed request left behind. */
async function replayOf(participantId: string, requestId: string): Promise<Omit<BuyResult, "replayed">> {
  const [p] = await db.select().from(participant).where(eq(participant.userId, participantId));
  const [ev] = await db
    .select()
    .from(powerupEvent)
    .where(and(eq(powerupEvent.actorId, participantId), eq(powerupEvent.requestId, requestId)));
  const [inv] = ev?.powerupId
    ? await db
        .select()
        .from(powerupInventory)
        .where(and(eq(powerupInventory.participantId, participantId), eq(powerupInventory.powerupId, ev.powerupId)))
    : [undefined];
  return { ok: true, balance: p?.balance ?? 0, owned: inv?.quantity ?? 0 };
}

// ---------------------------------------------------------------------------
// Using
// ---------------------------------------------------------------------------

export type UseResult = {
  ok: true;
  outcome: "blackout" | "shielded" | "activated";
  /** For an attack that landed: when the target's whole stack now lifts. */
  ends_at: string | null;
  target_name: string | null;
  owned: number;
  replayed: boolean;
};

/**
 * Use a powerup.
 *
 * Blackout takes a target and may be eaten by their Shield. Shield is not used
 * *at* anybody — holding one is what protects you — so "using" one is refused
 * with an explanation rather than silently doing nothing.
 */
export async function usePowerup(
  actorId: string,
  input: { powerupId: number; targetId?: string | null; requestId: string },
): Promise<UseResult> {
  try {
    return await db.transaction(async (tx) => {
      const [item] = await tx.select().from(powerup).where(eq(powerup.id, input.powerupId));
      if (!item) throw errors.notFound("powerup");
      if (!item.enabled) throw errors.conflict("powerup_disabled", `${item.name} is switched off`);

      const c = await getContest();
      if (!item.usablePhases.includes(c.phase as Phase)) {
        throw errors.conflict("wrong_phase", `${item.name} cannot be used during this part of the contest`);
      }

      const [me] = await tx.select().from(participant).where(eq(participant.userId, actorId)).for("update");
      if (!me) throw errors.forbidden("not a participant");
      if (me.disqualifiedAt) throw errors.forbidden("your account is disqualified");

      // You cannot use what you do not have, however the client is feeling.
      const [inv] = await tx
        .select()
        .from(powerupInventory)
        .where(and(eq(powerupInventory.participantId, actorId), eq(powerupInventory.powerupId, item.id)));
      if (!inv || inv.quantity <= 0) throw errors.conflict("not_owned", `you do not own a ${item.name}`);

      if (item.kind === "shield") {
        throw errors.conflict("passive", `a ${item.name} protects you while you hold it — there is nothing to activate`);
      }

      // --- blackout -------------------------------------------------------
      if (!input.targetId) throw errors.invalid("choose who to use it on");
      if (input.targetId === actorId) throw errors.invalid("you cannot use that on yourself");

      const outcome = await landBlackout(tx, {
        item,
        actorId,
        targetId: input.targetId,
      });

      await tx
        .update(powerupInventory)
        .set({ quantity: sql`${powerupInventory.quantity} - 1` })
        .where(and(eq(powerupInventory.participantId, actorId), eq(powerupInventory.powerupId, item.id)));

      await tx.insert(powerupEvent).values({
        kind: outcome.shielded ? "blocked" : "use",
        powerupId: item.id,
        actorId,
        targetId: input.targetId,
        requestId: input.requestId,
        detail: { name: item.name, seconds: item.durationSeconds, shielded: outcome.shielded },
      });

      return {
        ok: true as const,
        outcome: outcome.shielded ? ("shielded" as const) : ("blackout" as const),
        ends_at: outcome.endsAt?.toISOString() ?? null,
        target_name: outcome.targetName,
        owned: inv.quantity - 1,
        replayed: false,
      };
    });
  } catch (err) {
    if (!isDuplicate(err)) throw err;
    return await replayUse(actorId, input.requestId);
  }
}

/**
 * Land one blackout on one person, or be eaten by their Shield.
 *
 * The target's participant row is locked for the whole of this, which is what
 * makes the concurrent cases correct: two attackers arriving together are
 * serialised, so one Shield absorbs exactly one of them, and two blackouts that
 * both land are appended in a defined order rather than racing to overwrite the
 * same end time.
 */
async function landBlackout(
  tx: Tx,
  input: { item: typeof powerup.$inferSelect; actorId: string; targetId: string },
): Promise<{ shielded: boolean; endsAt: Date | null; targetName: string | null }> {
  const [target] = await tx.select().from(participant).where(eq(participant.userId, input.targetId)).for("update");
  if (!target) throw errors.notFound("participant");
  if (target.disqualifiedAt) throw errors.conflict("target_inactive", "that participant is out of the contest");

  const [named] = await tx.select({ name: user.name }).from(user).where(eq(user.id, input.targetId));
  const targetName = named?.name ?? null;
  const [attacker] = await tx.select({ name: user.name }).from(user).where(eq(user.id, input.actorId));
  const attackerName = attacker?.name ?? "Someone";

  // A shield, if they have one, is spent instead of the blackout landing.
  const shields = await tx
    .select({ id: powerupInventory.powerupId, quantity: powerupInventory.quantity, name: powerup.name })
    .from(powerupInventory)
    .innerJoin(powerup, eq(powerup.id, powerupInventory.powerupId))
    .where(and(eq(powerupInventory.participantId, input.targetId), eq(powerup.kind, "shield"), gt(powerupInventory.quantity, 0)))
    .orderBy(asc(powerupInventory.powerupId))
    .limit(1);

  if (shields.length > 0) {
    const s = shields[0];
    await tx
      .update(powerupInventory)
      .set({ quantity: sql`${powerupInventory.quantity} - 1` })
      .where(and(eq(powerupInventory.participantId, input.targetId), eq(powerupInventory.powerupId, s.id)));
    await tx.insert(notification).values({
      participantId: input.targetId,
      bodyMd: `**${attackerName}** tried to black you out. Your **${s.name}** absorbed it — ${s.quantity - 1} left.`,
    });
    return { shielded: true, endsAt: null, targetName };
  }

  const seconds = input.item.durationSeconds ?? 0;
  if (seconds <= 0) throw errors.conflict("no_duration", `${input.item.name} has no duration set — an organiser must configure it`);

  // Adjacency: start where their current stack ends, so simultaneous attacks
  // add up instead of overlapping.
  const now = new Date();
  const [row] = await tx
    .select({ until: sql<string | null>`max(${blackout.endsAt})` })
    .from(blackout)
    .where(and(eq(blackout.participantId, input.targetId), gt(blackout.endsAt, now)));
  // The aggregate arrives as a string; comparing that to a Date is always false,
  // which would silently make every blackout start now and overwrite the stack.
  const until = row?.until ? new Date(row.until) : null;
  const startsAt = until && until.getTime() > now.getTime() ? until : now;
  const endsAt = new Date(startsAt.getTime() + seconds * 1000);

  await tx.insert(blackout).values({
    participantId: input.targetId,
    byId: input.actorId,
    seconds,
    startsAt,
    endsAt,
  });
  await tx.insert(notification).values({
    participantId: input.targetId,
    bodyMd: `**${attackerName}** blacked you out for ${seconds} seconds.`,
  });
  return { shielded: false, endsAt, targetName };
}

async function replayUse(actorId: string, requestId: string): Promise<UseResult> {
  const [ev] = await db
    .select()
    .from(powerupEvent)
    .where(and(eq(powerupEvent.actorId, actorId), eq(powerupEvent.requestId, requestId)));
  const [inv] = ev?.powerupId
    ? await db
        .select()
        .from(powerupInventory)
        .where(and(eq(powerupInventory.participantId, actorId), eq(powerupInventory.powerupId, ev.powerupId)))
    : [undefined];
  const target = ev?.targetId ? await blackoutState(ev.targetId) : null;
  const [named] = ev?.targetId ? await db.select({ name: user.name }).from(user).where(eq(user.id, ev.targetId)) : [undefined];
  return {
    ok: true,
    outcome: ev?.kind === "blocked" ? "shielded" : "blackout",
    ends_at: target?.ends_at ?? null,
    target_name: named?.name ?? null,
    owned: inv?.quantity ?? 0,
    replayed: true,
  };
}

/** Push the new state to whoever it concerns, after the transaction has committed. */
export async function announceUse(actorId: string, targetId: string | null, result: UseResult): Promise<void> {
  if (!targetId) return;
  publish("powerup", await blackoutState(targetId), targetId);
  publish("notify", {}, targetId);
  publish("powerup", { you: "acted" }, actorId);
}

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------

export type PowerupPatch = Partial<{
  name: string;
  description: string;
  price: number;
  durationSeconds: number | null;
  enabled: boolean;
  maxHeld: number | null;
  maxPurchases: number | null;
  usablePhases: Phase[];
}>;

/**
 * Edit a powerup mid-contest.
 *
 * The new values govern the next purchase and the next use. A blackout already
 * on someone keeps the duration it landed with — it stores a real end time, not
 * a pointer at this row — so shortening the setting never cuts short a block
 * that is already running, and lengthening it never extends one.
 */
export async function savePowerup(actorId: string, id: number, patch: PowerupPatch, reason: string): Promise<void> {
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  if (Object.keys(clean).length === 0) throw errors.invalid("nothing to change");
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(powerup).where(eq(powerup.id, id));
    if (!before) throw errors.notFound("powerup");
    if (before.kind === "blackout" && "durationSeconds" in clean && !clean.durationSeconds) {
      throw errors.invalid("a blackout needs a duration");
    }
    await tx.update(powerup).set(clean).where(eq(powerup.id, id));
    await audit({ actorId, action: "powerup.update", target: String(id), reason, detail: { name: before.name, ...clean } }, tx);
  });
}

/** Every purchase and attack, newest first, for the organiser's record. */
export async function powerupLog(limit = 200) {
  const actor = user;
  const rows = await db
    .select({ e: powerupEvent, name: powerup.name })
    .from(powerupEvent)
    .leftJoin(powerup, eq(powerup.id, powerupEvent.powerupId))
    .orderBy(desc(powerupEvent.id))
    .limit(limit);
  const names = new Map(
    (await db.select({ id: actor.id, name: actor.name }).from(actor)).map((u) => [u.id, u.name ?? u.id]),
  );
  return rows.map((r) => ({
    id: r.e.id,
    kind: r.e.kind,
    powerup: r.name,
    actor: names.get(r.e.actorId) ?? r.e.actorId,
    target: r.e.targetId ? (names.get(r.e.targetId) ?? r.e.targetId) : null,
    cost: r.e.cost,
    at: r.e.createdAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/**
 * Seed the two powerups the contest ships with, once.
 *
 * They are rows, not constants, so everything about them — price, duration,
 * limits, which phases they work in — is editable in the admin without a
 * deploy. This only fills an empty table; it never overwrites an organiser's
 * settings on a later start.
 */
export async function ensurePowerups(): Promise<void> {
  const [existing] = await db.select({ id: powerup.id }).from(powerup).limit(1);
  if (existing) return;
  const coding: Phase[] = ["coding1", "final"];
  await db.insert(powerup).values([
    {
      kind: "blackout" as PowerupKind,
      name: "Blackout",
      description: "Blanks another competitor's screen and locks them out of the contest for a while. Stacks if several land.",
      price: 150,
      durationSeconds: 60,
      enabled: true,
      maxHeld: 3,
      maxPurchases: null,
      usablePhases: coding,
      sortOrder: 1,
    },
    {
      kind: "shield" as PowerupKind,
      name: "Shield",
      description: "Absorbs one Blackout aimed at you. Works while you hold it — there is nothing to switch on.",
      price: 120,
      durationSeconds: null,
      enabled: true,
      maxHeld: 3,
      maxPurchases: null,
      usablePhases: coding,
      sortOrder: 2,
    },
  ]);
}

