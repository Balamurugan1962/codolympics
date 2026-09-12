"use client";

import { useEffect, useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { api } from "@/lib/client";

type Board = { mode: string; frozen_at: string | null; standings: { participant_id: string; name: string; score: number; solved: number; total_time_ms: number; rank: number }[] };

export default function LeaderboardPage() {
  const { state, lastEvent } = useContest();
  const [board, setBoard] = useState<Board | null>(null);
  useEffect(() => { void api.get<Board>("/api/leaderboard").then(setBoard); }, [lastEvent?.name === "leaderboard" ? lastEvent.at : 0]);
  if (!board) return null;

  if (board.mode === "hidden") return <Alert tone="info" title="Leaderboard hidden">The organisers have hidden standings for this contest.</Alert>;

  return (
    <div className="space-y-4">
      {board.mode === "frozen" && <Alert tone="warning" title="Leaderboard frozen">Standings shown as of {board.frozen_at ? new Date(board.frozen_at).toLocaleTimeString() : "the freeze"}. Later results are not reflected.</Alert>}
      <Card>
        <CardHeader title="Standings" />
        <Table>
          <thead><tr><Th>Rank</Th><Th>Participant</Th><Th>Score</Th><Th>Solved</Th><Th>Total solve time</Th></tr></thead>
          <tbody>
            {board.standings.map((s) => (
              <tr key={s.participant_id} className={s.participant_id === state?.viewer.id ? "bg-green-tint" : ""}>
                <Td className="font-semibold">{s.rank}</Td>
                <Td>{s.name}</Td>
                <Td className="font-semibold tabular-nums">{s.score}</Td>
                <Td className="tabular-nums">{s.solved}</Td>
                <Td className="tabular-nums">{fmt(s.total_time_ms)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <p className="text-xs text-faint">Ties: lower total solve time ranks higher; an exact tie is broken by Phase 1 rank.</p>
    </div>
  );
}

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}
