import { json, route } from "@/lib/api";
import { questionForOwner } from "@/lib/questions";
import { requireApiViewer } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** Owned questions only. Anything else is 403, not hidden (US-F3-02). */
export const GET = route<Ctx>(async (_req, { params }) => {
  const viewer = await requireApiViewer("participant");
  const { id } = await params;
  return json(await questionForOwner(viewer.id, id));
});
