import { errors, route } from "@/lib/api";
import { exportMany, type Section } from "@/lib/phase1-package";
import { requireApiViewer } from "@/lib/session";

type Ctx = { params: Promise<{ section: string }> };

/** A whole section as one zip; `all` takes both. */
export const GET = route<Ctx>(async (_req, { params }) => {
  await requireApiViewer("admin", "evaluator");
  const { section } = await params;
  const sections: Section[] = section === "all" ? ["puzzles", "hacking"] : section === "puzzles" || section === "hacking" ? [section] : [];
  if (sections.length === 0) throw errors.notFound("section");
  const { filename, zip } = await exportMany(sections);
  return new Response(zip as BodyInit, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
});
