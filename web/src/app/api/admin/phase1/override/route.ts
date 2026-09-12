import { z } from "zod";

import { body, json, route } from "@/lib/api";
import { overrideScore } from "@/lib/phase1-admin";
import { requireApiViewer } from "@/lib/session";

const Body = z.object({
  participant_id: z.string(), question_id: z.number().int(), reason: z.string().min(3),
  auto_score: z.number().int().min(0).optional(), manual_score: z.number().int().min(0).optional(), explain_score: z.number().int().min(0).optional(),
});

/** Adjust one participant's score on one Section A question (US-P6-04). */
export const POST = route(async (req) => {
  const viewer = await requireApiViewer("admin");
  const b = await body(req, Body);
  await overrideScore(viewer.id, { participantId: b.participant_id, questionId: b.question_id, autoScore: b.auto_score, manualScore: b.manual_score, explainScore: b.explain_score, reason: b.reason });
  return json({ ok: true });
});
