import { json, route } from "@/lib/api";
import { requireApiViewer } from "@/lib/session";
import { cancelInFlight } from "@/lib/submissions";

/** Cancel my in-flight judgement. The cooldown starts now (US-B5-03). */
export const DELETE = route(async () => {
  const viewer = await requireApiViewer("participant");
  return json({ cancelled: await cancelInFlight(viewer.id) });
});
