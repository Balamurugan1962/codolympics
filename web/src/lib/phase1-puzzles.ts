/**
 * Phase 1, Section A: logical puzzles (requirements-phase1.md, Epics P2, P4, P5).
 *
 * Answers are autosaved and revisable until the section closes. Scoring:
 *   auto      -> matched against the answer key, here, on save
 *   validator -> sent to the judge when the section closes (never live, so
 *                "find as many as you can" cannot be brute-forced)
 *   manual    -> an evaluator reads it
 */
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { p1Answer, p1Question, participant, type P1AnswerKey, type P1Config } from "@/db/schema";

import { errors } from "./api";
import { getContest } from "./contest";
import { publish } from "./events";
import { judge, JudgeError, type AnswersResult } from "./judge";

export type Q = typeof p1Question.$inferSelect;

// ---------------------------------------------------------------------------
// What a participant may see
// ---------------------------------------------------------------------------

/** A question with every secret stripped: no answer key, validator or model answer (NFR-P-03). */
export function participantQuestion(q: Q) {
  return {
    id: q.id,
    title: q.title,
    body_md: q.bodyMd,
    category: q.category,
    kind: q.kind,
    grading: q.grading,
    points: q.points,
    explain_points: q.explainPoints,
    order_index: q.orderIndex,
    config: q.config,
    max_entries: q.maxEntries,
    format_regex: q.formatRegex,
    format_hint: q.formatHint,
  };
}

export async function publishedQuestions(): Promise<Q[]> {
  return db.select().from(p1Question).where(and(eq(p1Question.published, true), eq(p1Question.voided, false))).orderBy(p1Question.orderIndex, p1Question.id);
}

// ---------------------------------------------------------------------------
// Answering
// ---------------------------------------------------------------------------

async function assertSectionOpen(participantId: string): Promise<void> {
  const c = await getContest();
  if (c.phase !== "p1_puzzles") throw errors.conflict("section_closed", "Section A is not open");
  if (c.phaseEndsAt && c.phaseEndsAt.getTime() <= Date.now()) throw errors.conflict("section_closed", "Section A has closed");
  const [p] = await db.select().from(participant).where(eq(participant.userId, participantId));
  if (!p) throw errors.forbidden("not a participant");
  if (p.disqualifiedAt) throw errors.forbidden("your account is disqualified");
  if (p.p1PuzzlesFinishedAt) throw errors.conflict("finished", "you have finished this section");
}

/** Save (or change) an answer. Auto-graded kinds are scored immediately; the score is not shown until the section closes. */
export async function saveAnswer(participantId: string, questionId: number, input: { answer?: unknown; explanation?: string }): Promise<void> {
  await assertSectionOpen(participantId);
  const [q] = await db.select().from(p1Question).where(and(eq(p1Question.id, questionId), eq(p1Question.published, true)));
  if (!q) throw errors.notFound("question");

  const answer = input.answer === undefined ? undefined : normaliseAnswer(q, input.answer);
  const autoScore = answer !== undefined && q.grading === "auto" ? scoreAuto(q, answer) : undefined;

  await db
    .insert(p1Answer)
    .values({ participantId, questionId, answer: answer ?? null, explanation: input.explanation ?? null, autoScore: autoScore ?? null, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [p1Answer.participantId, p1Answer.questionId],
      set: {
        ...(answer !== undefined ? { answer, autoScore: autoScore ?? null } : {}),
        ...(input.explanation !== undefined ? { explanation: input.explanation } : {}),
        updatedAt: new Date(),
      },
    });
}

/** The explicit "finish" action: records submission time for the tiebreak (US-P4-02). */
export async function finishSection(participantId: string, section: "puzzles" | "hacking"): Promise<void> {
  const c = await getContest();
  const expected = section === "puzzles" ? "p1_puzzles" : "p1_hacking";
  if (c.phase !== expected) throw errors.conflict("section_closed", "that section is not open");
  await db
    .update(participant)
    .set(section === "puzzles" ? { p1PuzzlesFinishedAt: new Date() } : { p1HackingFinishedAt: new Date() })
    .where(eq(participant.userId, participantId));
}

