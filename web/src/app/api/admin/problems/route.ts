import { errors, json, route } from "@/lib/api";
import { judge } from "@/lib/judge";
import { currentVersion, packagesOnDisk, uploadPackage, validationOf, versionsOf } from "@/lib/problems";
import { requireApiViewer } from "@/lib/session";

/**
 * Every package, whether or not the judge can serve it yet (US-F9-01).
 *
 * The judge only reads a package's live version, so listing only what it can
 * see would hide everything uploaded and not yet published — including
 * everything a setup import creates, leaving no way to reach the Publish button.
 * The volume is the truth about what exists; the judge is the truth about what
 * is running, so its entry wins where the two overlap.
 */
export const GET = route(async () => {
  await requireApiViewer("admin", "evaluator");
  const [live, onDisk] = await Promise.all([judge.problems().catch(() => []), packagesOnDisk()]);
  const byId = new Map(onDisk.map((p) => [p.problem_id, p]));
  for (const p of live) byId.set(p.problem_id, p);

  const problems = await Promise.all(
    [...byId.values()]
      .sort((a, b) => a.problem_id.localeCompare(b.problem_id))
      .map(async (p) => {
        const versions = await versionsOf(p.problem_id);
        const current = await currentVersion(p.problem_id);
        return {
          ...p,
          versions,
          current,
          // What the last validation of the newest version found — here or on
          // whichever install exported it.
          last_validation: await validationOf(p.problem_id, current ?? versions.at(-1) ?? p.version),
        };
      }),
  );
  return json({ problems });
});

/** Upload a package zip as a new version. multipart: id, package, reason. */
export const POST = route(async (req) => {
  const viewer = await requireApiViewer("admin", "evaluator");
  const form = await req.formData();
  const id = String(form.get("id") ?? "").trim();
  const reason = String(form.get("reason") ?? "").trim();
  const file = form.get("package");
  if (!id || !reason || !(file instanceof File)) throw errors.invalid("id, reason and a package file are required");
  if (file.size > 200 * 1024 * 1024) throw errors.invalid("package is larger than 200 MB");
  const result = await uploadPackage(viewer.id, { id, zip: new Uint8Array(await file.arrayBuffer()), reason });
  return json(result, { status: 201 });
});
