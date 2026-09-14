import { json, route } from "@/lib/api";
import { blackoutState } from "@/lib/powerups";
import { requireApiViewer } from "@/lib/session";

/**
 * Am I blacked out, and until when?
 *
 * The client's countdown is decoration: when it reaches zero it asks this, and
 * only this answer lifts the screen. A clock nudged forward in a browser
 * changes nothing, and a blackout that expired while the tab was asleep is
 * simply gone the next time this is asked.
 */
export const GET = route(async () => {
  const viewer = await requireApiViewer("participant");
  return json(await blackoutState(viewer.id));
});
