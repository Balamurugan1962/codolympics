/**
 * Administrator overrides (US-B9-01, US-B9-02, US-B9-04, US-P6-04). Every
 * function here takes a reason and writes the audit log inside the same
 * transaction as the change. Affected participants are notified.
 */
import { and, count, desc, eq, getTableName, inArray, isNull, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { user } from "@/db/auth-schema";
import {
  announcement, auditLog, bid, contest, draft, hint, hintPurchase, judgement, ledger, lot, notification, ownership,
  p1Advancement, p1Answer, p1HackAttempt, p1HackQuestion, p1Question, participant, question, submission,
} from "@/db/schema";

import { errors } from "./api";
import { audit } from "./audit";
import { auth } from "./auth";
import { getContest, phaseSnapshot } from "./contest";
import { publish } from "./events";
import { judge } from "./judge";
import { deleteAllPackages } from "./problems";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function credit(tx: Tx, participantId: string, delta: number, reason: "refund" | "admin_adjust", ref: string): Promise<number> {
  const [p] = await tx.select().from(participant).where(eq(participant.userId, participantId)).for("update");
  if (!p) throw errors.notFound("participant");
  const balanceAfter = p.balance + delta;
  if (balanceAfter < 0) throw errors.conflict("negative_balance", `that would leave ${balanceAfter}`);
  await tx.update(participant).set({ balance: balanceAfter }).where(eq(participant.userId, participantId));
  await tx.insert(ledger).values({ participantId, delta, balanceAfter, reason, ref });
  return balanceAfter;
}

async function notify(tx: Tx, participantId: string, bodyMd: string): Promise<void> {
  await tx.insert(notification).values({ participantId, bodyMd });
}

// ---------------------------------------------------------------------------
// Contest parameters
// ---------------------------------------------------------------------------

export type ContestPatch = Partial<Pick<typeof contest.$inferInsert,
  "startingBalance" | "bidIncrement" | "countdownSeconds" | "openingWindowSeconds" | "ownershipCap" |
  "coding1Minutes" | "finalMinutes" | "p1PuzzlesMinutes" | "p1HackingMinutes" | "p1SelectionBasis" |
  "p1LeaderboardMode" | "leaderboardMode">>;

export async function updateContest(actorId: string, patch: ContestPatch, reason: string): Promise<void> {
  const c = await getContest();
  const set: ContestPatch & { leaderboardFrozenAt?: Date | null } = { ...patch };
  if (patch.leaderboardMode && patch.leaderboardMode !== c.leaderboardMode) {
    set.leaderboardFrozenAt = patch.leaderboardMode === "frozen" ? new Date() : null;
  }
  await db.transaction(async (tx) => {
    await tx.update(contest).set(set).where(eq(contest.id, 1));
    await audit({ actorId, action: "contest.update", reason, detail: patch }, tx);
  });
  publish("phase", phaseSnapshot(await getContest()));
  if (patch.leaderboardMode) publish("leaderboard", {});
}

// ---------------------------------------------------------------------------
// The reset (Settings → Danger zone)
// ---------------------------------------------------------------------------

/** Everything a run of the contest produces. Content and settings are not in this list. */
const RUN_TABLES: PgTable[] = [bid, lot, ownership, hintPurchase, ledger, judgement, submission, draft, notification, announcement, p1Answer, p1HackAttempt, p1Advancement, participant];
/** What the organisers authored. Only "wipe everything" touches these. */
const CONTENT_TABLES: PgTable[] = [hint, question, p1Question, p1HackQuestion];

const SETTINGS_DEFAULTS = {
  startingBalance: 1000, bidIncrement: 10, countdownSeconds: 15, openingWindowSeconds: 30, ownershipCap: null,
  coding1Minutes: 90, finalMinutes: 60, p1PuzzlesMinutes: 45, p1HackingMinutes: 45, p1SelectionBasis: "",
  p1LeaderboardMode: "hidden" as const, leaderboardMode: "live" as const,
};

export type ResetScope = "run" | "everything";

/**
 * Put the contest back to the start. "run" removes every participant account
 * and everything they did, and returns the contest to registration; problems,
 * Phase 1 questions, settings, staff accounts and the audit log are kept.
 * "everything" also deletes every problem, package, Phase 1 question and hint
 * and restores the default settings. The reset itself is audit-logged.
 */
export async function resetContest(actorId: string, input: { scope: ResetScope; reason: string }): Promise<{ participants: number; packages: number }> {
  const everything = input.scope === "everything";
  const names = (tables: PgTable[]) => tables.map((t) => `"${getTableName(t)}"`).join(", ");
  const [{ participants }] = await db.select({ participants: count() }).from(participant);

  await db.transaction(async (tx) => {
    await tx.execute(sql.raw(`truncate table ${names(RUN_TABLES)} restart identity cascade`));
    await tx.delete(user).where(eq(user.role, "participant")); // sessions and accounts cascade
    if (everything) {
      await tx.execute(sql.raw(`truncate table ${names(CONTENT_TABLES)} restart identity cascade`));
    } else {
      await tx.update(question).set({ status: "unsold" }).where(eq(question.status, "sold"));
    }
    await tx
      .update(contest)
      .set({ phase: "registration", phaseEndsAt: null, registrationOpen: true, leaderboardFrozenAt: null, ...(everything ? SETTINGS_DEFAULTS : {}) })
      .where(eq(contest.id, 1));
    await audit({ actorId, action: everything ? "contest.wipe" : "contest.reset", reason: input.reason, detail: { participants, scope: input.scope } }, tx);
  });

  const packages = everything ? await deleteAllPackages() : 0;
  publish("phase", phaseSnapshot(await getContest()));
  publish("leaderboard", {});
  return { participants, packages };
}

// ---------------------------------------------------------------------------
// Questions: void, rejudge outcomes, refunds
// ---------------------------------------------------------------------------

/** Refund the question price and, by default, every hint bought for it (US-B9-02). */
export async function voidQuestion(
  actorId: string,
  input: { questionId: string; reason: string; refundPrice?: boolean; refundHints?: boolean },
): Promise<void> {
  const refundPrice = input.refundPrice ?? true;
  const refundHints = input.refundHints ?? true;
  await db.transaction(async (tx) => {
    const [q] = await tx.select().from(question).where(eq(question.id, input.questionId)).for("update");
    if (!q) throw errors.notFound("question");
    const [own] = await tx.select().from(ownership).where(and(eq(ownership.questionId, q.id), isNull(ownership.voidedAt)));

    await tx.update(question).set({ status: "void" }).where(eq(question.id, q.id));
    let refunded = 0;
    if (own) {
      await tx.update(ownership).set({ voidedAt: new Date() }).where(eq(ownership.questionId, q.id));
      if (refundPrice) refunded += own.pricePaid;
      if (refundHints) {
        const hints = await tx.select().from(hintPurchase).where(and(eq(hintPurchase.questionId, q.id), eq(hintPurchase.participantId, own.participantId)));
        refunded += hints.reduce((s, h) => s + h.pricePaid, 0);
      }
      if (refunded > 0) await credit(tx, own.participantId, refunded, "refund", `void:${q.id}`);
      await notify(tx, own.participantId, `**${q.title}** was voided by the organisers${refunded ? ` and ${refunded} was refunded to you` : ""}. Reason: ${input.reason}`);
    }
    await tx.insert(announcement).values({ bodyMd: `Question **${q.title}** has been voided. ${input.reason}` });
    await audit({ actorId, action: "question.void", target: q.id, reason: input.reason, detail: { refunded, owner: own?.participantId ?? null } }, tx);
  });
  publish("leaderboard", {});
  publish("announce", {});
  publish("balance", {});
}

/** After a rejudge, the explicit choice: let the verdict stand, refund the owner, or void (US-B9-01). */
export async function rejudgeOutcome(
  actorId: string,
  input: { questionId: string; outcome: "stand" | "refund" | "void"; reason: string },
): Promise<void> {
  if (input.outcome === "void") return voidQuestion(actorId, { questionId: input.questionId, reason: input.reason });
  await db.transaction(async (tx) => {
    const [own] = await tx.select().from(ownership).where(and(eq(ownership.questionId, input.questionId), isNull(ownership.voidedAt)));
    if (input.outcome === "refund" && own) {
      await credit(tx, own.participantId, own.pricePaid, "refund", `rejudge:${input.questionId}`);
      await notify(tx, own.participantId, `You were refunded ${own.pricePaid} for **${input.questionId}** after a correction. You keep the question.`);
    } else if (own) {
      await notify(tx, own.participantId, `**${input.questionId}** was corrected and your submissions were rejudged; the verdicts stand.`);
    }
    await audit({ actorId, action: "rejudge.outcome", target: input.questionId, reason: input.reason, detail: { outcome: input.outcome } }, tx);
  });
  publish("balance", {});
}

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

export async function adjustBalance(actorId: string, input: { participantId: string; delta: number; reason: string }): Promise<number> {
  const after = await db.transaction(async (tx) => {
    const b = await credit(tx, input.participantId, input.delta, "admin_adjust", "admin");
    await notify(tx, input.participantId, `An organiser adjusted your balance by ${input.delta > 0 ? "+" : ""}${input.delta}. Reason: ${input.reason}`);
    await audit({ actorId, action: "balance.adjust", target: input.participantId, reason: input.reason, detail: { delta: input.delta, balanceAfter: b } }, tx);
    return b;
  });
  publish("balance", { balance: after }, input.participantId);
  return after;
}

export async function resetPassword(actorId: string, input: { userId: string; password: string; reason: string; headers: Headers }): Promise<void> {
  if (input.password.length < 8) throw errors.invalid("password: at least 8 characters");
  await auth.api.setUserPassword({ body: { userId: input.userId, newPassword: input.password }, headers: input.headers });
  await audit({ actorId, action: "password.reset", target: input.userId, reason: input.reason });
}

export async function renameUser(actorId: string, input: { userId: string; name: string; reason: string }): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(user).set({ name: input.name, displayUsername: input.name }).where(eq(user.id, input.userId));
    await audit({ actorId, action: "user.rename", target: input.userId, reason: input.reason, detail: { name: input.name } }, tx);
  });
}

