import { json, route } from "@/lib/api";
import { buyHint } from "@/lib/hints";
import { requireApiViewer } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** Buy the next hint. Purchases are final and audit-logged (US-B6-03). */
export const POST = route<Ctx>(async (_req, { params }) => {
  const viewer = await requireApiViewer("participant");
  const { id } = await params;
  return json(await buyHint(viewer.id, id));
});
