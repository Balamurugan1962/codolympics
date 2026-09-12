import { z } from "zod";

import { LEADERBOARD_MODES } from "@/db/schema";
import { updateContest } from "@/lib/admin";
import { body, json, route } from "@/lib/api";
import { getContest } from "@/lib/contest";
import { requireApiViewer } from "@/lib/session";

const Patch = z.object({
  reason: z.string().min(3),
  starting_balance: z.number().int().min(0).optional(),
  bid_increment: z.number().int().min(1).optional(),
  countdown_seconds: z.number().int().min(0).optional(),      // 0 disables the countdown
  opening_window_seconds: z.number().int().min(1).optional(),
  ownership_cap: z.number().int().min(1).nullable().optional(),
  coding1_minutes: z.number().int().min(1).optional(),
  final_minutes: z.number().int().min(1).optional(),
  p1_puzzles_minutes: z.number().int().min(1).optional(),
  p1_hacking_minutes: z.number().int().min(1).optional(),
  p1_selection_basis: z.string().max(2000).optional(),
  p1_leaderboard_mode: z.enum(LEADERBOARD_MODES).optional(),
  leaderboard_mode: z.enum(LEADERBOARD_MODES).optional(),
});

export const GET = route(async () => {
  await requireApiViewer("admin");
  return json(await getContest());
});

/** Every parameter an administrator may change (US-B9-04), with a reason. */
export const PATCH = route(async (req) => {
  const viewer = await requireApiViewer("admin");
  const { reason, ...b } = await body(req, Patch);
  await updateContest(viewer.id, {
    startingBalance: b.starting_balance, bidIncrement: b.bid_increment, countdownSeconds: b.countdown_seconds,
    openingWindowSeconds: b.opening_window_seconds, ownershipCap: b.ownership_cap, coding1Minutes: b.coding1_minutes,
    finalMinutes: b.final_minutes, p1PuzzlesMinutes: b.p1_puzzles_minutes, p1HackingMinutes: b.p1_hacking_minutes,
    p1SelectionBasis: b.p1_selection_basis, p1LeaderboardMode: b.p1_leaderboard_mode, leaderboardMode: b.leaderboard_mode,
  }, reason);
  return json(await getContest());
});
