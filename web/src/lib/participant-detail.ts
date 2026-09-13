/**
 * Everything one participant did, in one place.
 *
 * Built for the question an organiser is actually asked — "what happened to
 * me?" — which spans both phases and every kind of artefact: puzzle answers,
 * hack attempts, questions won, code submitted, hints bought, money moved. The
 * participant's own screens each show a slice; this is the whole thing.
 *
 * Administrators and evaluators only. It deliberately carries what participants
 * must never see (answer keys, hack verdicts, jury detail), so it is never
 * reachable from a participant-facing route.
 */
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/auth-schema";
import {
  hint, hintPurchase, judgement, ledger, ownership, p1Advancement, p1Answer, p1HackAttempt, p1HackQuestion,
  p1Question, participant, question, submission,
} from "@/db/schema";

import { errors } from "./api";
import { phase1Standings } from "./phase1-review";
import { phase2Standings } from "./scoring";

export type PuzzleRow = {
  question_id: number;
  title: string;
  category: string;
  kind: string;
  grading: string;
  points_possible: number;
  explain_possible: number;
  answered: boolean;
  answer: unknown;
  explanation: string | null;
  auto_score: number | null;
  manual_score: number | null;
  explain_score: number | null;
  score_state: string | null;
  score_error: string | null;
  graded_at: string | null;
  grade_comment: string | null;
  updated_at: string | null;
  /** Null while an item is still with an evaluator, or a validator errored. */
  awarded: number | null;
};

export type HackRow = {
  question_id: number;
  title: string;
  points_possible: number;
  fail_penalty: number;
  attempts: {
    id: number;
    input: string;
    state: string;
    valid_input: boolean | null;
    invalid_reason: string | null;
    hacked: boolean | null;
    verdict: string | null;
    points_awarded: number;
    created_at: string;
  }[];
  awarded: number;
};

export type OwnedRow = {
  question_id: string;
  title: string;
  difficulty: string;
  score: number;
  price_paid: number;
  awarded_at: string;
  voided_at: string | null;
  status: string;
  solved_at: string | null;
  solve_ms: number | null;
  attempts: number;
  hints_bought: { idx: number; price_paid: number; purchased_at: string; body_md: string }[];
  submissions: {
    id: number;
    language: string;
    created_at: string;
    state: string;
    verdict: string | null;
    passed: number | null;
    total: number | null;
    first_fail: number | null;
    max_time_ms: number | null;
    message: string | null;
    jury_detail: string | null;
    attempt: number;
  }[];
};

export type Dossier = Awaited<ReturnType<typeof participantDossier>>;

export async function participantDossier(participantId: string) {
  const [who] = await db
    .select({
      id: participant.userId,
      name: user.name,
      username: user.username,
      balance: participant.balance,
      language: participant.preferredLanguage,
      disqualifiedAt: participant.disqualifiedAt,
      disqualifiedReason: participant.disqualifiedReason,
      puzzlesFinishedAt: participant.p1PuzzlesFinishedAt,
      hackingFinishedAt: participant.p1HackingFinishedAt,
      createdAt: user.createdAt,
    })
    .from(participant)
    .innerJoin(user, eq(user.id, participant.userId))
    .where(eq(participant.userId, participantId));
  if (!who) throw errors.notFound("participant");

  const [p1All, p2All, adv] = await Promise.all([
    phase1Standings(),
    phase2Standings(),
    db.select().from(p1Advancement).where(eq(p1Advancement.participantId, participantId)),
  ]);
  const p1Standing = p1All.find((s) => s.participant_id === participantId) ?? null;
  const p2Standing = p2All.find((s) => s.participant_id === participantId) ?? null;

  return {
    participant: {
      id: who.id,
      name: who.name,
      username: who.username,
      balance: who.balance,
      preferred_language: who.language,
      disqualified: Boolean(who.disqualifiedAt),
      disqualified_reason: who.disqualifiedReason,
      registered_at: who.createdAt.toISOString(),
      p1_puzzles_finished_at: who.puzzlesFinishedAt?.toISOString() ?? null,
      p1_hacking_finished_at: who.hackingFinishedAt?.toISOString() ?? null,
      advanced: adv[0]?.advanced ?? null,
      advancement_reason: adv[0]?.reason ?? null,
    },
    phase1: {
      standing: p1Standing,
      of: p1All.filter((s) => !s.disqualified).length,
      puzzles: await puzzleRows(participantId),
      hacks: await hackRows(participantId),
    },
    phase2: {
      standing: p2Standing,
      of: p2All.length,
      owned: await ownedRows(participantId),
      ledger: await ledgerRows(participantId),
    },
  };
}

/** Every published puzzle, answered or not — a blank is a fact worth seeing. */
async function puzzleRows(participantId: string): Promise<PuzzleRow[]> {
  const rows = await db
    .select({ q: p1Question, a: p1Answer })
    .from(p1Question)
    .leftJoin(p1Answer, and(eq(p1Answer.questionId, p1Question.id), eq(p1Answer.participantId, participantId)))
    .where(eq(p1Question.published, true))
    .orderBy(asc(p1Question.orderIndex), asc(p1Question.id));

  return rows.map(({ q, a }) => {
    const ungradedManual = q.grading === "manual" && a?.manualScore == null;
    const ungradedExplain = q.explainPoints > 0 && a?.explainScore == null;
    const validatorErr = q.grading === "validator" && a?.scoreState === "error";
    const pending = Boolean(a) && (ungradedManual || ungradedExplain || validatorErr);
    return {
      question_id: q.id,
      title: q.title,
      category: q.category,
      kind: q.kind,
      grading: q.grading,
      points_possible: q.points,
      explain_possible: q.explainPoints,
      answered: Boolean(a),
      answer: a?.answer ?? null,
      explanation: a?.explanation ?? null,
      auto_score: a?.autoScore ?? null,
      manual_score: a?.manualScore ?? null,
      explain_score: a?.explainScore ?? null,
      score_state: a?.scoreState ?? null,
      score_error: a?.scoreError ?? null,
      graded_at: a?.gradedAt?.toISOString() ?? null,
      grade_comment: a?.gradeComment ?? null,
      updated_at: a?.updatedAt?.toISOString() ?? null,
      awarded: !a ? 0 : pending ? null : (a.autoScore ?? 0) + (a.manualScore ?? 0) + (a.explainScore ?? 0),
    };
  });
}

