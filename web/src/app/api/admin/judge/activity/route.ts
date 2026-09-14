import { health } from "@/lib/admin";
import { json, route } from "@/lib/api";
import { judgeActivity, summarise } from "@/lib/judge-activity";
import { requireApiViewer } from "@/lib/session";

/**
 * What the judge is doing: every request sent to it, whatever kind.
 *
 * Health comes back on the same response so the page refreshes as one thing —
 * the tiles and the list can never disagree about whether the judge is up.
 */
export const GET = route(async () => {
  await requireApiViewer("admin", "evaluator");
  const [h, work] = await Promise.all([health(), judgeActivity()]);
  return json({ judge: h.judge, backlog: h.backlog, work, counts: summarise(work), server_now: Date.now() });
});
