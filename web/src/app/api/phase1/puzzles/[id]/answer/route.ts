import { z } from "zod";

import { body, json, route } from "@/lib/api";
import { saveAnswer } from "@/lib/phase1-puzzles";
import { requireApiViewer } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ answer: z.unknown().optional(), explanation: z.string().max(20_000).optional() });

/** Autosaved, revisable until the section closes (US-P4-02, US-P4-03). */
export const PUT = route<Ctx>(async (req, { params }) => {
  const viewer = await requireApiViewer("participant");
  const { id } = await params;
  await saveAnswer(viewer.id, Number(id), await body(req, Body));
  return json({ saved_at: new Date().toISOString() });
});
