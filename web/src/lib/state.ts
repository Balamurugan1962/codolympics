/**
 * GET /api/state -- everything a client needs on load and on every SSE
 * reconnect. The single source of truth; cached local state is never trusted.
 */
import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { announcement, notification, participant } from "@/db/schema";

import { auctionSnapshot } from "./auction";
import { getContest, isAuction, isPhase2, phaseSnapshot } from "./contest";
import { hasAdvanced } from "./phase1-review";
import { phase2Standings } from "./scoring";
import { ownedQuestions } from "./questions";
import { submitStatus } from "./submissions";
import type { Viewer } from "./session";

export async function stateFor(viewer: Viewer) {
  const c = await getContest();
  const base = {
    viewer,
    contest: phaseSnapshot(c),
    announcements: await db.select().from(announcement).orderBy(desc(announcement.id)).limit(20),
  };
  if (viewer.role !== "participant") return base;

  const [p] = await db.select().from(participant).where(eq(participant.userId, viewer.id));
  const unread = await db
    .select()
    .from(notification)
    .where(and(eq(notification.participantId, viewer.id), isNull(notification.readAt)))
    .orderBy(desc(notification.id));

  return {
    ...base,
    me: p
      ? {
          balance: p.balance,
          disqualified: Boolean(p.disqualifiedAt),
          advanced: await hasAdvanced(viewer.id),
          p1_puzzles_finished: Boolean(p.p1PuzzlesFinishedAt),
          p1_hacking_finished: Boolean(p.p1HackingFinishedAt),
          // The language the editor opens in. A preference, never a restriction.
          preferred_language: p.preferredLanguage,
        }
      : null,
    questions: await ownedQuestions(viewer.id),
    rank: isPhase2(c.phase) && c.leaderboardMode !== "hidden"
      ? ((await phase2Standings({ frozenAt: c.leaderboardMode === "frozen" ? c.leaderboardFrozenAt : null })).find((s) => s.participant_id === viewer.id) ?? null)
      : null,
    auction: isAuction(c.phase) ? await auctionSnapshot(c.phase === "auction2" ? 2 : 1) : null,
    submit: await submitStatus(viewer.id),
    notifications: unread.map((n) => ({ id: n.id, body_md: n.bodyMd, created_at: n.createdAt.toISOString() })),
  };
}