/** Remove an account outright. Only sensible before the contest starts. */
export async function removeUser(actorId: string, input: { userId: string; reason: string }): Promise<void> {
  const c = await getContest();
  if (c.phase !== "registration") throw errors.conflict("contest_running", "accounts can only be removed during registration; disqualify instead");
  await db.transaction(async (tx) => {
    await tx.delete(ledger).where(eq(ledger.participantId, input.userId));
    await tx.delete(participant).where(eq(participant.userId, input.userId));
    await tx.delete(user).where(eq(user.id, input.userId));
    await audit({ actorId, action: "user.remove", target: input.userId, reason: input.reason }, tx);
  });
}

/** Correct ownership by hand (US-B9-04). Moves a sold question to another participant without money changing hands. */
export async function transferOwnership(actorId: string, input: { questionId: string; toParticipantId: string; reason: string }): Promise<void> {
  await db.transaction(async (tx) => {
    const [own] = await tx.select().from(ownership).where(eq(ownership.questionId, input.questionId)).for("update");
    if (!own) throw errors.notFound("ownership");
    const from = own.participantId;
    await tx.update(ownership).set({ participantId: input.toParticipantId, awardedAt: new Date() }).where(eq(ownership.questionId, input.questionId));
    await notify(tx, from, `**${input.questionId}** was reassigned by an organiser. Reason: ${input.reason}`);
    await notify(tx, input.toParticipantId, `**${input.questionId}** was assigned to you by an organiser.`);
    await audit({ actorId, action: "ownership.transfer", target: input.questionId, reason: input.reason, detail: { from, to: input.toParticipantId } }, tx);
  });
  publish("leaderboard", {});
}

