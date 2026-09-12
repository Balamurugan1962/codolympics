import { z } from "zod";

import { body, errors, json, route } from "@/lib/api";
import { advanceChecks, advancePhase, extendPhase, setRegistration } from "@/lib/phases";
import { requireApiViewer } from "@/lib/session";

type Ctx = { params: Promise<{ action: string }> };

/** GET /api/admin/contest/phase -- what advancing would do, before confirming (US-F9-04). */
export const GET = route<Ctx>(async (_req, { params }) => {
  await requireApiViewer("admin");
  const { action } = await params;
  if (action !== "phase") throw errors.notFound("action");
  return json(await advanceChecks());
});

export const POST = route<Ctx>(async (req, { params }) => {
  const viewer = await requireApiViewer("admin");
  const { action } = await params;
  switch (action) {
    case "phase": {
      const b = await body(req, z.object({ reason: z.string().min(3), acknowledge_warnings: z.boolean().optional() }));
      return json({ phase: await advancePhase(viewer.id, b.reason, { acknowledgeWarnings: b.acknowledge_warnings }) });
    }
    case "extend": {
      const b = await body(req, z.object({ reason: z.string().min(3), minutes: z.number().int().min(1).max(600) }));
      await extendPhase(viewer.id, b.minutes, b.reason);
      return json({ ok: true });
    }
    case "registration": {
      const b = await body(req, z.object({ reason: z.string().min(3), open: z.boolean() }));
      await setRegistration(viewer.id, b.open, b.reason);
      return json({ ok: true });
    }
    default:
      throw errors.notFound("action");
  }
});
