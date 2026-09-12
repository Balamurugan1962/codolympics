import { z } from "zod";

import { body, json, route } from "@/lib/api";
import { phase1Standings, setAdvancement } from "@/lib/phase1-review";
import { requireApiViewer } from "@/lib/session";

/** The Phase 1 leaderboard with full detail, for selection. */
export const GET = route(async () => {
  await requireApiViewer("admin");
  return json({ standings: await phase1Standings() });
});

/** Select who advances (US-P6-01). The full set each time; revisable until Phase 2 opens. */
export const POST = route(async (req) => {
  const viewer = await requireApiViewer("admin");
  const b = await body(req, z.object({ participant_ids: z.array(z.string()), reason: z.string().min(3) }));
  await setAdvancement(viewer.id, { participantIds: b.participant_ids, reason: b.reason });
  return json({ ok: true });
});
