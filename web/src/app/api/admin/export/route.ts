import { exportAll } from "@/lib/admin";
import { route } from "@/lib/api";
import { requireApiViewer } from "@/lib/session";

/** Everything, as JSON, for the record (US-B10-03). */
export const GET = route(async () => {
  await requireApiViewer("admin");
  const data = await exportAll();
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="contest-export-${Date.now()}.json"` },
  });
});
