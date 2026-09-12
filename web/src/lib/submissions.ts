/**
 * Submissions and the judge poller (LLD §6).
 *
 * A submission is persisted BEFORE the judge is called (US-B5-01). Every
 * state transition is a database row, so a restart resumes mid-flight with
 * nothing lost -- that is why there is no in-memory queue here (NFR-B-09).
 */
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { judgement, ownership, participant, question, submission } from "@/db/schema";

import { errors } from "./api";
import { getContest, isPhase2 } from "./contest";
import { publish } from "./events";
import { judge, JudgeError, type Judgement as JudgeResult } from "./judge";
import { allowedLanguage } from "./languages";

export const COOLDOWN_MS = 3_000;
const IN_FLIGHT = ["pending", "queued", "running"] as const;

// ---------------------------------------------------------------------------
// Submitting
// ---------------------------------------------------------------------------

export async function submitSolution(
  participantId: string,
  input: { questionId: string; language: string; source: string },
): Promise<number> {
  const c = await getContest();
  if (!isPhase2(c.phase) || c.phase === "ended") throw errors.conflict("not_open", "submissions are not open");
  if (c.phaseEndsAt && c.phaseEndsAt.getTime() <= Date.now() && (c.phase === "coding1" || c.phase === "final")) {
    throw errors.conflict("round_closed", "this round has closed");
  }
  if (!(await allowedLanguage(input.language))) throw errors.invalid(`language '${input.language}' is not offered`);
  if (Buffer.byteLength(input.source, "utf8") > 262_144) throw errors.invalid("source is larger than 256 KB");

  const submissionId = await db.transaction(async (tx) => {
    const [p] = await tx.select().from(participant).where(eq(participant.userId, participantId)).for("update");
    if (!p) throw errors.forbidden("not a participant");
    if (p.disqualifiedAt) throw errors.forbidden("your account is disqualified");

    // Only the owner may attempt, enforced here, never by hiding the UI (US-B4-01).
    const [own] = await tx
      .select()
      .from(ownership)
      .where(and(eq(ownership.questionId, input.questionId), eq(ownership.participantId, participantId), isNull(ownership.voidedAt)));
    if (!own) throw errors.forbidden("you do not own this question");

    // One in flight per account (US-B5-03).
    const [inFlight] = await tx
      .select({ id: judgement.id })
      .from(judgement)
      .innerJoin(submission, eq(submission.id, judgement.submissionId))
      .where(and(eq(submission.participantId, participantId), inArray(judgement.state, [...IN_FLIGHT]), isNull(judgement.supersededAt)))
      .limit(1);
    if (inFlight) throw errors.conflict("in_flight", "your previous submission is still being judged");

    // 3 s cooldown after a job ends or is cancelled.
    if (p.lastJudgementEndedAt) {
      const wait = p.lastJudgementEndedAt.getTime() + COOLDOWN_MS - Date.now();
      if (wait > 0) throw errors.conflict("cooldown", `wait ${Math.ceil(wait / 1000)} s before submitting again`);
    }

    const [s] = await tx
      .insert(submission)
      .values({ participantId, questionId: input.questionId, language: input.language, source: input.source })
      .returning({ id: submission.id });
    await tx.insert(judgement).values({ submissionId: s.id, state: "pending" });
    return s.id;
  });

  // Hand to the judge now; if that fails the poller retries from the pending row.
  await sendPending();
  return submissionId;
}

/** Cancel the participant's in-flight judgement, if any. The cooldown starts now. */
export async function cancelInFlight(participantId: string): Promise<boolean> {
  const rows = await db
    .select({ j: judgement })
    .from(judgement)
    .innerJoin(submission, eq(submission.id, judgement.submissionId))
    .where(and(eq(submission.participantId, participantId), inArray(judgement.state, [...IN_FLIGHT]), isNull(judgement.supersededAt)));
  if (rows.length === 0) return false;
  for (const { j } of rows) {
    if (j.jobId) await judge.cancel(j.jobId).catch(() => undefined);
    await db
      .update(judgement)
      .set({ state: "done", cancelled: true, verdict: "IE", message: "cancelled", endedAt: new Date() })
      .where(eq(judgement.id, j.id));
  }
  await db.update(participant).set({ lastJudgementEndedAt: new Date() }).where(eq(participant.userId, participantId));
  publish("verdict", { cancelled: true }, participantId);
  return true;
}

