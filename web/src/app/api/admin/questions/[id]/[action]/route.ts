import { z } from "zod";

import { rejudgeOutcome, transferOwnership, voidQuestion } from "@/lib/admin";
import { body, errors, json, route } from "@/lib/api";
import { assignQuestion } from "@/lib/auction";
import { requireApiViewer } from "@/lib/session";
import { rejudgeQuestion } from "@/lib/submissions";

type Ctx = { params: Promise<{ id: string; action: string }> };

/** void | rejudge | rejudge-outcome | assign | transfer -- every one with a reason (US-B9-04). */
export const POST = route<Ctx>(async (req, { params }) => {
  const viewer = await requireApiViewer("admin");
  const { id, action } = await params;
  switch (action) {
    case "void": {
      const b = await body(req, z.object({ reason: z.string().min(3), refund_price: z.boolean().optional(), refund_hints: z.boolean().optional() }));
      await voidQuestion(viewer.id, { questionId: id, reason: b.reason, refundPrice: b.refund_price, refundHints: b.refund_hints });
      return json({ ok: true });
    }
    case "rejudge": {
      await body(req, z.object({ reason: z.string().min(3) }));
      return json({ rejudged: await rejudgeQuestion(id) });
    }
    case "rejudge-outcome": {
      const b = await body(req, z.object({ reason: z.string().min(3), outcome: z.enum(["stand", "refund", "void"]) }));
      await rejudgeOutcome(viewer.id, { questionId: id, outcome: b.outcome, reason: b.reason });
      return json({ ok: true });
    }
    case "assign": {
      const b = await body(req, z.object({ reason: z.string().min(3), participant_id: z.string(), price: z.number().int().min(0) }));
      await assignQuestion(viewer.id, { questionId: id, participantId: b.participant_id, price: b.price, reason: b.reason });
      return json({ ok: true });
    }
    case "transfer": {
      const b = await body(req, z.object({ reason: z.string().min(3), participant_id: z.string() }));
      await transferOwnership(viewer.id, { questionId: id, toParticipantId: b.participant_id, reason: b.reason });
      return json({ ok: true });
    }
    default:
      throw errors.notFound("action");
  }
});
