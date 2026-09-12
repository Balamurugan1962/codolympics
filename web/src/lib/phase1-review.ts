/**
 * Phase 1 review: the grading queue, standings, and who advances
 * (requirements-phase1.md, Epics P5 and P6).
 */
import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { p1Advancement, p1Answer, p1HackAttempt, p1HackQuestion, p1Question, participant } from "@/db/schema";

import { errors } from "./api";
import { audit } from "./audit";
import { publish } from "./events";

export type P1Standing = {
  participant_id: string;
  name: string;
  points: number;
  provisional: boolean;      // some manual items ungraded, or a validator error
  submitted_at: string | null;
  disqualified: boolean;
  advanced: boolean | null;
  rank: number;
};

/**
 * Ranked by total points, then earlier submission time (the rulebook's
 * tiebreak). Submission time is the later of the two "finish" actions, or
 * null if the participant never pressed finish -- those sort last on ties.
 */
export async function phase1Standings(): Promise<P1Standing[]> {
  const people = await db
    .select({ id: participant.userId, name: user.name, finishedA: participant.p1PuzzlesFinishedAt, finishedB: participant.p1HackingFinishedAt, dq: participant.disqualifiedAt })
    .from(participant)
    .innerJoin(user, eq(user.id, participant.userId));

  const answers = await db
    .select({ pid: p1Answer.participantId, auto: p1Answer.autoScore, manual: p1Answer.manualScore, explain: p1Answer.explainScore,
              grading: p1Question.grading, explainPoints: p1Question.explainPoints, scoreState: p1Answer.scoreState })
    .from(p1Answer)
    .innerJoin(p1Question, eq(p1Question.id, p1Answer.questionId))
    .where(and(eq(p1Question.voided, false), eq(p1Question.published, true)));

  const hacks = await db
    .select({ pid: p1HackAttempt.participantId, points: p1HackAttempt.pointsAwarded })
    .from(p1HackAttempt)
    .innerJoin(p1HackQuestion, eq(p1HackQuestion.id, p1HackAttempt.questionId))
    .where(and(eq(p1HackQuestion.voided, false), eq(p1HackAttempt.state, "done")));

  const adv = await db.select().from(p1Advancement);
  const advanced = new Map(adv.map((a) => [a.participantId, a.advanced]));

  const totals = new Map<string, { points: number; provisional: boolean }>();
  const bump = (pid: string, pts: number, provisional = false) => {
    const t = totals.get(pid) ?? { points: 0, provisional: false };
    t.points += pts; t.provisional = t.provisional || provisional; totals.set(pid, t);
  };
  for (const a of answers) {
    const ungradedManual = a.grading === "manual" && a.manual === null;
    const ungradedExplain = a.explainPoints > 0 && a.explain === null;
    const validatorErr = a.grading === "validator" && a.scoreState === "error";
    bump(a.pid, (a.auto ?? 0) + (a.manual ?? 0) + (a.explain ?? 0), ungradedManual || ungradedExplain || validatorErr);
  }
  for (const h of hacks) bump(h.pid, h.points);

  const rows: P1Standing[] = people.map((p) => {
    const t = totals.get(p.id) ?? { points: 0, provisional: false };
    const finished = [p.finishedA, p.finishedB].filter(Boolean) as Date[];
    const submittedAt = finished.length ? new Date(Math.max(...finished.map((d) => d.getTime()))) : null;
    return {
      participant_id: p.id, name: p.name, points: t.points, provisional: t.provisional,
      submitted_at: submittedAt?.toISOString() ?? null, disqualified: Boolean(p.dq),
      advanced: advanced.get(p.id) ?? null, rank: 0,
    };
  });

  const ranked = rows.filter((r) => !r.disqualified);
  ranked.sort((a, b) =>
    b.points - a.points ||
    (a.submitted_at ? Date.parse(a.submitted_at) : Infinity) - (b.submitted_at ? Date.parse(b.submitted_at) : Infinity) ||
    a.name.localeCompare(b.name));
  ranked.forEach((r, i) => { r.rank = i + 1; });
  return [...ranked, ...rows.filter((r) => r.disqualified)];
}

// ---------------------------------------------------------------------------
// Grading queue (US-P5-02)
// ---------------------------------------------------------------------------

