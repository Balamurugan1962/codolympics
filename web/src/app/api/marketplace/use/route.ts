import { z } from "zod";

import { body, json, route } from "@/lib/api";
import { announceUse, usePowerup } from "@/lib/powerups";
import { requireApiViewer } from "@/lib/session";

/**
 * Use one. The target is validated on the server: you cannot aim at yourself,
 * at somebody who is out, or at anyone the catalogue did not offer.
 */
export const POST = route(async (req) => {
  const viewer = await requireApiViewer("participant");
  const b = await body(req, z.object({
    powerup_id: z.number().int(),
    target_id: z.string().min(1).nullish(),
    request_id: z.string().min(8).max(64),
  }));
  const result = await usePowerup(viewer.id, { powerupId: b.powerup_id, targetId: b.target_id ?? null, requestId: b.request_id });
  await announceUse(viewer.id, b.target_id ?? null, result);
  return json(result);
});
