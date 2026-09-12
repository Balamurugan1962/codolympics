import { z } from "zod";

import { body, json, route } from "@/lib/api";
import { createStaff } from "@/lib/registration";
import { requireApiViewer } from "@/lib/session";

const Body = z.object({ username: z.string().min(2).max(32), password: z.string().min(8).max(128), role: z.enum(["evaluator", "admin"]), reason: z.string().min(3) });

/** Evaluators do not self-register; an administrator creates them (US-P1-01). */
export const POST = route(async (req) => {
  const viewer = await requireApiViewer("admin");
  const b = await body(req, Body);
  return json({ id: await createStaff(viewer.id, b) }, { status: 201 });
});
