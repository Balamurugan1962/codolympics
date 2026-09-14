/**
 * Everything the judge is being asked to do, in one list.
 *
 * Three different things in this system end up as a job on the judge, and until
 * now each was only visible from its own page:
 *
 *   a code submission  -> one `judgement` row per attempt (a rejudge is a new
 *                         request, so superseded rows are shown too)
 *   a hack             -> one `p1HackAttempt` row; the participant sends an
 *                         input, the judge runs someone else's code on it
 *   a validator run    -> one `p1Answer` row, scored at section close
 *
 * When the judge is slow or a container has fallen over, the question is never
 * "how are submissions doing" — it is "what is it chewing on", and the answer
 * has to include the hacks. So they are normalised into one shape here and
 * merged, with whatever is still in flight first: that is the part that can
 * still go wrong.
 *
 * Nothing here is participant-facing. It carries jury detail, verdicts on
 * hacks, and source code, and is only ever reached through an admin or
 * evaluator session.
 */
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/auth-schema";
import {
  judgement,
  p1Answer,
  p1HackAttempt,
  p1HackQuestion,
  p1Question,
  question,
  submission,
} from "@/db/schema";

import { errors } from "./api";
import { judge } from "./judge";

export type WorkKind = "submission" | "hack" | "validator";

/** One request to the judge, whatever kind it is. */
export type Work = {
  kind: WorkKind;
  /** Stable across refreshes, and what the row is keyed and linked by. */
  key: string;
  /** The row id in its own table — "hack/12" addresses the detail endpoint. */
  ref: string;
  job_id: string | null;
  /** pending = not yet accepted by the judge. error = it answered, badly. */
  state: "pending" | "queued" | "running" | "done" | "error";
  live: boolean;
  participant_id: string;
  name: string;
  /** What is being judged, as a person would name it. */
  target: string;
  /** The package id actually sent to the judge. */
  problem_id: string | null;
  language: string | null;
  progress: { done: number; total: number } | null;
  /** The short result: a verdict code, or a hack outcome. */
  verdict: string | null;
  /**
   * How it finished, as a chip. Submissions carry a verdict and the table
   * spells that out itself; a hack or a validator run has no verdict, so the
   * word and its colour are decided here — otherwise every one of them renders
   * the same grey dot and "broke the solution" looks like "rejected".
   */
  label: string | null;
  tone: "success" | "destructive" | "warning" | "info" | "neutral";
  /** The rest of the sentence, after the chip. */
  outcome: string | null;
  retries: number;
  attempt: number | null;
  superseded: boolean;
  created_at: string;
  ended_at: string | null;
  duration_ms: number | null;
};

const LIVE = new Set(["pending", "queued", "running"]);

function shape(w: Omit<Work, "live" | "duration_ms">): Work {
  const started = new Date(w.created_at).getTime();
  const ended = w.ended_at ? new Date(w.ended_at).getTime() : null;
  return { ...w, live: LIVE.has(w.state), duration_ms: ended ? ended - started : null };
}

/**
 * The feed. `limit` caps each source, not the total, so a burst of submissions
 * cannot push every hack off the end of the list.
 */
