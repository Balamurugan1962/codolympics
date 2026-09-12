import { z } from "zod";

import { body, json, route } from "@/lib/api";
import { gradeAnswer } from "@/lib/phase1-review";
import { requireApiViewer } from "@/lib/session";

const Body = z.object({
  participant_id: z.string(),
  question_id: z.number().int(),
  manual_score: z.number().int().min(0).optional(),
  explain_score: z.number().int().min(0).optional(),
  comment: z.string().max(2000).optional(),
});

export const POST = route(async (req) => {
  const viewer = await requireApiViewer("evaluator", "admin");
  const b = await body(req, Body);
  await gradeAnswer(viewer.id, { participantId: b.participant_id, questionId: b.question_id, manualScore: b.manual_score, explainScore: b.explain_score, comment: b.comment });
  return json({ ok: true });
});
