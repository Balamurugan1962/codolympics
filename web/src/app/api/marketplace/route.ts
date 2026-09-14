import { json, route } from "@/lib/api";
import { marketplaceFor } from "@/lib/powerups";
import { requireApiViewer } from "@/lib/session";

/** Prices, what you hold, who you may aim at — all decided server-side. */
export const GET = route(async () => {
  const viewer = await requireApiViewer("participant");
  return json(await marketplaceFor(viewer.id));
});
