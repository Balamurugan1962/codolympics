import { z } from "zod";

import { body, json, route } from "@/lib/api";
import { submitHack } from "@/lib/phase1-hacking";
import { requireApiViewer } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ input: z.string().max(262_144) });

/** A test input, never code (US-P3-03). */
export const POST = route<Ctx>(async (req, { params }) => {
  const viewer = await requireApiViewer("participant");
  const { id } = await params;
  const attemptId = await submitHack(viewer.id, Number(id), (await body(req, Body)).input);
  return json({ id: attemptId }, { status: 202 });
});
