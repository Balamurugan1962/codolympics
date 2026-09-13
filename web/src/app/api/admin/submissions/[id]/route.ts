import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { judgement, submission } from "@/db/schema";
import { errors, json, route } from "@/lib/api";
import { judge } from "@/lib/judge";
import { requireApiViewer } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** One submission: source, every judgement (history kept), and the failing testcase at the judged version. */
export const GET = route<Ctx>(async (_req, { params }) => {
  await requireApiViewer("admin", "evaluator");
  const { id } = await params;
  const [s] = await db.select().from(submission).where(eq(submission.id, Number(id)));
  if (!s) throw errors.notFound("submission");
  const js = await db.select().from(judgement).where(eq(judgement.submissionId, s.id)).orderBy(desc(judgement.attempt));
  const current = js.find((j) => !j.supersededAt) ?? null;
  let failing = null;
  if (current?.firstFail !== null && current?.firstFail !== undefined && current.problemVersion) {
    failing = await judge.testcase(s.questionId, current.firstFail, current.problemVersion).catch(() => null);
  }
  return json({ submission: { ...s, created_at: s.createdAt.toISOString() }, judgements: js, failing_testcase: failing });
});
