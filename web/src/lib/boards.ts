/**
 * Which standings a competitor means by "the leaderboard" right now, and
 * whether the organisers are showing them. Phase 1 has its own board (points
 * from the puzzles and the hacks); Phase 2 has the one that decides the
 * contest. One address serves both, so a link to the leaderboard is always
 * the same link.
 */
export type Board = { which: "phase1" | "phase2"; mode: string } | null;

const PHASE1 = ["p1_puzzles", "p1_hacking", "review"];

export function boardFor(contest: { phase: string; leaderboard_mode: string; p1_leaderboard_mode: string }): Board {
  if (contest.phase === "registration") return null;
  if (PHASE1.includes(contest.phase)) return { which: "phase1", mode: contest.p1_leaderboard_mode };
  return { which: "phase2", mode: contest.leaderboard_mode };
}

/** Shown in the navigation only while there is a board and it is not hidden. */
export function boardShown(contest: Parameters<typeof boardFor>[0]): boolean {
  const board = boardFor(contest);
  return board !== null && board.mode !== "hidden";
}
