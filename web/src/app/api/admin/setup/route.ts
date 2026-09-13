import { errors, json, route } from "@/lib/api";
import { exportSetup, importSetup } from "@/lib/setup-package";
import { requireApiViewer } from "@/lib/session";

const MAX_BYTES = 128 * 1024 * 1024;

/**
 * The whole setup, out and back in. Administrators only: it carries staff
 * credentials and rewrites every contest setting.
 */
export const GET = route(async (req) => {
  await requireApiViewer("admin");
  const withStaff = new URL(req.url).searchParams.get("staff") !== "0";
  const { filename, zip } = await exportSetup(withStaff);
  return new Response(zip as BodyInit, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
});

export const POST = route(async (req) => {
  const viewer = await requireApiViewer("admin");
  const form = await req.formData().catch(() => null);
  const file = form?.get("package");
  const reason = String(form?.get("reason") ?? "").trim();
  if (!(file instanceof File)) throw errors.invalid("attach the zip as `package`");
  if (reason.length < 3) throw errors.invalid("a reason is required");
  if (file.size > MAX_BYTES) throw errors.invalid("that zip is larger than 128 MB");
  return json(await importSetup(viewer.id, new Uint8Array(await file.arrayBuffer()), reason));
});
