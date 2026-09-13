import { route } from "@/lib/api";
import { exportAllProblems } from "@/lib/problem-package";
import { requireApiViewer } from "@/lib/session";

/** Every problem in one zip, each in its own folder with its package. */
export const GET = route(async () => {
  await requireApiViewer("admin", "evaluator");
  const { filename, zip } = await exportAllProblems();
  return new Response(zip as BodyInit, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
});
