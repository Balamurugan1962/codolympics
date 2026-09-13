import { desc } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { announcement } from "@/db/schema";
import { announce } from "@/lib/admin";
import { body, json, route } from "@/lib/api";
import { requireApiViewer } from "@/lib/session";

/** Everything announced so far, newest first. */
export const GET = route(async () => {
  await requireApiViewer("admin");
  return json({ announcements: await db.select().from(announcement).orderBy(desc(announcement.id)).limit(200) });
});

export const POST = route(async (req) => {
  const viewer = await requireApiViewer("admin");
  const { body_md } = await body(req, z.object({ body_md: z.string().min(1).max(5000) }));
  await announce(viewer.id, body_md);
  return json({ ok: true });
});