/** Every manually graded item, grouped by question, identity optional. */
export async function gradingQueue() {
  const rows = await db
    .select({ a: p1Answer, q: p1Question, name: user.name })
    .from(p1Answer)
    .innerJoin(p1Question, eq(p1Question.id, p1Answer.questionId))
    .innerJoin(user, eq(user.id, p1Answer.participantId))
    .where(and(eq(p1Question.published, true), eq(p1Question.voided, false),
      sql`(${p1Question.grading} = 'manual' or ${p1Question.explainPoints} > 0)`))
    .orderBy(asc(p1Question.orderIndex), asc(p1Answer.updatedAt));

  const byQuestion = new Map<number, { question: typeof p1Question.$inferSelect; items: typeof rows }>();
  for (const r of rows) {
    const g = byQuestion.get(r.q.id) ?? { question: r.q, items: [] };
    g.items.push(r);
    byQuestion.set(r.q.id, g);
  }
  const ungraded = rows.filter((r) =>
    (r.q.grading === "manual" && r.a.manualScore === null) || (r.q.explainPoints > 0 && r.a.explainScore === null)).length;
  return { groups: [...byQuestion.values()], ungraded, total: rows.length };
}

export async function gradeAnswer(
  graderId: string,
  input: { participantId: string; questionId: number; manualScore?: number; explainScore?: number; comment?: string },
): Promise<void> {
  const [q] = await db.select().from(p1Question).where(eq(p1Question.id, input.questionId));
  if (!q) throw errors.notFound("question");
  if (input.manualScore !== undefined && (q.grading !== "manual" || input.manualScore < 0 || input.manualScore > q.points)) throw errors.invalid(`manual score must be 0–${q.points}`);
  if (input.explainScore !== undefined && (input.explainScore < 0 || input.explainScore > q.explainPoints)) throw errors.invalid(`explanation score must be 0–${q.explainPoints}`);
  await db.transaction(async (tx) => {
    await tx
      .update(p1Answer)
      .set({
        ...(input.manualScore !== undefined ? { manualScore: input.manualScore } : {}),
        ...(input.explainScore !== undefined ? { explainScore: input.explainScore } : {}),
        gradeComment: input.comment ?? null, gradedBy: graderId, gradedAt: new Date(),
      })
      .where(and(eq(p1Answer.participantId, input.participantId), eq(p1Answer.questionId, input.questionId)));
    await audit({ actorId: graderId, action: "p1.grade", target: `${input.participantId}/${input.questionId}`, reason: "grading", detail: input }, tx);
  });
  publish("leaderboard", {});
}

// ---------------------------------------------------------------------------
// Advancement (US-P6-01)
// ---------------------------------------------------------------------------

export async function setAdvancement(actorId: string, input: { participantIds: string[]; reason: string }): Promise<void> {
  const all = await db.select({ id: participant.userId }).from(participant);
  const chosen = new Set(input.participantIds);
  await db.transaction(async (tx) => {
    for (const p of all) {
      await tx
        .insert(p1Advancement)
        .values({ participantId: p.id, advanced: chosen.has(p.id), decidedBy: actorId, reason: input.reason })
        .onConflictDoUpdate({ target: p1Advancement.participantId, set: { advanced: chosen.has(p.id), decidedBy: actorId, decidedAt: new Date(), reason: input.reason } });
    }
    await audit({ actorId, action: "p1.advance", reason: input.reason, detail: { advanced: [...chosen] } }, tx);
  });
  for (const p of all) {
    publish("notify", { body: chosen.has(p.id) ? "You have been selected to advance to Phase 2." : "You were not selected for Phase 2. Thank you for taking part." }, p.id);
  }
}

export async function hasAdvanced(participantId: string): Promise<boolean> {
  const [row] = await db.select({ advanced: p1Advancement.advanced }).from(p1Advancement).where(eq(p1Advancement.participantId, participantId));
  return row?.advanced ?? false;
}

export async function disqualify(actorId: string, input: { participantId: string; reason: string; undo?: boolean }): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(participant)
      .set(input.undo ? { disqualifiedAt: null, disqualifiedReason: null } : { disqualifiedAt: new Date(), disqualifiedReason: input.reason })
      .where(eq(participant.userId, input.participantId));
    await audit({ actorId, action: input.undo ? "participant.requalify" : "participant.disqualify", target: input.participantId, reason: input.reason }, tx);
  });
  publish("leaderboard", {});
  publish("notify", { body: input.undo ? "Your disqualification has been reversed." : `You have been disqualified: ${input.reason}` }, input.participantId);
}

export { isNull };
