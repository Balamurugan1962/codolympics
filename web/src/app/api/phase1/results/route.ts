import { eq } from "drizzle-orm";

import { db } from "@/db";
import { p1Answer, p1HackAttempt, p1Question } from "@/db/schema";
import { errors, json, route } from "@/lib/api";
import { getContest } from "@/lib/contest";
import { phase1Standings } from "@/lib/phase1-review";
import { requireApiViewer } from "@/lib/session";

/** My own Phase 1 breakdown, once a section has closed (US-P5-03). Never the answer key. */
export const GET = route(async () => {
  const viewer = await requireApiViewer("participant");
  const c = await getContest();
  if (["registration", "p1_puzzles"].includes(c.phase)) throw errors.conflict("not_yet", "results are available once Section A closes");
  const rows = await db
    .select({ a: p1Answer, q: p1Question })
    .from(p1Answer)
    .innerJoin(p1Question, eq(p1Question.id, p1Answer.questionId))
    .where(eq(p1Answer.participantId, viewer.id));
  const hacks = await db.select().from(p1HackAttempt).where(eq(p1HackAttempt.participantId, viewer.id));
  const mine = (await phase1Standings()).find((s) => s.participant_id === viewer.id) ?? null;
  return json({
    standing: mine,
    puzzles: rows.map(({ a, q }) => ({
      question_id: q.id, title: q.title, points: q.points, explain_points: q.explainPoints, grading: q.grading, voided: q.voided,
      auto_score: a.autoScore, manual_score: a.manualScore, explain_score: a.explainScore, comment: a.gradeComment,
      pending: (q.grading === "manual" && a.manualScore === null) || (q.explainPoints > 0 && a.explainScore === null) || a.scoreState === "error",
    })),
    hacks: hacks.map((h) => ({ question_id: h.questionId, hacked: h.hacked, valid_input: h.validInput, points_awarded: h.pointsAwarded })),
  });
});