// ---------------------------------------------------------------------------
// The poller
// ---------------------------------------------------------------------------

/** Send every pending judgement to the judge. Called on submit and each tick. */
export async function sendPending(): Promise<void> {
  const rows = await db
    .select({ j: judgement, s: submission })
    .from(judgement)
    .innerJoin(submission, eq(submission.id, judgement.submissionId))
    .where(and(eq(judgement.state, "pending"), isNull(judgement.supersededAt)))
    .limit(20);

  for (const { j, s } of rows) {
    try {
      const { job_id } = await judge.submit({
        problem_id: s.questionId,
        language: s.language,
        source: s.source,
        submission_id: `sub_${s.id}_${j.attempt}`,
      });
      await db.update(judgement).set({ state: "queued", jobId: job_id }).where(eq(judgement.id, j.id));
      publish("verdict", { submission_id: s.id, state: "queued" }, s.participantId);
    } catch (err) {
      // 404/400 from the judge means the problem is broken: IE, surfaced to admins.
      if (err instanceof JudgeError && (err.status === 404 || err.status === 400)) {
        await finish(j.id, s.participantId, { verdict: "IE", message: `judge rejected the submission: ${err.message}`, jury_detail: err.message });
      } else {
        // Unreachable or busy: stay pending, retry next tick (NFR-B-09).
        await db.update(judgement).set({ retries: sql`${judgement.retries} + 1` }).where(eq(judgement.id, j.id));
      }
    }
  }
}

/** Poll every queued/running judgement. */
export async function pollInFlight(): Promise<void> {
  const rows = await db
    .select({ j: judgement, s: submission })
    .from(judgement)
    .innerJoin(submission, eq(submission.id, judgement.submissionId))
    .where(and(inArray(judgement.state, ["queued", "running"]), isNull(judgement.supersededAt)));

  for (const { j, s } of rows) {
    if (!j.jobId) continue;
    try {
      const job = await judge.job<JudgeResult>(j.jobId);
      if (job.state === "done" && job.result) {
        await finish(j.id, s.participantId, job.result);
      } else {
        await db
          .update(judgement)
          .set({ state: job.state, progressDone: job.progress.done, progressTotal: job.progress.total })
          .where(eq(judgement.id, j.id));
        publish("verdict", { submission_id: s.id, state: job.state, progress: job.progress }, s.participantId);
      }
    } catch (err) {
      if (err instanceof JudgeError && err.status === 404) {
        // Job expired or the judge restarted: resubmit from stored source (US-B5-04).
        await db.update(judgement).set({ state: "pending", jobId: null, retries: sql`${judgement.retries} + 1` }).where(eq(judgement.id, j.id));
      }
      // Anything else: leave it, try again next tick.
    }
  }
}

async function finish(
  judgementId: number,
  participantId: string,
  r: Partial<JudgeResult> & { verdict: JudgeResult["verdict"]; message: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(judgement)
      .set({
        state: "done",
        verdict: r.verdict,
        passed: r.passed ?? 0,
        total: r.total ?? 0,
        firstFail: r.first_fail ?? null,
        maxTimeMs: r.max_time_ms ?? 0,
        maxMemoryKb: r.max_memory_kb ?? 0,
        compileOutput: r.compile_output ?? "",
        message: r.message,
        juryDetail: r.jury_detail ?? "",
        problemVersion: r.problem_version ?? null,
        progressDone: r.total ?? 0,
        progressTotal: r.total ?? 0,
        endedAt: new Date(),
      })
      .where(eq(judgement.id, judgementId));
    await tx.update(participant).set({ lastJudgementEndedAt: new Date() }).where(eq(participant.userId, participantId));
  });
  publish("verdict", { judgement_id: judgementId, state: "done", verdict: r.verdict }, participantId);
  if (r.verdict === "AC") publish("leaderboard", {});
}

