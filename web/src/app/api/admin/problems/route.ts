import { errors, json, route } from "@/lib/api";
import { judge } from "@/lib/judge";
import { currentVersion, uploadPackage, versionsOf } from "@/lib/problems";
import { requireApiViewer } from "@/lib/session";

/** The problem list as the judge sees it, plus which versions exist on disk (US-F9-01). */
export const GET = route(async () => {
  await requireApiViewer("admin");
  const problems = await judge.problems().catch(() => []);
  const withVersions = await Promise.all(problems.map(async (p) => ({ ...p, versions: await versionsOf(p.problem_id), current: await currentVersion(p.problem_id) })));
  return json({ problems: withVersions });
});

/** Upload a package zip as a new version. multipart: id, package, reason. */
export const POST = route(async (req) => {
  const viewer = await requireApiViewer("admin");
  const form = await req.formData();
  const id = String(form.get("id") ?? "").trim();
  const reason = String(form.get("reason") ?? "").trim();
  const file = form.get("package");
  if (!id || !reason || !(file instanceof File)) throw errors.invalid("id, reason and a package file are required");
  if (file.size > 200 * 1024 * 1024) throw errors.invalid("package is larger than 200 MB");
  const result = await uploadPackage(viewer.id, { id, zip: new Uint8Array(await file.arrayBuffer()), reason });
  return json(result, { status: 201 });
});