// ---------------------------------------------------------------------------
// Announcements, health, audit, export
// ---------------------------------------------------------------------------

export async function announce(actorId: string, bodyMd: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(announcement).values({ bodyMd });
    await audit({ actorId, action: "announce", reason: "announcement", detail: { bodyMd } }, tx);
  });
  publish("announce", { body_md: bodyMd });
}

export async function health() {
  const judgeHealth = await judge.health().catch(() => null);
  const [backlog] = await db
    .select({
      pending: sql<number>`count(*) filter (where ${judgement.state} = 'pending')::int`,
      inFlight: sql<number>`count(*) filter (where ${judgement.state} in ('queued','running'))::int`,
      retrying: sql<number>`count(*) filter (where ${judgement.retries} > 0 and ${judgement.state} <> 'done')::int`,
      internalErrors: sql<number>`count(*) filter (where ${judgement.verdict} = 'IE' and ${judgement.cancelled} = false)::int`,
    })
    .from(judgement)
    .where(isNull(judgement.supersededAt));
  return { judge: judgeHealth, backlog, server_now: Date.now() };
}

export async function recentAudit(limit = 200) {
  return db
    .select({ entry: auditLog, actor: user.name })
    .from(auditLog)
    .leftJoin(user, eq(user.id, auditLog.actorId))
    .orderBy(desc(auditLog.id))
    .limit(limit);
}

