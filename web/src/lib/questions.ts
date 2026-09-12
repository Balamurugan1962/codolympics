/**
 * A question as its owner sees it: statement, samples, hints, history, draft.
 * Ownership is checked here on every read; a question you do not own is not
 * hidden, it is unreachable (US-B4-01, US-F3-02).
 */
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { draft, ownership, question } from "@/db/schema";

import { errors } from "./api";
import { hintsFor } from "./hints";
import { judge } from "./judge";
import { samplesFor } from "./problems";
import { historyFor, submitStatus } from "./submissions";

export async function ownedQuestions(participantId: string) {
  const rows = await db
    .select({ q: question, own: ownership })
    .from(ownership)
    .innerJoin(question, eq(question.id, ownership.questionId))
    .where(and(eq(ownership.participantId, participantId), isNull(ownership.voidedAt)));
  return rows.map(({ q, own }) => ({
    id: q.id, title: q.title, difficulty: q.difficulty, score: q.score, status: q.status,
    price_paid: own.pricePaid, awarded_at: own.awardedAt.toISOString(),
  }));
}

export async function questionForOwner(participantId: string, questionId: string) {
  const [own] = await db
    .select()
    .from(ownership)
    .where(and(eq(ownership.questionId, questionId), eq(ownership.participantId, participantId), isNull(ownership.voidedAt)));
  if (!own) throw errors.forbidden("you do not own this question");
  const [q] = await db.select().from(question).where(eq(question.id, questionId));
  if (!q) throw errors.notFound("question");

  const info = await judge.problem(q.id).catch(() => null);
  const [d] = await db.select().from(draft).where(and(eq(draft.participantId, participantId), eq(draft.questionId, questionId)));

  return {
    id: q.id,
    title: q.title,
    difficulty: q.difficulty,
    score: q.score,
    status: q.status,
    statement_md: q.statementMd,
    time_limit_ms: info?.time_limit_ms ?? null,
    memory_limit_mb: info?.memory_limit_mb ?? null,
    hidden_testcases: info ? Math.max(0, info.testcases - q.sampleCount) : null, // count only, never content (US-F4-03)
    sample_count: q.sampleCount,
    samples: await samplesFor(q.id, q.sampleCount, q.problemVersion),
    hints: await hintsFor(participantId, questionId),
    history: await historyFor(participantId, questionId),
    draft: d ? { source: d.source, language: d.language, updated_at: d.updatedAt.toISOString() } : null,
    submit: await submitStatus(participantId),
    awarded_at: own.awardedAt.toISOString(),
  };
}

export async function saveDraft(participantId: string, questionId: string, input: { source: string; language: string }): Promise<void> {
  if (Buffer.byteLength(input.source, "utf8") > 262_144) throw errors.invalid("draft is larger than 256 KB");
  await db
    .insert(draft)
    .values({ participantId, questionId, source: input.source, language: input.language, updatedAt: new Date() })
    .onConflictDoUpdate({ target: [draft.participantId, draft.questionId], set: { source: input.source, language: input.language, updatedAt: new Date() } });
}
