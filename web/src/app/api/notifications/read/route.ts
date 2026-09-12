import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { notification } from "@/db/schema";
import { json, route } from "@/lib/api";
import { requireApiViewer } from "@/lib/session";

export const POST = route(async () => {
  const viewer = await requireApiViewer("participant");
  await db.update(notification).set({ readAt: new Date() }).where(and(eq(notification.participantId, viewer.id), isNull(notification.readAt)));
  return json({ ok: true });
});