/** Everything, for the record (US-B10-03). */
export async function exportAll() {
  const [c] = await db.select().from(contest);
  return {
    exported_at: new Date().toISOString(),
    contest: c,
    participants: await db.select({ p: participant, name: user.name }).from(participant).innerJoin(user, eq(user.id, participant.userId)),
    questions: await db.select().from(question),
    ownership: await db.select().from(ownership),
    ledger: await db.select().from(ledger).orderBy(ledger.id),
    submissions: await db.select().from(submission).orderBy(submission.id),
    judgements: await db.select().from(judgement).orderBy(judgement.id),
    hint_purchases: await db.select().from(hintPurchase),
    phase1_questions: await db.select().from(p1Question),
    phase1_answers: await db.select().from(p1Answer),
    phase1_hack_questions: await db.select().from(p1HackQuestion),
    audit: await db.select().from(auditLog).orderBy(auditLog.id),
  };
}

/** Participants who own nothing after an auction -- the dashboard flag from US-B4-03. */
export async function participantsOverview() {
  const rows = await db
    .select({ p: participant, name: user.name, username: user.username, role: user.role })
    .from(participant)
    .innerJoin(user, eq(user.id, participant.userId))
    .orderBy(user.name);
  const owned = await db
    .select({ pid: ownership.participantId, n: count() })
    .from(ownership)
    .where(isNull(ownership.voidedAt))
    .groupBy(ownership.participantId);
  const ownedBy = new Map(owned.map((o) => [o.pid, o.n]));
  return rows.map((r) => ({
    id: r.p.userId, name: r.name, username: r.username, balance: r.p.balance,
    preferred_language: r.p.preferredLanguage, owned: ownedBy.get(r.p.userId) ?? 0,
    disqualified: Boolean(r.p.disqualifiedAt), disqualified_reason: r.p.disqualifiedReason,
  }));
}

/**
 * Everyone who runs the contest rather than competing in it. Administrators
 * first, because that is the order a reader cares about, then by name.
 */
export async function staffOverview() {
  const rows = await db
    .select({ id: user.id, name: user.name, username: user.username, role: user.role, createdAt: user.createdAt })
    .from(user)
    .where(inArray(user.role, ["admin", "evaluator"]))
    .orderBy(user.role, user.name);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    username: r.username,
    role: r.role ?? "evaluator",
    created_at: r.createdAt.toISOString(),
  }));
}

export { inArray };
