import { z } from "zod";

import { body, errors, json, route } from "@/lib/api";
import { closeLotNow } from "@/lib/auction";
import { setLotTimer } from "@/lib/auction-control";
import { requireApiViewer } from "@/lib/session";

type Ctx = { params: Promise<{ action: string }> };

/** close | disable-timer, on the open lot (US-B3-03). */
export const POST = route<Ctx>(async (req, { params }) => {
  const viewer = await requireApiViewer("admin");
  const { action } = await params;
  const { reason } = await body(req, z.object({ reason: z.string().min(3) }));
  if (action === "close") await closeLotNow(viewer.id, reason);
  else if (action === "disable-timer") await setLotTimer(viewer.id, { mode: "off", reason });
  else throw errors.notFound("action");
  return json({ ok: true });
});
