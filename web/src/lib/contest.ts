/**
 * The contest row and the phase machine (LLD §5).
 *
 *   registration -> p1_puzzles -> p1_hacking -> review
 *                -> auction1 -> coding1 -> auction2 -> final -> ended
 *
 * Phases gate bidding, registration and Phase 1 answering. Submitting and
 * buying hints are permitted in every Phase 2 phase (US-B2-01, US-B6-02).
 */
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { contest, PHASES, type Phase } from "@/db/schema";

export type Contest = typeof contest.$inferSelect;

export async function getContest(): Promise<Contest> {
  const [row] = await db.select().from(contest).where(eq(contest.id, 1));
  if (row) return row;
  const [created] = await db.insert(contest).values({ id: 1 }).onConflictDoNothing().returning();
  return created ?? (await db.select().from(contest).where(eq(contest.id, 1)))[0];
}

export function nextPhase(phase: Phase): Phase | null {
  const i = PHASES.indexOf(phase);
  return i >= 0 && i < PHASES.length - 1 ? PHASES[i + 1] : null;
}

export const isAuction = (p: Phase) => p === "auction1" || p === "auction2";
export const isPhase2 = (p: Phase) => ["auction1", "coding1", "auction2", "final", "ended"].includes(p);
export const isPhase1Open = (p: Phase, section: "puzzles" | "hacking") =>
  (section === "puzzles" && p === "p1_puzzles") || (section === "hacking" && p === "p1_hacking");

/** Phases whose duration is a configured number of minutes. */
export function phaseDurationMinutes(c: Contest, p: Phase): number | null {
  switch (p) {
    case "p1_puzzles": return c.p1PuzzlesMinutes;
    case "p1_hacking": return c.p1HackingMinutes;
    case "coding1": return c.coding1Minutes;
    case "final": return c.finalMinutes;
    default: return null;
  }
}

export const PHASE_LABELS: Record<Phase, string> = {
  registration: "Registration",
  p1_puzzles: "Phase 1 · Logical Puzzles",
  p1_hacking: "Phase 1 · Hacking",
  review: "Review & Selection",
  auction1: "Phase 2 · Auction 1",
  coding1: "Phase 2 · Coding Round 1",
  auction2: "Phase 2 · Auction 2",
  final: "Phase 2 · Final Round",
  ended: "Ended",
};

/** What the client needs about the phase, with server_now for its clock offset. */
export function phaseSnapshot(c: Contest) {
  return {
    phase: c.phase,
    phase_ends_at: c.phaseEndsAt?.toISOString() ?? null,
    registration_open: c.registrationOpen,
    leaderboard_mode: c.leaderboardMode,
    server_now: Date.now(),
  };
}