/** Enforce the shape the client should already have checked (a manipulated client must not get past it). */
export function normaliseAnswer(q: Q, raw: unknown): unknown {
  const cfg = (q.config ?? {}) as P1Config;
  const asStrings = (v: unknown, cap: number) => {
    if (!Array.isArray(v)) throw errors.invalid("answer must be a list");
    return v.slice(0, cap).map((x) => String(x).trim()).filter(Boolean);
  };
  const checkFormat = (s: string) => {
    if (q.formatRegex && !new RegExp(q.formatRegex).test(s)) {
      throw errors.invalid(q.formatHint ? `expected: ${q.formatHint}` : "answer has the wrong format");
    }
    return s;
  };
  switch (q.kind) {
    case "mcq_single": {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0 || n >= (cfg.options?.length ?? 0)) throw errors.invalid("pick one option");
      return n;
    }
    case "mcq_multi": {
      if (!Array.isArray(raw)) throw errors.invalid("pick options");
      const opts = cfg.options?.length ?? 0;
      return [...new Set(raw.map(Number))].filter((n) => Number.isInteger(n) && n >= 0 && n < opts).sort((a, b) => a - b);
    }
    case "fill_blank":
      return checkFormat(String(raw).trim().slice(0, 500));
    case "numeric": {
      const s = String(raw).trim();
      if (s === "" || Number.isNaN(Number(s))) throw errors.invalid("enter a number");
      return checkFormat(s);
    }
    case "sequence": {
      if (!Array.isArray(raw)) throw errors.invalid("order the items");
      const n = cfg.items?.length ?? 0;
      const order = raw.map(Number);
      if (order.length !== n || new Set(order).size !== n || order.some((i) => !Number.isInteger(i) || i < 0 || i >= n)) throw errors.invalid("every item must appear exactly once");
      return order;
    }
    case "set":
      return asStrings(raw, q.maxEntries).map(checkFormat);
    case "long_text":
      return String(raw).slice(0, 20_000);
  }
}

// ---------------------------------------------------------------------------
// Auto scoring
// ---------------------------------------------------------------------------

const norm = (s: string, caseSensitive?: boolean) => {
  const t = s.trim().replace(/\s+/g, " ");
  return caseSensitive ? t : t.toLowerCase();
};

