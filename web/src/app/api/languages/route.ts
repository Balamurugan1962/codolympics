import { json, route } from "@/lib/api";
import { languages } from "@/lib/languages";
import { requireApiViewer } from "@/lib/session";

/** The judge's list, so the editor dropdown cannot drift (US-F5-01). */
export const GET = route(async () => {
  await requireApiViewer();
  return json({ languages: await languages() });
});
