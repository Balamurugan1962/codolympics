import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { judgement, question, submission } from "@/db/schema";
import { json, route } from "@/lib/api";
import { requireApiViewer } from "@/lib/session";

/** Submissions with full jury detail, for dispute resolution (US-F9-06). Filter by ?question= or ?participant=. */
export const GET = route(async (req) => {
  await requireApiViewer("admin", "evaluator");
  const url = new URL(req.url);
  const q = url.searchParams.get("question");
  const p = url.searchParams.get("participant");
  const rows = await db
    .select({ s: submission, j: judgement, name: user.name, title: question.title })
    .from(submission)
    .innerJoin(judgement, and(eq(judgement.submissionId, submission.id), isNull(judgement.supersededAt)))
    .innerJoin(user, eq(user.id, submission.participantId))
    .innerJoin(question, eq(question.id, submission.questionId))
    .where(and(q ? eq(submission.questionId, q) : undefined, p ? eq(submission.participantId, p) : undefined))
    .orderBy(desc(submission.id))
    .limit(500);
  return json({
    submissions: rows.map((r) => ({
      id: r.s.id, participant_id: r.s.participantId, name: r.name, question_id: r.s.questionId, title: r.title,
      language: r.s.language, created_at: r.s.createdAt.toISOString(),
      judgement: { ...r.j, created_at: r.j.createdAt.toISOString(), ended_at: r.j.endedAt?.toISOString() ?? null },
    })),
  });
});