/** Score an `auto` answer against the key. Pure, so it is unit-testable. */
export function scoreAuto(q: Q, answer: unknown): number {
  const key = (q.answerKey ?? {}) as P1AnswerKey;
  const cfg = (q.config ?? {}) as P1Config;
  switch (q.kind) {
    case "mcq_single":
      return answer === key.option ? q.points : 0;
    case "mcq_multi": {
      const want = new Set(key.options ?? []);
      const got = new Set(answer as number[]);
      if (!cfg.partialCredit) return setsEqual(want, got) ? q.points : 0;
      // Per-option credit: each correct selection earns its share; a wrong selection cancels one.
      const correct = [...got].filter((o) => want.has(o)).length;
      const wrong = got.size - correct;
      return want.size ? Math.max(0, Math.round((q.points * (correct - wrong)) / want.size)) : 0;
    }
    case "fill_blank": {
      const got = norm(String(answer), cfg.caseSensitive);
      return (key.accepted ?? []).some((a) => norm(a, cfg.caseSensitive) === got) ? q.points : 0;
    }
    case "numeric": {
      const got = Number(answer);
      const want = key.value;
      if (want === undefined || Number.isNaN(got)) return 0;
      const tol = cfg.tolerance ?? 0;
      return Math.abs(got - want) <= tol ? q.points : 0;
    }
    case "sequence":
      return JSON.stringify(answer) === JSON.stringify(key.order ?? []) ? q.points : 0;
    case "set": {
      const want = new Set((key.members ?? []).map((m) => norm(m, cfg.caseSensitive)));
      const got = new Set((answer as string[]).map((m) => norm(m, cfg.caseSensitive)));
      if (!cfg.partialCredit) return setsEqual(want, got) ? q.points : 0;
      const correct = [...got].filter((m) => want.has(m)).length;
      const wrong = got.size - correct;
      return want.size ? Math.max(0, Math.round((q.points * (correct - wrong)) / want.size)) : 0;
    }
    case "long_text":
      return 0; // never auto-scored
  }
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

// ---------------------------------------------------------------------------
// Validator scoring, at section close
// ---------------------------------------------------------------------------

/** Queue a judge job for every (participant, validator question) pair. The scheduler collects results. */
export async function scoreValidatorQuestions(): Promise<void> {
  const qs = await db.select().from(p1Question).where(and(eq(p1Question.grading, "validator"), eq(p1Question.published, true)));
  for (const q of qs) {
    const answers = await db.select().from(p1Answer).where(eq(p1Answer.questionId, q.id));
    for (const a of answers) {
      if (a.scoreState === "done") continue;
      await db
        .update(p1Answer)
        .set({ scoreState: "pending", scoreJobId: null })
        .where(and(eq(p1Answer.participantId, a.participantId), eq(p1Answer.questionId, q.id)));
    }
  }
  await sendPendingValidatorJobs();
}

/** Distinct entries after normalising whitespace and (unless case-sensitive) case. */
export function distinctEntries(q: Q, answer: unknown): string[] {
  const cfg = (q.config ?? {}) as P1Config;
  const raw: string[] = Array.isArray(answer) ? answer.map(String) : String(answer ?? "").split("\n");
  const seen = new Map<string, string>();
  for (const e of raw) {
    const t = e.trim();
    if (!t) continue;
    const k = norm(t, cfg.caseSensitive);
    if (!seen.has(k)) seen.set(k, t);
  }
  return [...seen.values()].slice(0, q.maxEntries);
}

export async function sendPendingValidatorJobs(): Promise<void> {
  const rows = await db
    .select({ a: p1Answer, q: p1Question })
    .from(p1Answer)
    .innerJoin(p1Question, eq(p1Question.id, p1Answer.questionId))
    .where(eq(p1Answer.scoreState, "pending"))
    .limit(20);
  for (const { a, q } of rows) {
    const entries = distinctEntries(q, a.answer);
    if (!q.validatorPy || entries.length === 0) {
      await db.update(p1Answer).set({ scoreState: "done", autoScore: 0 }).where(and(eq(p1Answer.participantId, a.participantId), eq(p1Answer.questionId, q.id)));
      continue;
    }
    try {
      const { job_id } = await judge.validateAnswers({ validator: q.validatorPy, entries, submission_id: `p1_${a.participantId}_${q.id}`.slice(0, 64) });
      await db.update(p1Answer).set({ scoreState: "queued", scoreJobId: job_id }).where(and(eq(p1Answer.participantId, a.participantId), eq(p1Answer.questionId, q.id)));
    } catch {
      // Judge unreachable: stay pending, retry next tick.
    }
  }
}

export async function pollValidatorJobs(): Promise<void> {
  const rows = await db
    .select({ a: p1Answer, q: p1Question })
    .from(p1Answer)
    .innerJoin(p1Question, eq(p1Question.id, p1Answer.questionId))
    .where(eq(p1Answer.scoreState, "queued"));
  for (const { a, q } of rows) {
    if (!a.scoreJobId) continue;
    try {
      const job = await judge.job<AnswersResult>(a.scoreJobId);
      if (job.state !== "done" || !job.result) continue;
      const where = and(eq(p1Answer.participantId, a.participantId), eq(p1Answer.questionId, q.id));
      if (job.result.status === "IE") {
        // Nothing was checked. Flag it; never write a zero (US-P2-05).
        await db.update(p1Answer).set({ scoreState: "error", scoreError: job.result.message }).where(where);
      } else {
        const valid = job.result.results.filter((r) => r.valid).length;
        await db.update(p1Answer).set({ scoreState: "done", autoScore: valid * (q.pointsPerEntry ?? 0), scoreError: null }).where(where);
      }
    } catch (err) {
      if (err instanceof JudgeError && err.judgeStatus === 404) {
        await db.update(p1Answer).set({ scoreState: "pending", scoreJobId: null }).where(and(eq(p1Answer.participantId, a.participantId), eq(p1Answer.questionId, q.id)));
      }
    }
  }
  if (rows.length) publish("leaderboard", {});
}

/** The scheduler's per-tick entry point. */
export async function tickPuzzles(): Promise<void> {
  await sendPendingValidatorJobs();
  await pollValidatorJobs();
}

export const _sql = sql;
