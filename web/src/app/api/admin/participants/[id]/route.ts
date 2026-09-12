import { z } from "zod";

import { removeUser } from "@/lib/admin";
import { body, json, route } from "@/lib/api";
import { requireApiViewer } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = route<Ctx>(async (req, { params }) => {
  const viewer = await requireApiViewer("admin");
  const { id } = await params;
  const { reason } = await body(req, z.object({ reason: z.string().min(3) }));
  await removeUser(viewer.id, { userId: id, reason });
  return json({ ok: true });
});
