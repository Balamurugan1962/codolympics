import { z } from "zod";

import { announce } from "@/lib/admin";
import { body, json, route } from "@/lib/api";
import { requireApiViewer } from "@/lib/session";

export const POST = route(async (req) => {
  const viewer = await requireApiViewer("admin");
  const { body_md } = await body(req, z.object({ body_md: z.string().min(1).max(5000) }));
  await announce(viewer.id, body_md);
  return json({ ok: true });
});
