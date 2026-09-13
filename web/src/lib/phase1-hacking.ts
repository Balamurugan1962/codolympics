/**
 * Phase 1, Section B: hacking (requirements-phase1.md, Epic P3).
 *
 * A participant submits a test INPUT, never code. The judge validates it,
 * runs the stored reference, runs the given solution, and says whether it
 * broke. The first successful hack on a solution scores; later ones do not
 * (decision 61d). Feedback is deliberately thin (decision 61e).
 */
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { p1HackAttempt, p1HackQuestion, participant } from "@/db/schema";

import { errors } from "./api";
import { getContest } from "./contest";
import { publish } from "./events";
import { judge, JudgeError, type HackResult } from "./judge";

const COOLDOWN_MS = 3_000;

export type HQ = typeof p1HackQuestion.$inferSelect;

/** A hacking question as a participant sees it. The reference solution is not in this database at all. */
export function participantHackQuestion(q: HQ) {
  return {
    id: q.id,
    title: q.title,
    statement_md: q.statementMd,
    constraints_md: q.constraintsMd,
    given_source: q.givenSource,
    given_language: q.givenLanguage,
    hack_points: q.hackPoints,
    fail_penalty: q.failPenalty,
    order_index: q.orderIndex,
  };
}

export async function publishedHackQuestions(): Promise<HQ[]> {
  return db.select().from(p1HackQuestion).where(and(eq(p1HackQuestion.published, true), eq(p1HackQuestion.voided, false))).orderBy(p1HackQuestion.orderIndex, p1HackQuestion.id);
}

/** An attempt as a participant may see it: valid/invalid and hacked/not. Never the verdict (US-P3-05). */
export function participantAttempt(a: typeof p1HackAttempt.$inferSelect) {
  return {
    id: a.id,
    question_id: a.questionId,
    state: a.state,
    valid_input: a.validInput,
    invalid_reason: a.invalidReason,
    hacked: a.hacked,
    points_awarded: a.pointsAwarded,
    created_at: a.createdAt.toISOString(),
  };
}

export async function submitHack(participantId: string, questionId: number, input: string): Promise<number> {
  const c = await getContest();
  if (c.phase !== "p1_hacking") throw errors.conflict("section_closed", "Section B is not open");
  if (c.phaseEndsAt && c.phaseEndsAt.getTime() <= Date.now()) throw errors.conflict("section_closed", "Section B has closed");
  if (Buffer.byteLength(input, "utf8") > 262_144) throw errors.invalid("input is larger than 256 KB");

  const [q] = await db.select().from(p1HackQuestion).where(and(eq(p1HackQuestion.id, questionId), eq(p1HackQuestion.published, true)));
  if (!q) throw errors.notFound("question");

  const id = await db.transaction(async (tx) => {
    const [p] = await tx.select().from(participant).where(eq(participant.userId, participantId)).for("update");
    if (!p) throw errors.forbidden("not a participant");
    if (p.disqualifiedAt) throw errors.forbidden("your account is disqualified");
    if (p.p1HackingFinishedAt) throw errors.conflict("finished", "you have finished this section");

    // One in flight, then a cooldown -- as in Phase 2 (US-P3-03).
    const [last] = await tx
      .select()
      .from(p1HackAttempt)
      .where(eq(p1HackAttempt.participantId, participantId))
      .orderBy(desc(p1HackAttempt.id))
      .limit(1);
    if (last && last.state !== "done") throw errors.conflict("in_flight", "your previous attempt is still being judged");
    if (last?.endedAt && last.endedAt.getTime() + COOLDOWN_MS > Date.now()) throw errors.conflict("cooldown", "wait a moment before trying again");

    const [row] = await tx.insert(p1HackAttempt).values({ participantId, questionId, input, state: "pending" }).returning({ id: p1HackAttempt.id });
    return row.id;
  });

  await sendPendingHacks();
  return id;
}

export async function sendPendingHacks(): Promise<void> {
  const rows = await db
    .select({ a: p1HackAttempt, q: p1HackQuestion })
    .from(p1HackAttempt)
    .innerJoin(p1HackQuestion, eq(p1HackQuestion.id, p1HackAttempt.questionId))
    .where(eq(p1HackAttempt.state, "pending"))
    .limit(20);
  for (const { a, q } of rows) {
    try {
      const { job_id } = await judge.hack({
        problem_id: q.problemId,
        language: q.givenLanguage,
        source: q.givenSource,
        input: a.input,
        submission_id: `hack_${a.id}`,
      });
      await db.update(p1HackAttempt).set({ state: "queued", jobId: job_id }).where(eq(p1HackAttempt.id, a.id));
    } catch (err) {
      if (err instanceof JudgeError && (err.judgeStatus === 400 || err.judgeStatus === 404)) {
        // The problem is broken: neither a hack nor a failure, nothing scored.
        await db.update(p1HackAttempt).set({ state: "done", validInput: true, hacked: null, verdict: "IE", invalidReason: null, endedAt: new Date() }).where(eq(p1HackAttempt.id, a.id));
      } else {
        await db.update(p1HackAttempt).set({ retries: sql`${p1HackAttempt.retries} + 1` }).where(eq(p1HackAttempt.id, a.id));
      }
    }
  }
}

export async function pollHacks(): Promise<void> {
  const rows = await db
    .select({ a: p1HackAttempt, q: p1HackQuestion })
    .from(p1HackAttempt)
    .innerJoin(p1HackQuestion, eq(p1HackQuestion.id, p1HackAttempt.questionId))
    .where(sql`${p1HackAttempt.state} in ('queued','running')`);
  for (const { a, q } of rows) {
    if (!a.jobId) continue;
    try {
      const job = await judge.job<HackResult>(a.jobId);
      if (job.state !== "done" || !job.result) {
        if (job.state !== a.state) await db.update(p1HackAttempt).set({ state: job.state }).where(eq(p1HackAttempt.id, a.id));
        continue;
      }
      await settle(a, q, job.result);
    } catch (err) {
      if (err instanceof JudgeError && err.judgeStatus === 404) {
        await db.update(p1HackAttempt).set({ state: "pending", jobId: null }).where(eq(p1HackAttempt.id, a.id));
      }
    }
  }
}

async function settle(a: typeof p1HackAttempt.$inferSelect, q: HQ, r: HackResult): Promise<void> {
  await db.transaction(async (tx) => {
    let points = 0;
    if (r.valid_input && r.hacked === true) {
      // First successful hack on this solution scores; later ones report success but score nothing.
      const [prior] = await tx
        .select({ id: p1HackAttempt.id })
        .from(p1HackAttempt)
        .where(and(eq(p1HackAttempt.participantId, a.participantId), eq(p1HackAttempt.questionId, q.id), eq(p1HackAttempt.hacked, true)))
        .limit(1);
      points = prior ? 0 : q.hackPoints;
    } else if (r.valid_input && r.hacked === false) {
      points = -q.failPenalty;
    }
    // Invalid input, or IE (problem broken): nothing scored either way.
    await tx
      .update(p1HackAttempt)
      .set({
        state: "done",
        validInput: r.valid_input,
        invalidReason: r.valid_input ? null : r.invalid_reason,
        hacked: r.hacked,
        verdict: r.verdict,
        pointsAwarded: points,
        endedAt: new Date(),
      })
      .where(eq(p1HackAttempt.id, a.id));
  });
  publish("hack", { attempt_id: a.id, state: "done" }, a.participantId);
  publish("leaderboard", {});
}

export async function tickHacking(): Promise<void> {
  await sendPendingHacks();
  await pollHacks();
}
