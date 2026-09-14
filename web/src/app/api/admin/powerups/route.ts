import { z } from "zod";

import { PHASES } from "@/db/schema";
import { body, json, route } from "@/lib/api";
import { catalogue, savePowerup } from "@/lib/powerups";
import { requireApiViewer } from "@/lib/session";

export const GET = route(async () => {
  await requireApiViewer("admin", "evaluator");
  return json({ powerups: await catalogue() });
});

const Patch = z.object({
  reason: z.string().min(3),
  id: z.number().int(),
  name: z.string().min(1).max(60).optional(),
  description: z.string().max(500).optional(),
  price: z.number().int().min(0).optional(),
  duration_seconds: z.number().int().min(1).max(3600).nullable().optional(),
  enabled: z.boolean().optional(),
  max_held: z.number().int().min(1).nullable().optional(),
  max_purchases: z.number().int().min(1).nullable().optional(),
  usable_phases: z.array(z.enum(PHASES)).optional(),
});

/**
 * Change a powerup. Takes effect on the next purchase or use; a blackout
 * already running keeps the duration it landed with, because it has a real end
 * time rather than a reference to this row.
 */
export const PATCH = route(async (req) => {
  const viewer = await requireApiViewer("admin");
  const { reason, id, ...b } = await body(req, Patch);
  await savePowerup(viewer.id, id, {
    name: b.name,
    description: b.description,
    price: b.price,
    durationSeconds: b.duration_seconds,
    enabled: b.enabled,
    maxHeld: b.max_held,
    maxPurchases: b.max_purchases,
    usablePhases: b.usable_phases,
  }, reason);
  return json({ powerups: await catalogue() });
});
