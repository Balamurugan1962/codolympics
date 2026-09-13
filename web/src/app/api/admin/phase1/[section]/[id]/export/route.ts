import { errors, route } from "@/lib/api";
import { exportOne, type Section } from "@/lib/phase1-package";
import { requireApiViewer } from "@/lib/session";

type Ctx = { params: Promise<{ section: string; id: string }> };

/** One question as a zip, ready to keep in a repository and import elsewhere. */
export const GET = route<Ctx>(async (_req, { params }) => {
  await requireApiViewer("admin", "evaluator");
  const { section, id } = await params;
  if (section !== "puzzles" && section !== "hacking") throw errors.notFound("section");
  const { filename, zip } = await exportOne(section as Section, Number(id));
  return new Response(zip as BodyInit, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
});
