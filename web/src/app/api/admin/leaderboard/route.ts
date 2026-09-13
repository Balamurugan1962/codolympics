import { json, route } from "@/lib/api";
import { phase1Standings } from "@/lib/phase1-review";
import { phase2Standings } from "@/lib/scoring";
import { requireApiViewer } from "@/lib/session";

/**
 * Both boards, in full, for the people running the contest.
 *
 * Deliberately not the participant view: this ignores the hidden/frozen
 * setting, because an organiser hiding the leaderboard from competitors still
 * has to be able to see it. Participants get /api/leaderboard, which honours
 * the setting.
 */
export const GET = route(async () => {
  await requireApiViewer("admin", "evaluator");
  const [p1, p2] = await Promise.all([phase1Standings(), phase2Standings()]);
  return json({ phase1: p1, phase2: p2 });
});
