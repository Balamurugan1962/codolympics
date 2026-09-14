import { json, route } from "@/lib/api";
import { workDetail } from "@/lib/judge-activity";
import { requireApiViewer } from "@/lib/session";

type Ctx = { params: Promise<{ kind: string; id: string }> };

/** One judge request in full: who sent it, what was sent, and what came back. */
export const GET = route<Ctx>(async (_req, { params }) => {
  await requireApiViewer("admin", "evaluator");
  const { kind, id } = await params;
  return json(await workDetail(kind, decodeURIComponent(id)));
});
