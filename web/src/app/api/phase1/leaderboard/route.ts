import { json, route } from "@/lib/api";
import { getContest } from "@/lib/contest";
import { phase1Standings } from "@/lib/phase1-review";
import { requireApiViewer } from "@/lib/session";

/** Honours the administrator's Phase 1 leaderboard setting for participants; staff always see it. */
export const GET = route(async () => {
  const viewer = await requireApiViewer();
  const c = await getContest();
  const mode = c.p1LeaderboardMode;
  if (viewer.role === "participant" && mode === "hidden") return json({ mode, standings: [] });
  const standings = await phase1Standings();
  const visible = viewer.role === "participant" ? standings.map(({ participant_id, name, points, provisional, rank }) => ({ participant_id, name, points, provisional, rank })) : standings;
  return json({ mode, standings: visible, selection_basis: c.p1SelectionBasis });
});