export async function judgeActivity(limit = 200): Promise<Work[]> {
  const [subs, hacks, validators] = await Promise.all([
    db
      .select({ j: judgement, s: submission, name: user.name, title: question.title })
      .from(judgement)
      .innerJoin(submission, eq(submission.id, judgement.submissionId))
      .innerJoin(user, eq(user.id, submission.participantId))
      .innerJoin(question, eq(question.id, submission.questionId))
      .orderBy(desc(judgement.id))
      .limit(limit),
    db
      .select({ a: p1HackAttempt, q: p1HackQuestion, name: user.name })
      .from(p1HackAttempt)
      .innerJoin(p1HackQuestion, eq(p1HackQuestion.id, p1HackAttempt.questionId))
      .innerJoin(user, eq(user.id, p1HackAttempt.participantId))
      .orderBy(desc(p1HackAttempt.id))
      .limit(limit),
    db
      .select({ a: p1Answer, q: p1Question, name: user.name })
      .from(p1Answer)
      .innerJoin(p1Question, eq(p1Question.id, p1Answer.questionId))
      .innerJoin(user, eq(user.id, p1Answer.participantId))
      .where(isNotNull(p1Answer.scoreState))
      .orderBy(desc(p1Answer.updatedAt))
      .limit(limit),
  ]);

  const rows: Work[] = [
    ...subs.map(({ j, s, name, title }) =>
      shape({
        kind: "submission",
        key: `submission:${j.id}`,
        ref: `submission/${j.id}`,
        job_id: j.jobId,
        state: j.state === "done" && j.verdict === "IE" ? "error" : (j.state as Work["state"]),
        participant_id: s.participantId,
        name: name ?? s.participantId,
        target: title,
        problem_id: s.questionId,
        language: s.language,
        progress: j.progressTotal > 0 ? { done: j.progressDone, total: j.progressTotal } : null,
        verdict: j.verdict,
        label: null,
        tone: j.verdict === "AC" ? "success" : j.verdict ? "destructive" : "neutral",
        outcome: j.cancelled ? "Cancelled" : (j.message ?? null),
        retries: j.retries,
        attempt: j.attempt,
        superseded: Boolean(j.supersededAt),
        created_at: j.createdAt.toISOString(),
        ended_at: j.endedAt?.toISOString() ?? null,
      }),
    ),
    ...hacks.map(({ a, q, name }) =>
      shape({
        kind: "hack",
        key: `hack:${a.id}`,
        ref: `hack/${a.id}`,
        job_id: a.jobId,
        state: a.state === "done" && a.verdict === "IE" ? "error" : a.state,
        participant_id: a.participantId,
        name: name ?? a.participantId,
        target: q.title,
        problem_id: q.problemId,
        language: q.givenLanguage,
        progress: null,
        verdict: a.verdict,
        ...hackChip(a),
        retries: a.retries,
        attempt: null,
        superseded: false,
        created_at: a.createdAt.toISOString(),
        ended_at: a.endedAt?.toISOString() ?? null,
      }),
    ),
    ...validators.map(({ a, q, name }) =>
      shape({
        kind: "validator",
        key: `validator:${a.participantId}:${a.questionId}`,
        ref: `validator/${a.participantId}:${a.questionId}`,
        job_id: a.scoreJobId,
        state: (a.scoreState ?? "pending") as Work["state"],
        participant_id: a.participantId,
        name: name ?? a.participantId,
        target: q.title,
        problem_id: null,
        language: "python",
        progress: null,
        verdict: a.scoreState === "error" ? "IE" : null,
        label: a.scoreState === "error" ? "Judge error" : a.scoreState === "done" ? `Scored ${a.autoScore ?? 0}` : null,
        tone: a.scoreState === "error" ? "destructive" : "success",
        outcome: a.scoreState === "error" ? (a.scoreError ?? "the validator did not finish") : null,
        retries: 0,
        attempt: null,
        superseded: false,
        created_at: a.updatedAt.toISOString(),
        /* A p1Answer keeps one timestamp, not two, so there is no honest
         * duration to report for a validator run. Better an em dash than a
         * confident "0 ms". */
        ended_at: null,
      }),
    ),
  ];

  // In flight first, oldest at the top — the one that has been waiting longest
  // is the one worth looking at. Everything settled follows, newest first.
  return rows.sort((a, b) => {
    if (a.live !== b.live) return a.live ? -1 : 1;
    const t = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return a.live ? t : -t;
  });
}

type Chip = { label: string | null; tone: Work["tone"]; outcome: string | null };

function hackChip(a: typeof p1HackAttempt.$inferSelect): Chip {
  if (a.state !== "done") return { label: null, tone: "info", outcome: null };
  if (a.verdict === "IE") return { label: "Judge error", tone: "destructive", outcome: "the judge could not run it" };
  if (a.validInput === false) return { label: "Rejected", tone: "warning", outcome: a.invalidReason ?? "the input broke the constraints" };
  if (a.hacked === true) return { label: "Broke it", tone: "success", outcome: "the solution failed on this input" };
  if (a.hacked === false) return { label: "Held", tone: "neutral", outcome: "the solution survived" };
  return { label: null, tone: "neutral", outcome: null };
}

/** The same words, as one sentence, for the drawer. */
function hackOutcome(a: typeof p1HackAttempt.$inferSelect): string | null {
  const c = hackChip(a);
  return c.label ? (c.outcome ? `${c.label} — ${c.outcome}` : c.label) : null;
}

/** Counts for the header tiles, taken from the same rows the list is built from. */
export function summarise(rows: Work[]) {
  const live = rows.filter((r) => r.live);
  return {
    live: live.length,
    queued: live.filter((r) => r.state === "queued" || r.state === "pending").length,
    running: live.filter((r) => r.state === "running").length,
    retrying: live.filter((r) => r.retries > 0).length,
    errors: rows.filter((r) => r.state === "error" && !r.superseded).length,
    hacks: live.filter((r) => r.kind === "hack").length,
  };
}

// ---------------------------------------------------------------------------
// One request, in full
// ---------------------------------------------------------------------------

export type WorkDetail = Awaited<ReturnType<typeof workDetail>>;

/**
 * Everything known about one judge request, including what was sent to it.
 *
 * The three kinds do not share a shape, so this returns a tagged union rather
 * than a lowest common denominator: a hack has an input and no test counts, a
 * submission has test counts and no input.
 */
export async function workDetail(kind: string, id: string) {
  if (kind === "submission") return submissionDetail(Number(id));
  if (kind === "hack") return hackDetail(Number(id));
  if (kind === "validator") return validatorDetail(id);
  throw errors.notFound("job");
}

