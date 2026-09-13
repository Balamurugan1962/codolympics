import { errors, json, route } from "@/lib/api";
import { importProblems } from "@/lib/problem-package";
import { requireApiViewer } from "@/lib/session";

const MAX_BYTES = 64 * 1024 * 1024;

/**
 * Import one problem or a whole bundle: package and details in one go. Every
 * package lands as a new unpublished version -- one that goes live without
 * someone here validating it is how a contest finds out on the day that its
 * tests were built against a different checker.
 */
export const POST = route(async (req) => {
  const viewer = await requireApiViewer("admin", "evaluator");
  const form = await req.formData().catch(() => null);
  const file = form?.get("package");
  const reason = String(form?.get("reason") ?? "").trim();
  const id = String(form?.get("id") ?? "").trim() || undefined;

  if (!(file instanceof File)) throw errors.invalid("attach the zip as `package`");
  if (reason.length < 3) throw errors.invalid("a reason is required");
  if (file.size > MAX_BYTES) throw errors.invalid("that zip is larger than 64 MB");

  const zip = new Uint8Array(await file.arrayBuffer());
  return json({ imported: await importProblems(viewer.id, zip, { id, reason }) });
});
