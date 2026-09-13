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

type Row = { participant_id: string; name: string; score: number; solved: number; total_time_ms: number; rank: number };
type Board = { mode: string; frozen_at: string | null; standings: Row[] };

export default function LeaderboardPage() {
  const { state, lastEvent } = useContest();
  const [board, setBoard] = useState<Board | null>(null);
  const bump = lastEvent?.name === "leaderboard" ? lastEvent.at : 0;
  useEffect(() => { void api.get<Board>("/api/leaderboard").then(setBoard); }, [bump]);

  const me = state?.viewer.id;
  const mine = board?.standings.find((s) => s.participant_id === me);

  return (
    <PageBody className="animate-fade-in">
      <PageHeader title="Leaderboard" description="Score first; ties broken by the lower total solve time, then by Phase 1 rank." />
      {!board ? <CardSkeleton lines={6} /> : board.mode === "hidden" ? (
        <EmptyState icon={<Icon.Eye size={20} />} title="Standings are hidden" body="The organisers have chosen not to show the leaderboard during this contest." />
      ) : (
        <div className="space-y-3">
          {board.mode === "frozen" && <Alert variant="warning"><AlertTitle>Leaderboard frozen</AlertTitle><AlertDescription>Shown as of {board.frozen_at ? new Date(board.frozen_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "the freeze"}. Results after that are not reflected until it is unfrozen.</AlertDescription></Alert>}
          {mine && (
            <div className="flex items-center gap-4 rounded-box border border-brand/40 bg-brand-tint px-4 py-3 text-[13px]">
              <Icon.Trophy size={18} className="text-brand-deep" />
              <span className="font-semibold">You are #{mine.rank}</span>
              <span className="text-muted-foreground">{mine.score} points · {mine.solved} solved · {fmt(mine.total_time_ms)}</span>
            </div>
          )}
          <Section padded={false}>
            <Table>
              <TableHeader><TableRow><TableHead className="w-16 text-right tabular-nums">Rank</TableHead><TableHead>Participant</TableHead><TableHead className="text-right tabular-nums">Score</TableHead><TableHead className="hidden sm:table-cell text-right tabular-nums">Solved</TableHead><TableHead className="hidden md:table-cell text-right tabular-nums">Total solve time</TableHead></TableRow></TableHeader>
              <TableBody>
                {board.standings.map((s) => (
                  <TableRow key={s.participant_id} data-state={s.participant_id === me ? "selected" : undefined}>
                    <TableCell className="font-semibold text-right tabular-nums">{s.rank <= 3 ? <Badge variant={s.rank === 1 ? "success" : "neutral"}>#{s.rank}</Badge> : `#${s.rank}`}</TableCell>
                    <TableCell className="font-medium">{s.name}{s.participant_id === me && <span className="ml-1.5 text-[11.5px] font-semibold text-brand-deep">you</span>}</TableCell>
                    <TableCell className="font-semibold text-right tabular-nums">{s.score}</TableCell>
                    <TableCell className="hidden sm:table-cell text-right tabular-nums">{s.solved}</TableCell>
                    <TableCell className="hidden md:table-cell text-right tabular-nums">{fmt(s.total_time_ms)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {board.standings.length === 0 && <EmptyState compact title="No standings yet" body="Scores appear once someone solves a question." />}
          </Section>
        </div>
      )}
    </PageBody>
  );
}

function fmt(ms: number) { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`; }
