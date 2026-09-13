import { route } from "@/lib/api";
import { exportProblem } from "@/lib/problem-package";
import { requireApiViewer } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** The judge package and the contest details together, as one zip. */
export const GET = route<Ctx>(async (_req, { params }) => {
  await requireApiViewer("admin", "evaluator");
  const { id } = await params;
  const { filename, zip } = await exportProblem(id);
  return new Response(zip as BodyInit, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
});
