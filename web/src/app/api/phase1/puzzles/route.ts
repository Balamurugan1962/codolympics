import { eq } from "drizzle-orm";

import { db } from "@/db";
import { p1Answer } from "@/db/schema";
import { errors, json, route } from "@/lib/api";
import { getContest } from "@/lib/contest";
import { participantQuestion, publishedQuestions } from "@/lib/phase1-puzzles";
import { requireApiViewer } from "@/lib/session";

/** Section A questions (secrets stripped) with my current answers. Only while the section is open or after it. */
export const GET = route(async () => {
  const viewer = await requireApiViewer("participant");
  const c = await getContest();
  if (c.phase === "registration") throw errors.conflict("not_open", "Section A has not opened");
  const qs = await publishedQuestions();
  const mine = await db.select().from(p1Answer).where(eq(p1Answer.participantId, viewer.id));
  const answers = Object.fromEntries(mine.map((a) => [a.questionId, { answer: a.answer, explanation: a.explanation, updated_at: a.updatedAt.toISOString() }]));
  return json({
    open: c.phase === "p1_puzzles" && (!c.phaseEndsAt || c.phaseEndsAt.getTime() > Date.now()),
    phase_ends_at: c.phaseEndsAt?.toISOString() ?? null,
    server_now: Date.now(),
    questions: qs.map(participantQuestion),
    answers,
  });
});
