import { z } from "zod";

import { body, json, route } from "@/lib/api";
import { saveDraft } from "@/lib/questions";
import { requireApiViewer } from "@/lib/session";

type Ctx = { params: Promise<{ questionId: string }> };
const Body = z.object({ source: z.string().max(262_144), language: z.string().max(32) });

/** Autosave (US-F5-03). Server-side so a machine swap finds it. */
export const PUT = route<Ctx>(async (req, { params }) => {
  const viewer = await requireApiViewer("participant");
  const { questionId } = await params;
  await saveDraft(viewer.id, questionId, await body(req, Body));
  return json({ saved_at: new Date().toISOString() });
});
