import { health } from "@/lib/admin";
import { json, route } from "@/lib/api";
import { requireApiViewer } from "@/lib/session";

/** Judge reachability and the submission backlog (US-B10-01). */
export const GET = route(async () => {
  await requireApiViewer("admin");
  return json(await health());
});
