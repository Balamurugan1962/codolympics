"use client";

/**
 * The contest, from a competitor's seat.
 *
 * One screen that follows the phase instead of a home page with buttons to
 * somewhere else. Waiting to start, answering Section A, hacking in Section B,
 * bidding at the auction, solving what you own — each is the whole screen while
 * it is happening, and it changes by itself when the organisers move on.
 *
 * The reasoning: during a timed round every click that is not the task is time
 * lost, and a navigation bar offering four phases when only one is open is an
 * invitation to get lost in the other three. The leaderboard and your results
 * stay reachable; nothing else competes with what you are meant to be doing.
 */
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AuctionFloor } from "@/components/contest/auction-floor";
import { CodingRound } from "@/components/contest/coding-round";
import { SectionA } from "@/components/contest/section-a";
import { SectionB } from "@/components/contest/section-b";
import { ContestLoading, Ended, NotSelected, Reviewing, Waiting } from "@/components/contest/waiting";
import { useContest } from "@/components/contest-provider";

export default function ContestPage() {
  const { state } = useContest();
  const router = useRouter();

  // Evaluators land here only by typing the URL; send them to their own work.
  useEffect(() => {
    if (state && state.viewer.role !== "participant") router.replace("/grade");
  }, [router, state]);

  if (!state) return <ContestLoading />;

  const phase = state.contest.phase;
  // Phase 2 is closed to anyone the organisers did not select.
  const inPhase2 = ["auction1", "coding1", "auction2", "final"].includes(phase);
  if (inPhase2 && !state.me?.advanced) return <NotSelected />;

  switch (phase) {
    case "p1_puzzles":
      return <SectionA />;
    case "p1_hacking":
      return <SectionB />;
    case "review":
      return <Reviewing />;
    case "auction1":
    case "auction2":
      return <AuctionFloor />;
    case "coding1":
    case "final":
      return <CodingRound />;
    case "ended":
      return <Ended />;
    default:
      return <Waiting />;
  }
}
