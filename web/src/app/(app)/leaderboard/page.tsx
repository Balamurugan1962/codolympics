"use client";

import { Phase1Board } from "@/components/boards/phase1-board";
import { Phase2Board } from "@/components/boards/phase2-board";
import { useContest } from "@/components/contest-provider";
import { Icon } from "@/components/icons";
import { EmptyState } from "@/components/ui/empty-state";
import { PageBody } from "@/components/ui/page";
import { boardFor } from "@/lib/boards";

/** The leaderboard: whichever standings belong to the part of the contest we are in. */
export default function LeaderboardPage() {
  const { state } = useContest();
  const board = state ? boardFor(state.contest) : null;
  if (!board) {
    return (
      <PageBody>
        <EmptyState icon={<Icon.Trophy size={20} />} title="No standings yet" body="The board appears once the contest starts." />
      </PageBody>
    );
  }
  return board.which === "phase1" ? <Phase1Board /> : <Phase2Board />;
}
