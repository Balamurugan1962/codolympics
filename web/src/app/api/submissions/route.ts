import { z } from "zod";

import { body, json, route } from "@/lib/api";
import { requireApiViewer } from "@/lib/session";
import { submitSolution } from "@/lib/submissions";

const Body = z.object({
  question_id: z.string().regex(/^[A-Za-z0-9._-]+$/),
  language: z.string().min(1).max(32),
  source: z.string().max(262_144),
});

/** US-B5-01: persisted before the judge is called. */
export const POST = route(async (req) => {
  const viewer = await requireApiViewer("participant");
  const b = await body(req, Body);
  const id = await submitSolution(viewer.id, { questionId: b.question_id, language: b.language, source: b.source });
  return json({ id }, { status: 202 });
});
