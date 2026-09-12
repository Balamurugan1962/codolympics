import { z } from "zod";

import { adjustBalance, renameUser, resetPassword } from "@/lib/admin";
import { body, errors, json, route } from "@/lib/api";
import { disqualify } from "@/lib/phase1-review";
import { requireApiViewer } from "@/lib/session";

type Ctx = { params: Promise<{ id: string; action: string }> };

/** adjust | password | rename | disqualify | requalify -- live account repairs (US-B1-01, US-B9-04, US-P6-03). */
export const POST = route<Ctx>(async (req, { params }) => {
  const viewer = await requireApiViewer("admin");
  const { id, action } = await params;
  switch (action) {
    case "adjust": {
      const b = await body(req, z.object({ reason: z.string().min(3), delta: z.number().int() }));
      return json({ balance: await adjustBalance(viewer.id, { participantId: id, delta: b.delta, reason: b.reason }) });
    }
    case "password": {
      const b = await body(req, z.object({ reason: z.string().min(3), password: z.string().min(8).max(128) }));
      await resetPassword(viewer.id, { userId: id, password: b.password, reason: b.reason, headers: req.headers });
      return json({ ok: true });
    }
    case "rename": {
      const b = await body(req, z.object({ reason: z.string().min(3), name: z.string().min(2).max(32) }));
      await renameUser(viewer.id, { userId: id, name: b.name, reason: b.reason });
      return json({ ok: true });
    }
    case "disqualify":
    case "requalify": {
      const b = await body(req, z.object({ reason: z.string().min(3) }));
      await disqualify(viewer.id, { participantId: id, reason: b.reason, undo: action === "requalify" });
      return json({ ok: true });
    }
    default:
      throw errors.notFound("action");
  }
});
