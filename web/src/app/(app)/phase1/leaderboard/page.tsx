"use client";

import { useEffect, useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { api } from "@/lib/client";

type Board = { mode: string; selection_basis?: string; standings: { participant_id: string; name: string; points: number; provisional: boolean; rank: number; advanced?: boolean | null; submitted_at?: string | null }[] };

export default function Phase1LeaderboardPage() {
  const { state, lastEvent } = useContest();
  const [board, setBoard] = useState<Board | null>(null);
  useEffect(() => { void api.get<Board>("/api/phase1/leaderboard").then(setBoard); }, [lastEvent?.name === "leaderboard" ? lastEvent.at : 0]);
  if (!board) return null;
  if (board.mode === "hidden" && state?.viewer.role === "participant") return <Alert tone="info" title="Standings hidden">The organisers have hidden Phase 1 standings.</Alert>;
  return (
    <div className="space-y-4">
      {board.selection_basis && <Alert tone="info" title="How selection works">{board.selection_basis}</Alert>}
      <Card>
        <CardHeader title="Phase 1 standings" />
        <Table>
          <thead><tr><Th>Rank</Th><Th>Participant</Th><Th>Points</Th><Th>Submitted</Th><Th></Th></tr></thead>
          <tbody>{board.standings.map((s) => (
            <tr key={s.participant_id} className={s.participant_id === state?.viewer.id ? "bg-green-tint" : ""}>
              <Td className="font-semibold">{s.rank || "—"}</Td><Td>{s.name}</Td>
              <Td className="tabular-nums font-semibold">{s.points}{s.provisional && <span className="ml-1 text-xs text-faint" title="some items not yet graded">*</span>}</Td>
              <Td className="text-faint">{s.submitted_at ? new Date(s.submitted_at).toLocaleTimeString() : "—"}</Td>
              <Td>{s.advanced === true ? <Badge tone="green">advancing</Badge> : s.advanced === false ? <Badge tone="grey">not selected</Badge> : null}</Td>
            </tr>
          ))}</tbody>
        </Table>
      </Card>
      <p className="text-xs text-faint">Ties are broken by the earlier submission time. * provisional — some items are still being graded.</p>
    </div>
  );
}
