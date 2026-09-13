"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageBody, PageHeader, Section } from "@/components/ui/page";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Stat, StatRow } from "@/components/ui/stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  const pending = <Badge variant="warning">pending</Badge>;
  return (
    <PageBody className="animate-fade-in">
      <PageHeader title="My Phase 1 results" description="Your own breakdown. Items marked pending are still with an evaluator." />
      {error ? <EmptyState icon={<Icon.Clock size={20} />} title="Not available yet" body={error} /> : !data ? <CardSkeleton lines={6} /> : (
        <div className="space-y-4">
          <StatRow cols={4}>
            <Stat label="Total points" value={data.standing?.points ?? 0} tone="success" icon={<Icon.Trophy size={13} />} hint={data.standing?.provisional ? "provisional — grading continues" : "final"} />
            <Stat label="Rank" value={data.standing ? `#${data.standing.rank}` : "—"} icon={<Icon.List size={13} />} />
            <Stat label="Hacking" value={data.hacks.reduce((s, h) => s + h.points_awarded, 0)} icon={<Icon.Bug size={13} />} hint={`${data.hacks.filter((h) => h.hacked).length} successful`} />
            <Stat label="Status" value={<span className="text-[17px]">{data.standing?.advanced === true ? "Advancing" : data.standing?.advanced === false ? "Not selected" : "Awaiting selection"}</span>} icon={<Icon.Flag size={13} />} tone={data.standing?.advanced === true ? "success" : "default"} />
          </StatRow>
          <Section title="Section A · Logical puzzles" padded={false}>
            <Table>
              <TableHeader><TableRow><TableHead>Question</TableHead><TableHead className="text-right tabular-nums">Answer</TableHead><TableHead className="hidden sm:table-cell text-right tabular-nums">Reasoning</TableHead><TableHead className="hidden md:table-cell">Evaluator&apos;s note</TableHead></TableRow></TableHeader>
              <TableBody>{data.puzzles.map((p) => (
                <TableRow key={p.question_id}>
                  <TableCell className="font-medium">{p.title}{p.voided && <Badge variant="neutral" className="ml-2">voided</Badge>}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.grading === "manual" ? (p.manual_score ?? pending) : (p.auto_score ?? (p.pending ? pending : 0))} <span className="text-faint">/ {p.points}</span></TableCell>
                  <TableCell className="hidden sm:table-cell text-right tabular-nums">{p.explain_points ? <>{p.explain_score ?? pending} <span className="text-faint">/ {p.explain_points}</span></> : <span className="text-faint">—</span>}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{p.comment ?? ""}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
            {data.puzzles.length === 0 && <EmptyState compact title="No puzzle answers" body="You did not answer any puzzles." />}
          </Section>
        </div>
      )}
    </PageBody>
  );
}