async function submissionDetail(judgementId: number) {
  const [row] = await db
    .select({ j: judgement, s: submission, name: user.name, title: question.title })
    .from(judgement)
    .innerJoin(submission, eq(submission.id, judgement.submissionId))
    .innerJoin(user, eq(user.id, submission.participantId))
    .innerJoin(question, eq(question.id, submission.questionId))
    .where(eq(judgement.id, judgementId));
  if (!row) throw errors.notFound("job");
  const { j, s } = row;

  // The testcase that failed, read back at the exact version it was judged
  // against — a package republished since would otherwise show the wrong data.
  const failing =
    j.firstFail !== null && j.problemVersion
      ? await judge.testcase(s.questionId, j.firstFail, j.problemVersion).catch(() => null)
      : null;

  const attempts = await db
    .select({ id: judgement.id, attempt: judgement.attempt, verdict: judgement.verdict, state: judgement.state, createdAt: judgement.createdAt })
    .from(judgement)
    .where(eq(judgement.submissionId, s.id))
    .orderBy(desc(judgement.attempt));

  return {
    kind: "submission" as const,
    who: { id: s.participantId, name: row.name ?? s.participantId },
    submitted_at: s.createdAt.toISOString(),
    target: { title: row.title, problem_id: s.questionId },
    source: s.source,
    language: s.language,
    request: {
      job_id: j.jobId,
      state: j.state,
      attempt: j.attempt,
      retries: j.retries,
      cancelled: j.cancelled,
      superseded_at: j.supersededAt?.toISOString() ?? null,
      problem_version: j.problemVersion,
      created_at: j.createdAt.toISOString(),
      ended_at: j.endedAt?.toISOString() ?? null,
    },
    result: {
      verdict: j.verdict,
      passed: j.passed,
      total: j.total,
      first_fail: j.firstFail,
      max_time_ms: j.maxTimeMs,
      max_memory_kb: j.maxMemoryKb,
      message: j.message,
      jury_detail: j.juryDetail,
      compile_output: j.compileOutput,
      progress: { done: j.progressDone, total: j.progressTotal },
    },
    failing_testcase: failing,
    attempts: attempts.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
  };
}

async function hackDetail(attemptId: number) {
  const [row] = await db
    .select({ a: p1HackAttempt, q: p1HackQuestion, name: user.name })
    .from(p1HackAttempt)
    .innerJoin(p1HackQuestion, eq(p1HackQuestion.id, p1HackAttempt.questionId))
    .innerJoin(user, eq(user.id, p1HackAttempt.participantId))
    .where(eq(p1HackAttempt.id, attemptId));
  if (!row) throw errors.notFound("job");
  const { a, q } = row;

  return {
    kind: "hack" as const,
    who: { id: a.participantId, name: row.name ?? a.participantId },
    submitted_at: a.createdAt.toISOString(),
    target: { title: q.title, problem_id: q.problemId },
    /* A hack sends an input, not code. The code is the solution under attack,
     * which every participant can already read on the question page. */
    input: a.input,
    source: q.givenSource,
    language: q.givenLanguage,
    request: {
      job_id: a.jobId,
      state: a.state,
      attempt: null,
      retries: a.retries,
      cancelled: false,
      superseded_at: null,
      problem_version: null,
      created_at: a.createdAt.toISOString(),
      ended_at: a.endedAt?.toISOString() ?? null,
    },
    result: {
      valid_input: a.validInput,
      invalid_reason: a.invalidReason,
      hacked: a.hacked,
      verdict: a.verdict,
      points_awarded: a.pointsAwarded,
      outcome: hackOutcome(a),
    },
    stakes: { hack_points: q.hackPoints, fail_penalty: q.failPenalty },
  };
}

async function validatorDetail(ref: string) {
  const [participantId, questionId] = ref.split(":");
  const [row] = await db
    .select({ a: p1Answer, q: p1Question, name: user.name })
    .from(p1Answer)
    .innerJoin(p1Question, eq(p1Question.id, p1Answer.questionId))
    .innerJoin(user, eq(user.id, p1Answer.participantId))
    .where(and(eq(p1Answer.participantId, participantId), eq(p1Answer.questionId, Number(questionId))));
  if (!row) throw errors.notFound("job");
  const { a, q } = row;
  const entries = Array.isArray(a.answer) ? (a.answer as unknown[]).map(String) : a.answer == null ? [] : [String(a.answer)];

  return {
    kind: "validator" as const,
    who: { id: a.participantId, name: row.name ?? a.participantId },
    submitted_at: a.updatedAt.toISOString(),
    target: { title: q.title, problem_id: null },
    /* The validator itself is an answer key. It is not returned, even here —
     * this page is read over shoulders during a contest. */
    entries,
    language: "python",
    request: {
      job_id: a.scoreJobId,
      state: a.scoreState ?? "pending",
      attempt: null,
      retries: 0,
      cancelled: false,
      superseded_at: null,
      problem_version: null,
      created_at: a.updatedAt.toISOString(),
      /* One timestamp on the row, so there is no honest duration. */
      ended_at: null,
    },
    result: {
      score: a.autoScore,
      points_per_entry: q.pointsPerEntry,
      error: a.scoreError,
    },
  };
}

export const _sql = sql;
