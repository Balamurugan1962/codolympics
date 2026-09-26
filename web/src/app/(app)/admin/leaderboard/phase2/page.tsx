"use client";

import Link from "next/link";

import { Phase2Standings, useStandings } from "@/components/admin/standings";
import { useContest } from "@/components/contest-provider";
import { Icon } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageBody, PageHeader, Section } from "@/components/ui/page";

const BEFORE = ["registration", "p1_puzzles", "p1_hacking", "review"];

export default function Phase2LeaderboardPage() {
  const { data } = useStandings();
  const { state } = useContest();
  const notYet = BEFORE.includes(state?.contest.phase ?? "");

  return (
    <PageBody width="wide">
      <PageHeader
        title="Phase 2 standings"
        description="Points from solved questions, ranked by total points, then by solve time (when the last-solved question was first solved, from the start of the round). Coins are never points: what someone paid for a question makes no difference to their place."
      />
      {notYet ? (
        <Alert variant="info">
          <Icon.Info />
          <AlertTitle>Phase 2 has not started</AlertTitle>
          <AlertDescription>
            This board fills once the selection is made and the first auction opens. Until then the one that matters is{" "}
            <Link href="/admin/leaderboard/phase1" className="font-semibold text-brand-deep hover:underline">
              Phase 1
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : (
        <Section padded={false}>
          <Phase2Standings rows={data?.phase2 ?? null} />
        </Section>
      )}
    </PageBody>
  );
}
