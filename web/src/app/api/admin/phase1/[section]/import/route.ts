import { errors, json, route } from "@/lib/api";
import { importPackage } from "@/lib/phase1-package";
import { judge } from "@/lib/judge";
import { requireApiViewer } from "@/lib/session";

type Ctx = { params: Promise<{ section: string }> };

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Import questions from a zip this app exported. Everything lands as a draft:
 * nothing an author brings in should reach participants before someone here
 * has read it and published it.
 */
export const POST = route<Ctx>(async (req, { params }) => {
  const viewer = await requireApiViewer("admin", "evaluator");
  const { section } = await params;
  if (!["puzzles", "hacking", "all"].includes(section)) throw errors.notFound("section");

  const form = await req.formData().catch(() => null);
  const file = form?.get("package");
  const reason = String(form?.get("reason") ?? "").trim();
  if (!(file instanceof File)) throw errors.invalid("attach the zip as `package`");
  if (reason.length < 3) throw errors.invalid("a reason is required");
  if (file.size > MAX_BYTES) throw errors.invalid("that zip is larger than 8 MB");

  // A hacking question names a judge package; the import says which are missing
  // rather than refusing, because the question is still worth keeping.
  const known = new Set<string>();
  try {
    for (const p of await judge.problems()) known.add(p.problem_id);
  } catch {
    /* judge down: every package reads as missing, which is the safe way round */
  }

  const zip = new Uint8Array(await file.arrayBuffer());
  return json(await importPackage(viewer.id, zip, reason, known));
});
