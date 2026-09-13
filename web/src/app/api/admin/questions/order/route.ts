import { z } from "zod";

import { reorderQuestions } from "@/lib/admin";
import { body, json, route } from "@/lib/api";
import { requireApiViewer } from "@/lib/session";

const Body = z.object({ ids: z.array(z.string()).max(500), reason: z.string().min(3) });

/**
 * The order lots are offered in at auction. Administrators only: the order is
 * published in advance and bidders plan their money around it, so changing it
 * mid-contest changes the game rather than the content.
 */
export const POST = route(async (req) => {
  const viewer = await requireApiViewer("admin");
  const b = await body(req, Body);
  await reorderQuestions(viewer.id, b.ids, b.reason);
  return json({ ok: true });
});
