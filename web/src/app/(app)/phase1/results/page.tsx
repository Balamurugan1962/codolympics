"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Stat } from "@/components/ui/stat";
import { Table, Td, Th } from "@/components/ui/table";
import { api, errorMessage } from "@/lib/client";

type Data = {
  standing: { points: number; rank: number; provisional: boolean; advanced: boolean | null } | null;
  puzzles: { question_id: number; title: string; points: number; explain_points: number; grading: string; voided: boolean; auto_score: number | null; manual_score: number | null; explain_score: number | null; comment: string | null; pending: boolean }[];
  hacks: { question_id: number; hacked: boolean | null; valid_input: boolean | null; points_awarded: number }[];
};

export default function ResultsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.get<Data>("/api/phase1/results").then(setData).catch((e) => setError(errorMessage(e))); }, []);
  return (
    <div className="animate-fade-in">
      <PageHeader title="My Phase 1 results" description="Your own breakdown. Items marked pending are still with an evaluator." />
      {error ? <EmptyState icon={<Icon.Clock size={22} />} title="Not available yet" body={error} /> : !data ? <CardSkeleton lines={6} /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Total points" value={data.standing?.points ?? 0} tone="green" icon={<Icon.Trophy />} hint={data.standing?.provisional ? "provisional" : "final"} />
            <Stat label="Rank" value={data.standing ? `#${data.standing.rank}` : "—"} icon={<Icon.List />} />
            <Stat label="Hacking" value={data.hacks.reduce((s, h) => s + h.points_awarded, 0)} icon={<Icon.Bug />} hint={`${data.hacks.filter((h) => h.hacked).length} successful`} />
            <Stat label="Status" value={<span className="text-base">{data.standing?.advanced === true ? "Advancing" : data.standing?.advanced === false ? "Not selected" : "Awaiting selection"}</span>} icon={<Icon.Flag />} tone={data.standing?.advanced === true ? "green" : "ink"} />
          </div>
          <Card>
            <CardHeader title="Section A — Logical puzzles" />
            <Table>
              <thead><tr><Th>Question</Th><Th className="text-right">Answer</Th><Th className="hidden text-right sm:table-cell">Reasoning</Th><Th className="hidden md:table-cell">Evaluator's note</Th></tr></thead>
              <tbody>{data.puzzles.map((p) => (
                <tr key={p.question_id}>
                  <Td>{p.title}{p.voided && <Badge tone="grey" className="ml-2">voided</Badge>}</Td>
                  <Td className="text-right tabular-nums">{p.grading === "manual" ? (p.manual_score ?? <Badge tone="amber">pending</Badge>) : (p.auto_score ?? (p.pending ? <Badge tone="amber">pending</Badge> : 0))} <span className="text-faint">/ {p.points}</span></Td>
                  <Td className="hidden text-right tabular-nums sm:table-cell">{p.explain_points ? <>{p.explain_score ?? <Badge tone="amber">pending</Badge>} <span className="text-faint">/ {p.explain_points}</span></> : "—"}</Td>
                  <Td className="hidden text-muted md:table-cell">{p.comment ?? ""}</Td>
                </tr>
              ))}</tbody>
            </Table>
            {data.puzzles.length === 0 && <div className="p-6 text-center text-sm text-muted">You did not answer any puzzles.</div>}
          </Card>
        </div>
      )}
    </div>
  );
}
