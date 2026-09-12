/**
 * Authoring Phase 1 questions (requirements-phase1.md, Epics P2 and P3):
 * create, edit, prove ready, publish, void, override scores.
 */
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { p1Answer, p1HackQuestion, p1Question, participant, type P1AnswerKey, type P1Config } from "@/db/schema";

import { errors } from "./api";
import { audit } from "./audit";
import { publish } from "./events";
import { judge, type AnswersResult, type HackResult } from "./judge";
import { normaliseAnswer, scoreAuto, type Q } from "./phase1-puzzles";

// ---------------------------------------------------------------------------
// Section A
// ---------------------------------------------------------------------------

export type PuzzleInput = {
  title: string; bodyMd: string; category: Q["category"]; kind: Q["kind"]; grading: Q["grading"];
  points: number; explainPoints: number; orderIndex: number; config: P1Config; answerKey?: P1AnswerKey | null;
  modelAnswer?: string | null; validatorPy?: string | null; pointsPerEntry?: number | null; maxEntries: number;
  formatRegex?: string | null; formatHint?: string | null;
};

function checkPuzzle(input: PuzzleInput): void {
  if (input.grading === "auto" && !input.answerKey) throw errors.invalid("auto grading needs an answer key");
  if (input.grading === "validator" && !input.validatorPy) throw errors.invalid("validator grading needs validator code");
  if (input.grading === "validator" && !input.pointsPerEntry) throw errors.invalid("validator grading needs points per entry");
  if (input.formatRegex) {
    try { new RegExp(input.formatRegex); } catch { throw errors.invalid("format regex does not compile"); }
  }
}

export async function createPuzzle(actorId: string, input: PuzzleInput, reason: string): Promise<number> {
  checkPuzzle(input);
  const [row] = await db.insert(p1Question).values({ ...input, published: false, ready: false }).returning({ id: p1Question.id });
  await audit({ actorId, action: "p1.puzzle.create", target: String(row.id), reason, detail: { title: input.title } });
  return row.id;
}

export async function updatePuzzle(actorId: string, id: number, input: Partial<PuzzleInput>, reason: string): Promise<void> {
  const [q] = await db.select().from(p1Question).where(eq(p1Question.id, id));
  if (!q) throw errors.notFound("question");
  const merged = { ...q, ...input } as PuzzleInput;
  checkPuzzle(merged);
  // Any change invalidates readiness; the self-test must be run again.
  await db.transaction(async (tx) => {
    await tx.update(p1Question).set({ ...input, ready: false }).where(eq(p1Question.id, id));
    await audit({ actorId, action: "p1.puzzle.update", target: String(id), reason, detail: Object.keys(input) }, tx);
  });
}

export async function deletePuzzle(actorId: string, id: number, reason: string): Promise<void> {
  const [q] = await db.select().from(p1Question).where(eq(p1Question.id, id));
  if (!q) throw errors.notFound("question");
  if (q.published) throw errors.conflict("published", "unpublish or void a published question instead of deleting it");
  await db.transaction(async (tx) => {
    await tx.delete(p1Question).where(eq(p1Question.id, id));
    await audit({ actorId, action: "p1.puzzle.delete", target: String(id), reason }, tx);
  });
}

/**
 * Prove the question works (US-P2-04). Auto: the intended answer must score
 * full marks. Validator: should-pass entries pass and should-fail entries
 * fail. Manual: nothing to check automatically; a model answer is required.
 */
export async function testPuzzle(
  id: number,
  trial: { answer?: unknown; shouldPass?: string[]; shouldFail?: string[] },
): Promise<{ ready: boolean; detail: string; score?: number }> {
  const [q] = await db.select().from(p1Question).where(eq(p1Question.id, id));
  if (!q) throw errors.notFound("question");
  let ready = false;
  let detail = "";
  let score: number | undefined;

  if (q.grading === "auto") {
    if (trial.answer === undefined) throw errors.invalid("supply the intended answer");
    score = scoreAuto(q, normaliseAnswer(q, trial.answer));
    ready = score === q.points;
    detail = ready ? `intended answer scores ${score}/${q.points}` : `intended answer scores only ${score}/${q.points} — check the answer key`;
  } else if (q.grading === "validator") {
    const pass = trial.shouldPass ?? [];
    const fail = trial.shouldFail ?? [];
    if (pass.length === 0) throw errors.invalid("supply at least one entry that should pass");
    const result = await waitForJob<AnswersResult>(await judge.validateAnswers({ validator: q.validatorPy!, entries: [...pass, ...fail], submission_id: `p1test_${id}` }));
    if (result.status === "IE") { ready = false; detail = `validator failed to run: ${result.message}`; }
    else {
      const got = result.results.map((r) => r.valid);
      const passOk = got.slice(0, pass.length).every(Boolean);
      const failOk = got.slice(pass.length).every((v) => !v);
      ready = passOk && failOk;
      detail = ready ? "validator accepts what it should and rejects what it should" :
        `validator ${passOk ? "" : "rejected a should-pass entry"}${!passOk && !failOk ? " and " : ""}${failOk ? "" : "accepted a should-fail entry"}`;
    }
  } else {
    ready = Boolean(q.modelAnswer && q.modelAnswer.trim());
    detail = ready ? "manual grading; a model answer is recorded" : "record a model answer before publishing";
  }

  await db.update(p1Question).set({ ready }).where(eq(p1Question.id, id));
  return { ready, detail, score };
}

