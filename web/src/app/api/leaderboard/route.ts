import { json, route } from "@/lib/api";
import { leaderboardForParticipants } from "@/lib/scoring";
import { requireApiViewer } from "@/lib/session";

export const GET = route(async () => {
  await requireApiViewer();
  return json(await leaderboardForParticipants());
});