// ---------------------------------------------------------------------------
// Reading, safely
// ---------------------------------------------------------------------------

/** A judgement as a participant may see it. `juryDetail` is deliberately absent (NFR-B-05). */
export function participantView(j: typeof judgement.$inferSelect) {
  return {
    id: j.id,
    state: j.state,
    verdict: j.verdict,
    passed: j.passed,
    total: j.total,
    first_fail: j.firstFail,
    max_time_ms: j.maxTimeMs,
    max_memory_kb: j.maxMemoryKb,
    compile_output: j.compileOutput,
    message: j.message,
    progress: { done: j.progressDone, total: j.progressTotal },
    cancelled: j.cancelled,
    created_at: j.createdAt.toISOString(),
    ended_at: j.endedAt?.toISOString() ?? null,
  };
}

/** A participant's submissions for one question, newest first, with current judgements. */
export async function historyFor(participantId: string, questionId: string) {
  const rows = await db
    .select({ s: submission, j: judgement })
    .from(submission)
    .innerJoin(judgement, and(eq(judgement.submissionId, submission.id), isNull(judgement.supersededAt)))
    .where(and(eq(submission.participantId, participantId), eq(submission.questionId, questionId)))
    .orderBy(desc(submission.id));
  return rows.map(({ s, j }) => ({
    id: s.id,
    language: s.language,
    created_at: s.createdAt.toISOString(),
    judgement: participantView(j),
  }));
}

/** Whether the participant has a judgement in flight, and how long until they may submit. */
export async function submitStatus(participantId: string) {
  const [p] = await db.select().from(participant).where(eq(participant.userId, participantId));
  const [inFlight] = await db
    .select({ id: judgement.id })
    .from(judgement)
    .innerJoin(submission, eq(submission.id, judgement.submissionId))
    .where(and(eq(submission.participantId, participantId), inArray(judgement.state, [...IN_FLIGHT]), isNull(judgement.supersededAt)))
    .limit(1);
  const cooldownMs = p?.lastJudgementEndedAt ? Math.max(0, p.lastJudgementEndedAt.getTime() + COOLDOWN_MS - Date.now()) : 0;
  return { in_flight: Boolean(inFlight), cooldown_ms: cooldownMs, server_now: Date.now() };
}

/** Rejudge every submission for a question (US-B9-01). Returns how many. */
export async function rejudgeQuestion(questionId: string): Promise<number> {
  const rows = await db
    .select({ id: submission.id, participantId: submission.participantId })
    .from(submission)
    .where(eq(submission.questionId, questionId));
  await db.transaction(async (tx) => {
    for (const s of rows) {
      const [current] = await tx
        .select({ id: judgement.id, attempt: judgement.attempt, jobId: judgement.jobId, state: judgement.state })
        .from(judgement)
        .where(and(eq(judgement.submissionId, s.id), isNull(judgement.supersededAt)))
        .orderBy(desc(judgement.attempt))
        .limit(1);
      if (!current) continue;
      if (current.jobId && current.state !== "done") await judge.cancel(current.jobId).catch(() => undefined);
      await tx.update(judgement).set({ supersededAt: new Date() }).where(eq(judgement.id, current.id));
      await tx.insert(judgement).values({ submissionId: s.id, state: "pending", attempt: current.attempt + 1 });
    }
  });
  for (const s of rows) publish("verdict", { rejudge: true }, s.participantId);
  return rows.length;
}

/** How many submissions a publish would rejudge -- the blast radius (US-F9-03). */
export async function submissionCount(questionId: string): Promise<number> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(submission).where(eq(submission.questionId, questionId));
  return n;
}

export { question };
