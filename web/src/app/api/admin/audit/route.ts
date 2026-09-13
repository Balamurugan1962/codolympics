import { recentAudit } from "@/lib/admin";
import { json, route } from "@/lib/api";
import { requireApiViewer } from "@/lib/session";

export const GET = route(async () => {
  await requireApiViewer("admin", "evaluator");
  return json({ entries: (await recentAudit()).map((r) => ({ ...r.entry, actor: r.actor, created_at: r.entry.createdAt.toISOString() })) });
});
