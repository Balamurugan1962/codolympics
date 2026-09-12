import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { p1HackAttempt } from "@/db/schema";
import { errors, json, route } from "@/lib/api";
import { getContest } from "@/lib/contest";
import { participantAttempt, participantHackQuestion, publishedHackQuestions } from "@/lib/phase1-hacking";
import { requireApiViewer } from "@/lib/session";

/** Section B questions and my attempts. Attempts show valid/hacked only -- never the verdict. */
export const GET = route(async () => {
  const viewer = await requireApiViewer("participant");
  const c = await getContest();
  if (!["p1_hacking", "review", "auction1", "coding1", "auction2", "final", "ended"].includes(c.phase)) {
    throw errors.conflict("not_open", "Section B has not opened");
  }
  const qs = await publishedHackQuestions();
  const attempts = await db.select().from(p1HackAttempt).where(eq(p1HackAttempt.participantId, viewer.id)).orderBy(desc(p1HackAttempt.id));
  return json({
    open: c.phase === "p1_hacking" && (!c.phaseEndsAt || c.phaseEndsAt.getTime() > Date.now()),
    phase_ends_at: c.phaseEndsAt?.toISOString() ?? null,
    server_now: Date.now(),
    questions: qs.map(participantHackQuestion),
    attempts: attempts.map(participantAttempt),
  });
});
