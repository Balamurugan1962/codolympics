"use client";

import { useEffect, useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Icon } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageBody, PageHeader, Section } from "@/components/ui/page";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/client";

type Board = { mode: string; selection_basis?: string; standings: { participant_id: string; name: string; points: number; provisional: boolean; rank: number; advanced?: boolean | null; submitted_at?: string | null }[] };

export default function Phase1LeaderboardPage() {
  const { state, lastEvent } = useContest();
  const [board, setBoard] = useState<Board | null>(null);
  const bump = lastEvent?.name === "leaderboard" ? lastEvent.at : 0;
  useEffect(() => { void api.get<Board>("/api/phase1/leaderboard").then(setBoard); }, [bump]);
  const me = state?.viewer.id;
  return (
    <PageBody className="animate-fade-in">
      <PageHeader title="Phase 1 standings" description="Total points across both sections. Ties go to the earlier submission time." />
      {!board ? <CardSkeleton lines={6} /> : board.mode === "hidden" && state?.viewer.role === "participant" ? (
        <EmptyState icon={<Icon.Eye size={20} />} title="Standings are hidden" body="The organisers will reveal them when Phase 1 closes." />
      ) : (
        <div className="space-y-3">
          {board.selection_basis && <Alert variant="info"><AlertTitle>"How selection works"</AlertTitle><AlertDescription>{board.selection_basis}</AlertDescription></Alert>}
          <Section padded={false}>
            <Table>
              <TableHeader><TableRow><TableHead className="w-16 text-right tabular-nums">Rank</TableHead><TableHead>Participant</TableHead><TableHead className="text-right tabular-nums">Points</TableHead><TableHead className="hidden sm:table-cell">Submitted</TableHead><TableHead className="w-32"><span className="sr-only">Decision</span></TableHead></TableRow></TableHeader>
              <TableBody>{board.standings.map((s) => (
                <TableRow key={s.participant_id} data-state={s.participant_id === me ? "selected" : undefined}>
                  <TableCell className="font-semibold text-right tabular-nums">{s.rank ? `#${s.rank}` : "—"}</TableCell>
                  <TableCell className="font-medium">{s.name}{s.participant_id === me && <span className="ml-1.5 text-[11.5px] font-semibold text-green-dark">you</span>}</TableCell>
                  <TableCell className="font-semibold text-right tabular-nums">{s.points}{s.provisional && <span className="ml-1 text-faint" title="some items not yet graded">*</span>}</TableCell>
                  <TableCell className="hidden text-faint sm:table-cell">{s.submitted_at ? new Date(s.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                  <TableCell>{s.advanced === true ? <Badge variant="success">advancing</Badge> : s.advanced === false ? <Badge variant="neutral">not selected</Badge> : null}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
            {board.standings.length === 0 && <EmptyState compact title="No standings yet" />}
          </Section>
          <p className="text-[11.5px] text-faint">* provisional — some items are still being graded.</p>
        </div>
      )}
    </PageBody>
  );
}
