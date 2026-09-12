import { z } from "zod";

import { body, json, route } from "@/lib/api";
import { placeBid } from "@/lib/auction";
import { requireApiViewer } from "@/lib/session";

const Body = z.object({ lot_id: z.number().int().positive(), amount: z.number().int().positive() });

/** US-B3-01: validated server-side; a manipulated client cannot bid illegally. */
export const POST = route(async (req) => {
  const viewer = await requireApiViewer("participant");
  const b = await body(req, Body);
  await placeBid(viewer.id, b.lot_id, b.amount);
  return json({ ok: true });
});
