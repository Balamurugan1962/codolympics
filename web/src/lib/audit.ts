/**
 * The audit log (US-B1-02, US-B9-04, decision 53r). Every administrator or
 * evaluator action that changes anything goes through here, with a reason.
 * "Unlimited authority without a record is what disputes feed on."
 */
import { db } from "@/db";
import { auditLog } from "@/db/schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function audit(
  entry: {
    actorId: string | null;
    action: string;
    target?: string | null;
    reason: string;
    detail?: unknown;
  },
  tx: Tx | typeof db = db,
): Promise<void> {
  await tx.insert(auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    target: entry.target ?? null,
    reason: entry.reason,
    detail: entry.detail ?? null,
  });
}
