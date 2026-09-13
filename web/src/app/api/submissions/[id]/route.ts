import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { judgement, submission } from "@/db/schema";
import { errors, json, route } from "@/lib/api";
import { requireApiViewer } from "@/lib/session";
import { participantView } from "@/lib/submissions";

type Ctx = { params: Promise<{ id: string }> };

/**
 * One submission's judgement, and nothing else.
 *
 * The workspace polls this while a submission is in flight, so it is
 * deliberately the narrowest response in the app: re-reading the statement,
 * the samples and the hint ledger once a second to find out whether test 4 has
 * finished is most of a round's traffic for none of the information.
 *
 * Ownership is checked here rather than assumed from the id being unguessable.
 */
export const GET = route<Ctx>(async (_req, { params }) => {
  const viewer = await requireApiViewer("participant");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) throw errors.invalid("bad submission id");

  const [row] = await db
    .select({ s: submission, j: judgement })
    .from(submission)
    .innerJoin(judgement, and(eq(judgement.submissionId, submission.id), isNull(judgement.supersededAt)))
    .where(and(eq(submission.id, id), eq(submission.participantId, viewer.id)))
    .orderBy(desc(judgement.attempt))
    .limit(1);
  if (!row) throw errors.notFound("submission");

  return json({
    id: row.s.id,
    question_id: row.s.questionId,
    language: row.s.language,
    created_at: row.s.createdAt.toISOString(),
    judgement: participantView(row.j),
    server_now: Date.now(),
  });
});
