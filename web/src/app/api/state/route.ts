import { json, route } from "@/lib/api";
import { requireApiViewer } from "@/lib/session";
import { stateFor } from "@/lib/state";

/** Everything the client needs on load and on every reconnect. */
export const GET = route(async () => {
  const viewer = await requireApiViewer();
  return json(await stateFor(viewer));
});
