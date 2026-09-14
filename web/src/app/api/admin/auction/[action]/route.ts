import { z } from "zod";

import { body, errors, json, route } from "@/lib/api";
import { closeLotNow } from "@/lib/auction";
import {
  pauseAuction,
  reorderLots,
  restoreLot,
  resumeAuction,
  retractTopBid,
  setLotTimer,
  takeBackQuestion,
  withdrawLot,
} from "@/lib/auction-control";
import { requireApiViewer } from "@/lib/session";

type Ctx = { params: Promise<{ action: string }> };

const reason = z.string().min(3);

/**
 * Everything an administrator can do to a running auction.
 *
 * Administrator only — an evaluator can read the contest but never move it —
 * and every action carries a reason that lands in the audit log inside the same
 * transaction as the change.
 */
export const POST = route<Ctx>(async (req, { params }) => {
  const viewer = await requireApiViewer("admin");
  const { action } = await params;

  switch (action) {
    case "pause": {
      const b = await body(req, z.object({ reason }));
      await pauseAuction(viewer.id, b.reason);
      return json({ ok: true });
    }
    case "resume": {
      const b = await body(req, z.object({ reason }));
      return json({ held_ms: await resumeAuction(viewer.id, b.reason) });
    }
    case "close": {
      const b = await body(req, z.object({ reason }));
      await closeLotNow(viewer.id, b.reason);
      return json({ ok: true });
    }
    case "withdraw": {
      const b = await body(req, z.object({ reason, lot_id: z.number().int() }));
      await withdrawLot(viewer.id, b.lot_id, b.reason);
      return json({ ok: true });
    }
    case "restore": {
      const b = await body(req, z.object({ reason, lot_id: z.number().int() }));
      await restoreLot(viewer.id, b.lot_id, b.reason);
      return json({ ok: true });
    }
    case "reorder": {
      const b = await body(req, z.object({ reason, round: z.number().int().min(1).max(2), lot_ids: z.array(z.number().int()).min(1) }));
      await reorderLots(viewer.id, b.round, b.lot_ids, b.reason);
      return json({ ok: true });
    }
    case "timer": {
      const b = await body(req, z.object({ reason, mode: z.enum(["off", "restart", "adjust"]), seconds: z.number().int().min(-3600).max(3600).optional() }));
      await setLotTimer(viewer.id, { mode: b.mode, seconds: b.seconds, reason: b.reason });
      return json({ ok: true });
    }
    case "retract-bid": {
      const b = await body(req, z.object({ reason }));
      return json(await retractTopBid(viewer.id, b.reason));
    }
    case "take-back": {
      const b = await body(req, z.object({
        reason,
        question_id: z.string().min(1),
        refund_price: z.boolean(),
        refund_hints: z.boolean(),
        relist: z.boolean(),
      }));
      return json(await takeBackQuestion(viewer.id, {
        questionId: b.question_id,
        refundPrice: b.refund_price,
        refundHints: b.refund_hints,
        relist: b.relist,
        reason: b.reason,
      }));
    }
    default:
      throw errors.notFound("action");
  }
});