export async function publishPuzzle(actorId: string, id: number, published: boolean, reason: string): Promise<void> {
  const [q] = await db.select().from(p1Question).where(eq(p1Question.id, id));
  if (!q) throw errors.notFound("question");
  if (published && !q.ready) throw errors.conflict("not_ready", "run the self-test first; the question is not marked ready");
  await db.transaction(async (tx) => {
    await tx.update(p1Question).set({ published }).where(eq(p1Question.id, id));
    await audit({ actorId, action: published ? "p1.puzzle.publish" : "p1.puzzle.unpublish", target: String(id), reason }, tx);
  });
}

export async function voidPuzzle(actorId: string, id: number, reason: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(p1Question).set({ voided: true }).where(eq(p1Question.id, id));
    await audit({ actorId, action: "p1.puzzle.void", target: String(id), reason }, tx);
  });
  publish("leaderboard", {});
}

/** Override one participant's score on one question (US-P6-04). */
export async function overrideScore(actorId: string, input: { participantId: string; questionId: number; autoScore?: number; manualScore?: number; explainScore?: number; reason: string }): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(p1Answer)
      .set({
        ...(input.autoScore !== undefined ? { autoScore: input.autoScore, scoreState: "done" as const, scoreError: null } : {}),
        ...(input.manualScore !== undefined ? { manualScore: input.manualScore } : {}),
        ...(input.explainScore !== undefined ? { explainScore: input.explainScore } : {}),
        gradedBy: actorId, gradedAt: new Date(),
      })
      .where(and(eq(p1Answer.participantId, input.participantId), eq(p1Answer.questionId, input.questionId)));
    await audit({ actorId, action: "p1.score.override", target: `${input.participantId}/${input.questionId}`, reason: input.reason, detail: input }, tx);
  });
  publish("leaderboard", {});
}

// ---------------------------------------------------------------------------
// Section B
// ---------------------------------------------------------------------------

export type HackInput = {
  title: string; statementMd: string; constraintsMd: string; problemId: string;
  givenSource: string; givenLanguage: string; hackPoints: number; failPenalty: number; orderIndex: number;
};

export async function createHack(actorId: string, input: HackInput, reason: string): Promise<number> {
  const [row] = await db.insert(p1HackQuestion).values({ ...input, published: false, ready: false }).returning({ id: p1HackQuestion.id });
  await audit({ actorId, action: "p1.hack.create", target: String(row.id), reason, detail: { title: input.title } });
  return row.id;
}

export async function updateHack(actorId: string, id: number, input: Partial<HackInput>, reason: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(p1HackQuestion).set({ ...input, ready: false }).where(eq(p1HackQuestion.id, id));
    await audit({ actorId, action: "p1.hack.update", target: String(id), reason, detail: Object.keys(input) }, tx);
  });
}

/** Prove the solution is breakable (US-P3-02): the known breaking input must be valid and must break it. */
export async function testHack(id: number, breakingInput: string): Promise<{ ready: boolean; detail: string; result: HackResult }> {
  const [q] = await db.select().from(p1HackQuestion).where(eq(p1HackQuestion.id, id));
  if (!q) throw errors.notFound("question");
  const result = await waitForJob<HackResult>(
    await judge.hack({ problem_id: q.problemId, language: q.givenLanguage, source: q.givenSource, input: breakingInput, submission_id: `p1hacktest_${id}` }),
  );
  let detail: string;
  let ready = false;
  if (!result.valid_input) detail = `your breaking input is itself invalid: ${result.invalid_reason}`;
  else if (result.verdict === "IE") detail = `the problem is broken: ${result.message}`;
  else if (result.hacked) { ready = true; detail = `the given solution fails on it (${result.verdict}); the reference handles it`; }
  else detail = "the given solution handles this input correctly — it does not break it";
  await db.update(p1HackQuestion).set({ ready }).where(eq(p1HackQuestion.id, id));
  return { ready, detail, result };
}

export async function publishHack(actorId: string, id: number, published: boolean, reason: string): Promise<void> {
  const [q] = await db.select().from(p1HackQuestion).where(eq(p1HackQuestion.id, id));
  if (!q) throw errors.notFound("question");
  if (published && !q.ready) throw errors.conflict("not_ready", "prove a breaking input first; the question is not marked ready");
  await db.transaction(async (tx) => {
    await tx.update(p1HackQuestion).set({ published }).where(eq(p1HackQuestion.id, id));
    await audit({ actorId, action: published ? "p1.hack.publish" : "p1.hack.unpublish", target: String(id), reason }, tx);
  });
}

export async function voidHack(actorId: string, id: number, reason: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(p1HackQuestion).set({ voided: true }).where(eq(p1HackQuestion.id, id));
    await audit({ actorId, action: "p1.hack.void", target: String(id), reason }, tx);
  });
  publish("leaderboard", {});
}

// ---------------------------------------------------------------------------

/** Wait for a judge job to finish -- for authoring-time checks only, never in a participant request. */
async function waitForJob<R>({ job_id }: { job_id: string }, timeoutMs = 60_000): Promise<R> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = await judge.job<R>(job_id);
    if (job.state === "done" && job.result) return job.result;
    await new Promise((r) => setTimeout(r, job.poll_after_ms ?? 500));
  }
  throw errors.conflict("judge_timeout", "the judge did not finish in time");
}

export { participant };
