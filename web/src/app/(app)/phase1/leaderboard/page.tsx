"use client";

import { useEffect, useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Table, Td, Th } from "@/components/ui/table";
import { api } from "@/lib/client";

type Board = { mode: string; selection_basis?: string; standings: { participant_id: string; name: string; points: number; provisional: boolean; rank: number; advanced?: boolean | null; submitted_at?: string | null }[] };

export default function Phase1LeaderboardPage() {
  const { state, lastEvent } = useContest();
  const [board, setBoard] = useState<Board | null>(null);
  const bump = lastEvent?.name === "leaderboard" ? lastEvent.at : 0;
  useEffect(() => { void api.get<Board>("/api/phase1/leaderboard").then(setBoard); }, [bump]);
  const me = state?.viewer.id;
  return (
    <div className="animate-fade-in">
      <PageHeader title="Phase 1 standings" description="Total points across both sections. Ties go to the earlier submission time." />
      {!board ? <CardSkeleton lines={6} /> : board.mode === "hidden" && state?.viewer.role === "participant" ? (
        <EmptyState icon={<Icon.Eye size={22} />} title="Standings are hidden" body="The organisers will reveal them when Phase 1 closes." />
      ) : (
        <div className="space-y-3">
          {board.selection_basis && <Alert tone="info" title="How selection works">{board.selection_basis}</Alert>}
          <Card>
            <Table>
              <thead><tr><Th className="w-16">Rank</Th><Th>Participant</Th><Th className="text-right">Points</Th><Th className="hidden sm:table-cell">Submitted</Th><Th></Th></tr></thead>
              <tbody>{board.standings.map((s) => (
                <tr key={s.participant_id} className={s.participant_id === me ? "bg-green-tint/60" : ""}>
                  <Td className="font-semibold">{s.rank ? `#${s.rank}` : "—"}</Td><Td>{s.name}{s.participant_id === me && <span className="ml-1 text-xs text-green-dark">(you)</span>}</Td>
                  <Td className="text-right font-semibold tabular-nums">{s.points}{s.provisional && <span className="ml-1 text-xs text-faint" title="some items not yet graded">*</span>}</Td>
                  <Td className="hidden text-faint sm:table-cell">{s.submitted_at ? new Date(s.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</Td>
                  <Td>{s.advanced === true ? <Badge tone="green">advancing</Badge> : s.advanced === false ? <Badge tone="grey">not selected</Badge> : null}</Td>
                </tr>
              ))}</tbody>
            </Table>
          </Card>
          <p className="text-xs text-faint">* provisional — some items are still being graded.</p>
        </div>
      )}
    </div>
  );
}
