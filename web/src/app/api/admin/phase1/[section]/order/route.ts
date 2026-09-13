import { z } from "zod";

import { body, errors, json, route } from "@/lib/api";
import { reorderPhase1 } from "@/lib/phase1-admin";
import { requireApiViewer } from "@/lib/session";

type Ctx = { params: Promise<{ section: string }> };

const Body = z.object({ ids: z.array(z.number().int()).max(500), reason: z.string().min(3) });

/** The order participants see Section A or Section B questions in. */
export const POST = route<Ctx>(async (req, { params }) => {
  const viewer = await requireApiViewer("admin", "evaluator");
  const { section } = await params;
  if (section !== "puzzles" && section !== "hacking") throw errors.notFound("section");
  const b = await body(req, Body);
  await reorderPhase1(viewer.id, section, b.ids, b.reason);
  return json({ ok: true });
});
