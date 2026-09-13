import { z } from "zod";

import { removeUser } from "@/lib/admin";
import { body, json, route } from "@/lib/api";
import { participantDossier } from "@/lib/participant-detail";
import { requireApiViewer } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Everything one participant did, across both phases. Evaluators may read it
 * too -- settling "what happened to me?" is their job during review -- but it
 * carries answer keys, hack verdicts and jury detail, so never a participant.
 */
export const GET = route<Ctx>(async (_req, { params }) => {
  await requireApiViewer("admin", "evaluator");
  const { id } = await params;
  return json(await participantDossier(id));
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const viewer = await requireApiViewer("admin");
  const { id } = await params;
  const { reason } = await body(req, z.object({ reason: z.string().min(3) }));
  await removeUser(viewer.id, { userId: id, reason });
  return json({ ok: true });
});
