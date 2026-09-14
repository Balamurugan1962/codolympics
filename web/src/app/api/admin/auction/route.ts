import { json, route } from "@/lib/api";
import { auctionControlSnapshot } from "@/lib/auction-control";
import { requireApiViewer } from "@/lib/session";

/** Every lot of the round with its owner and price — administrators only. */
export const GET = route(async () => {
  await requireApiViewer("admin");
  return json(await auctionControlSnapshot());
});
