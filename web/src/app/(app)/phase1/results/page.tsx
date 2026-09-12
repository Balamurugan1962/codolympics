"use client";

import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Table, Td, Th } from "@/components/ui/table";
import { api, errorMessage } from "@/lib/client";

type Data = {
  standing: { points: number; rank: number; provisional: boolean; advanced: boolean | null } | null;
  puzzles: { question_id: number; title: string; points: number; explain_points: number; grading: string; voided: boolean; auto_score: number | null; manual_score: number | null; explain_score: number | null; comment: string | null; pending: boolean }[];
  hacks: { question_id: number; hacked: boolean | null; valid_input: boolean | null; points_awarded: number }[];
};

/** My own Phase 1 breakdown -- always visible to me once a section closes, whatever the leaderboard setting. */
export default function ResultsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.get<Data>("/api/phase1/results").then(setData).catch((e) => setError(errorMessage(e))); }, []);
  if (error) return <Alert tone="info" title="Not yet">{error}</Alert>;
  if (!data) return null;
  const hackPoints = data.hacks.reduce((s, h) => s + h.points_awarded, 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Phase 1 points" value={data.standing?.points ?? 0} tone="green" />
        <Stat label="Rank" value={data.standing?.rank ?? "—"} />
        <Stat label="Hacking points" value={hackPoints} />
        <Stat label="Status" value={<span className="text-base">{data.standing?.advanced === true ? "Advancing" : data.standing?.advanced === false ? "Not selected" : data.standing?.provisional ? "Provisional" : "Final"}</span>} />
      </div>
      <Card>
        <CardHeader title="Section A" />
        <Table>
          <thead><tr><Th>Question</Th><Th>Answer</Th><Th>Reasoning</Th><Th>Note</Th></tr></thead>
          <tbody>{data.puzzles.map((p) => (
            <tr key={p.question_id}>
              <Td>{p.title}{p.voided && <Badge tone="grey" className="ml-2">voided</Badge>}</Td>
              <Td className="tabular-nums">{p.grading === "manual" ? (p.manual_score ?? "pending") : (p.auto_score ?? (p.pending ? "pending" : 0))} / {p.points}</Td>
              <Td className="tabular-nums">{p.explain_points ? `${p.explain_score ?? "pending"} / ${p.explain_points}` : "—"}</Td>
              <Td className="text-muted">{p.comment ?? ""}</Td>
            </tr>
          ))}</tbody>
        </Table>
      </Card>
    </div>
  );
}
