import { z } from "zod";

import { body, json, route } from "@/lib/api";
import { finishSection } from "@/lib/phase1-puzzles";
import { requireApiViewer } from "@/lib/session";

const Body = z.object({ section: z.enum(["puzzles", "hacking"]) });

/** The explicit finish: records submission time for the tiebreak. */
export const POST = route(async (req) => {
  const viewer = await requireApiViewer("participant");
  await finishSection(viewer.id, (await body(req, Body)).section);
  return json({ ok: true });
});
