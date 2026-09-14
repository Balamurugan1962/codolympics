import { z } from "zod";

import { body, json, route } from "@/lib/api";
import { publish } from "@/lib/events";
import { buyPowerup } from "@/lib/powerups";
import { requireApiViewer } from "@/lib/session";

/**
 * Buy one. `request_id` is the client's own idempotency key: sending the same
 * one twice — a double click, a retry, a refresh that resubmits — buys once.
 */
export const POST = route(async (req) => {
  const viewer = await requireApiViewer("participant");
  const b = await body(req, z.object({ powerup_id: z.number().int(), request_id: z.string().min(8).max(64) }));
  const result = await buyPowerup(viewer.id, { powerupId: b.powerup_id, requestId: b.request_id });
  publish("balance", { balance: result.balance }, viewer.id);
  return json(result);
});
