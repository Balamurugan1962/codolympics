"use client";

import { useEffect, useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Icon } from "@/components/icons";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageBody, PageHeader, Section } from "@/components/ui/page";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Table, Td, Th, Tr } from "@/components/ui/table";
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
          {board.selection_basis && <Alert tone="info" title="How selection works">{board.selection_basis}</Alert>}
          <Section padded={false}>
            <Table>
              <thead><tr><Th className="w-16" align="right">Rank</Th><Th>Participant</Th><Th align="right">Points</Th><Th className="hidden sm:table-cell">Submitted</Th><Th className="w-32"><span className="sr-only">Decision</span></Th></tr></thead>
              <tbody>{board.standings.map((s) => (
                <Tr key={s.participant_id} selected={s.participant_id === me}>
                  <Td align="right" className="font-semibold">{s.rank ? `#${s.rank}` : "—"}</Td>
                  <Td className="font-medium">{s.name}{s.participant_id === me && <span className="ml-1.5 text-[11.5px] font-semibold text-green-dark">you</span>}</Td>
                  <Td align="right" className="font-semibold">{s.points}{s.provisional && <span className="ml-1 text-faint" title="some items not yet graded">*</span>}</Td>
                  <Td className="hidden text-faint sm:table-cell">{s.submitted_at ? new Date(s.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</Td>
                  <Td>{s.advanced === true ? <Badge tone="green">advancing</Badge> : s.advanced === false ? <Badge tone="grey">not selected</Badge> : null}</Td>
                </Tr>
              ))}</tbody>
            </Table>
            {board.standings.length === 0 && <EmptyState compact title="No standings yet" />}
          </Section>
          <p className="text-[11.5px] text-faint">* provisional — some items are still being graded.</p>
        </div>
      )}
    </PageBody>
  );
}
