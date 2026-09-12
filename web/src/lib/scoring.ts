/**
 * Standings -- computed, never stored (LLD §7).
 *
 *   score       = sum of question.score over questions the owner has a current AC on
 *   solve_time  = earliest AC submission time - awarded_at   ("first AC only counts")
 *   rank        = score DESC, total_time ASC, phase1_rank ASC
 *
 * A rejudge changes verdicts, and standings follow with nothing to recompute.
 * For 20 participants this is a few small queries and a sort.
 */
import { and, eq, isNull, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { judgement, ownership, participant, question, submission } from "@/db/schema";

import { getContest } from "./contest";
import { phase1Standings } from "./phase1-review";

export type Standing = {
  participant_id: string;
  name: string;
  score: number;
  solved: number;
  total_time_ms: number;
  phase1_rank: number | null;
  rank: number;
};

export async function phase2Standings(opts: { frozenAt?: Date | null } = {}): Promise<Standing[]> {
  const people = await db
    .select({ id: participant.userId, name: user.name, disqualifiedAt: participant.disqualifiedAt })
    .from(participant)
    .innerJoin(user, eq(user.id, participant.userId));

  // Every current AC, with its submission time and the question's score and award time.
  const acs = await db
    .select({
      participantId: submission.participantId,
      questionId: submission.questionId,
      createdAt: submission.createdAt,
      score: question.score,
      awardedAt: ownership.awardedAt,
    })
    .from(judgement)
    .innerJoin(submission, eq(submission.id, judgement.submissionId))
    .innerJoin(question, eq(question.id, submission.questionId))
    .innerJoin(ownership, and(eq(ownership.questionId, submission.questionId), eq(ownership.participantId, submission.participantId)))
    .where(
      and(
        eq(judgement.verdict, "AC"),
        isNull(judgement.supersededAt),
        isNull(ownership.voidedAt),
        sql`${question.status} <> 'void'`,
        opts.frozenAt ? lt(submission.createdAt, opts.frozenAt) : undefined,
      ),
    );

  // First AC per (participant, question): MIN over submission time.
  const first = new Map<string, { score: number; solveMs: number }>();
  for (const a of acs) {
    const key = `${a.participantId}|${a.questionId}`;
    const solveMs = a.createdAt.getTime() - a.awardedAt.getTime();
    const prev = first.get(key);
    if (!prev || solveMs < prev.solveMs) first.set(key, { score: a.score, solveMs });
  }

  const p1 = await phase1Standings();
  const p1Rank = new Map(p1.map((s) => [s.participant_id, s.rank]));

  const rows: Standing[] = people
    .filter((p) => !p.disqualifiedAt)
    .map((p) => {
      let score = 0, solved = 0, total = 0;
      for (const [key, v] of first) {
        if (!key.startsWith(`${p.id}|`)) continue;
        score += v.score; solved += 1; total += v.solveMs;
      }
      return { participant_id: p.id, name: p.name, score, solved, total_time_ms: total, phase1_rank: p1Rank.get(p.id) ?? null, rank: 0 };
    });

  rows.sort((a, b) =>
    b.score - a.score ||
    a.total_time_ms - b.total_time_ms ||
    (a.phase1_rank ?? Infinity) - (b.phase1_rank ?? Infinity) ||
    a.name.localeCompare(b.name));

  // Shared rank only when everything is equal, including Phase 1 rank (US-B7-02).
  let rank = 0;
  rows.forEach((r, i) => {
    const prev = rows[i - 1];
    const tied = prev && prev.score === r.score && prev.total_time_ms === r.total_time_ms && prev.phase1_rank === r.phase1_rank;
    r.rank = tied ? prev.rank : (rank = i + 1);
  });
  return rows;
}

/** The leaderboard as participants may see it, honouring the administrator's setting. */
export async function leaderboardForParticipants() {
  const c = await getContest();
  if (c.leaderboardMode === "hidden") return { mode: "hidden" as const, standings: [] as Standing[], frozen_at: null };
  const frozenAt = c.leaderboardMode === "frozen" ? c.leaderboardFrozenAt : null;
  return { mode: c.leaderboardMode, standings: await phase2Standings({ frozenAt }), frozen_at: frozenAt?.toISOString() ?? null };
}