/** Every published hacking question with this participant's attempts, oldest first. */
async function hackRows(participantId: string): Promise<HackRow[]> {
  const questions = await db
    .select()
    .from(p1HackQuestion)
    .where(eq(p1HackQuestion.published, true))
    .orderBy(asc(p1HackQuestion.orderIndex), asc(p1HackQuestion.id));
  if (questions.length === 0) return [];

  const attempts = await db
    .select()
    .from(p1HackAttempt)
    .where(and(eq(p1HackAttempt.participantId, participantId), inArray(p1HackAttempt.questionId, questions.map((q) => q.id))))
    .orderBy(asc(p1HackAttempt.createdAt));

  return questions.map((q) => {
    const mine = attempts.filter((a) => a.questionId === q.id);
    return {
      question_id: q.id,
      title: q.title,
      points_possible: q.hackPoints,
      fail_penalty: q.failPenalty,
      attempts: mine.map((a) => ({
        id: a.id,
        input: a.input,
        state: a.state,
        valid_input: a.validInput,
        invalid_reason: a.invalidReason,
        hacked: a.hacked,
        verdict: a.verdict,
        points_awarded: a.pointsAwarded,
        created_at: a.createdAt.toISOString(),
      })),
      awarded: mine.reduce((s, a) => s + (a.state === "done" ? a.pointsAwarded : 0), 0),
    };
  });
}

/** Questions won at auction, with every submission and hint against each. */
async function ownedRows(participantId: string): Promise<OwnedRow[]> {
  const owned = await db
    .select({ o: ownership, q: question })
    .from(ownership)
    .innerJoin(question, eq(question.id, ownership.questionId))
    .where(eq(ownership.participantId, participantId))
    .orderBy(asc(ownership.awardedAt));
  if (owned.length === 0) return [];

  const ids = owned.map((o) => o.o.questionId);

  const subs = await db
    .select({ s: submission, j: judgement })
    .from(submission)
    .leftJoin(judgement, and(eq(judgement.submissionId, submission.id), isNull(judgement.supersededAt)))
    .where(and(eq(submission.participantId, participantId), inArray(submission.questionId, ids)))
    .orderBy(desc(submission.createdAt));

  const hints = await db
    .select({ p: hintPurchase, body: hint.bodyMd })
    .from(hintPurchase)
    .leftJoin(hint, and(eq(hint.questionId, hintPurchase.questionId), eq(hint.idx, hintPurchase.hintIdx)))
    .where(and(eq(hintPurchase.participantId, participantId), inArray(hintPurchase.questionId, ids)))
    .orderBy(asc(hintPurchase.hintIdx));

  return owned.map(({ o, q }) => {
    const mine = subs.filter((s) => s.s.questionId === o.questionId);
    // The earliest accepted submission is the solve; later ones do not improve it.
    const accepted = mine.filter((s) => s.j?.verdict === "AC").sort((a, b) => a.s.createdAt.getTime() - b.s.createdAt.getTime())[0];
    return {
      question_id: o.questionId,
      title: q.title,
      difficulty: q.difficulty,
      score: q.score,
      price_paid: o.pricePaid,
      awarded_at: o.awardedAt.toISOString(),
      voided_at: o.voidedAt?.toISOString() ?? null,
      status: q.status,
      solved_at: accepted?.s.createdAt.toISOString() ?? null,
      solve_ms: accepted ? accepted.s.createdAt.getTime() - o.awardedAt.getTime() : null,
      attempts: mine.length,
      hints_bought: hints
        .filter((h) => h.p.questionId === o.questionId)
        .map((h) => ({ idx: h.p.hintIdx, price_paid: h.p.pricePaid, purchased_at: h.p.purchasedAt.toISOString(), body_md: h.body ?? "" })),
      submissions: mine.map(({ s, j }) => ({
        id: s.id,
        language: s.language,
        created_at: s.createdAt.toISOString(),
        state: j?.state ?? "pending",
        verdict: j?.verdict ?? null,
        passed: j?.passed ?? null,
        total: j?.total ?? null,
        first_fail: j?.firstFail ?? null,
        max_time_ms: j?.maxTimeMs ?? null,
        message: j?.message ?? null,
        jury_detail: j?.juryDetail ?? null,
        attempt: j?.attempt ?? 1,
      })),
    };
  });
}

/** Every coin in and out, newest first — the answer to "where did my money go?". */
async function ledgerRows(participantId: string) {
  const rows = await db
    .select()
    .from(ledger)
    .where(eq(ledger.participantId, participantId))
    .orderBy(desc(ledger.id));
  return rows.map((l) => ({
    id: l.id,
    delta: l.delta,
    balance_after: l.balanceAfter,
    reason: l.reason,
    ref: l.ref,
    created_at: l.createdAt.toISOString(),
  }));
}
