import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/auth-schema";
import { p1HackAttempt, p1HackQuestion } from "@/db/schema";
import { json, route } from "@/lib/api";
import { requireApiViewer } from "@/lib/session";

/** Hack attempts in full -- verdicts included -- for evaluators and administrators. */
export const GET = route(async () => {
  await requireApiViewer("evaluator", "admin");
  const rows = await db
    .select({ a: p1HackAttempt, title: p1HackQuestion.title, name: user.name })
    .from(p1HackAttempt)
    .innerJoin(p1HackQuestion, eq(p1HackQuestion.id, p1HackAttempt.questionId))
    .innerJoin(user, eq(user.id, p1HackAttempt.participantId))
    .orderBy(desc(p1HackAttempt.id))
    .limit(500);
  return json({ attempts: rows.map((r) => ({ ...r.a, created_at: r.a.createdAt.toISOString(), title: r.title, name: r.name })) });
});
