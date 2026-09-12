import { participantsOverview } from "@/lib/admin";
import { json, route } from "@/lib/api";
import { requireApiViewer } from "@/lib/session";

/** Balances, ownership counts and the "owns nothing" flag (US-B4-03). */
export const GET = route(async () => {
  await requireApiViewer("admin");
  return json({ participants: await participantsOverview() });
});
