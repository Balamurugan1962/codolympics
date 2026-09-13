"use client";

/**
 * The two leaderboards, as organisers see them.
 *
 * Deliberately not the participant view: this ignores the hidden/frozen
 * setting, because hiding the board from competitors is not a reason to hide
 * it from the people running the day. Every participant appears, including the
 * ones on zero — "who has not scored yet" is the question these get asked.
 *
 * Every row opens that person's full record.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { LocalTime } from "@/components/local-time";
import { Badge, StatusDot } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/field";
import { Section, Toolbar } from "@/components/ui/page";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

export type P1Row = {
  participant_id: string;
  name: string;
  points: number;
  provisional: boolean;
  submitted_at: string | null;
  disqualified: boolean;
  advanced: boolean | null;
  rank: number;
};
export type P2Row = {
  participant_id: string;
  name: string;
  score: number;
  solved: number;
  total_time_ms: number;
  phase1_rank: number | null;
  rank: number;
};

export function useStandings(pollMs = 10_000) {
  const [data, setData] = useState<{ phase1: P1Row[]; phase2: P2Row[] } | null>(null);
  const load = useCallback(async () => setData(await api.get<{ phase1: P1Row[]; phase2: P2Row[] }>("/api/admin/leaderboard")), []);
  useEffect(() => {
    void load();
    if (!pollMs) return;
    const t = setInterval(load, pollMs);
    return () => clearInterval(t);
  }, [load, pollMs]);
  return { data, reload: load };
}

/** 1st, 2nd and 3rd are worth spotting at a glance; the rest are just numbers. */
function Rank({ rank }: { rank: number }) {
  if (rank === 0) return <span className="text-faint">—</span>;
  if (rank > 3) return <span className="tabular-nums">#{rank}</span>;
  return (
    <Badge variant={rank === 1 ? "default" : "neutral"} className="tabular-nums">
      #{rank}
    </Badge>
  );
}

function duration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(s % 60).padStart(2, "0")}s`;
}

export function Phase1Standings({ rows, compact = false }: { rows: P1Row[] | null; compact?: boolean }) {
  const [filter, setFilter] = useState("");
  if (!rows) return <TableSkeleton rows={compact ? 5 : 8} cols={4} />;
  if (rows.length === 0) {
    return <EmptyState compact icon={<Icon.Trophy />} title="Nobody is registered yet" body="The board fills as people sign up and answer." />;
  }
  const shown = rows.filter((r) => !filter || r.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <>
      {!compact && (
        <Toolbar
          actions={
            <span className="text-[12px] text-muted-foreground">
              {rows.filter((r) => r.provisional).length} provisional · {rows.filter((r) => r.disqualified).length} disqualified
            </span>
          }
        >
          <SearchInput className="w-full sm:w-64" placeholder="Find a name" value={filter} onChange={(e) => setFilter(e.target.value)} onClear={() => setFilter("")} />
        </Toolbar>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16 text-right">Rank</TableHead>
            <TableHead>Participant</TableHead>
            <TableHead className="text-right">Points</TableHead>
            {!compact && <TableHead className="hidden sm:table-cell">Finished</TableHead>}
            {!compact && <TableHead>Status</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {(compact ? shown.slice(0, 10) : shown).map((r) => (
            <TableRow key={r.participant_id} className={r.disqualified ? "opacity-60" : ""}>
              <TableCell className="text-right">
                <Rank rank={r.disqualified ? 0 : r.rank} />
              </TableCell>
              <TableCell>
                <Link href={`/admin/participants/${r.participant_id}`} className="font-medium hover:text-brand-dark hover:underline">
                  {r.name}
                </Link>
                {r.advanced === true && <Badge variant="success" className="ml-2">advanced</Badge>}
                {r.advanced === false && <Badge variant="neutral" className="ml-2">not selected</Badge>}
              </TableCell>
              <TableCell className={cn("text-right font-semibold tabular-nums", r.points === 0 && "text-faint")}>
                {r.points}
                {r.provisional && <span className="ml-1 text-[11px] font-normal text-amber">*</span>}
              </TableCell>
              {!compact && (
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {r.submitted_at ? <LocalTime iso={r.submitted_at} /> : <span className="text-faint">never finished</span>}
                </TableCell>
              )}
              {!compact && (
                <TableCell>
                  {r.disqualified ? (
                    <StatusDot tone="destructive">Disqualified</StatusDot>
                  ) : r.provisional ? (
                    <StatusDot tone="review">Provisional</StatusDot>
                  ) : (
                    <StatusDot tone="success">Final</StatusDot>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!compact && rows.some((r) => r.provisional) && (
        <p className="border-t px-4 py-2.5 text-[11.5px] text-muted-foreground">
          <span className="font-semibold text-amber">*</span> provisional: something is still with an evaluator, or a validator errored.
        </p>
      )}
    </>
  );
}

export function Phase2Standings({ rows, compact = false }: { rows: P2Row[] | null; compact?: boolean }) {
  const [filter, setFilter] = useState("");
  if (!rows) return <TableSkeleton rows={compact ? 5 : 8} cols={5} />;
  if (rows.length === 0) {
    return (
      <EmptyState
        compact
        icon={<Icon.Trophy />}
        title="Nobody has reached Phase 2 yet"
        body="The board fills once Phase 1 selection is made and the auction opens."
      />
    );
  }
  const shown = rows.filter((r) => !filter || r.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <>
      {!compact && (
        <Toolbar
          actions={
            <span className="text-[12px] text-muted-foreground">
              {rows.filter((r) => r.score > 0).length} of {rows.length} have scored
            </span>
          }
        >
          <SearchInput className="w-full sm:w-64" placeholder="Find a name" value={filter} onChange={(e) => setFilter(e.target.value)} onClear={() => setFilter("")} />
        </Toolbar>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16 text-right">Rank</TableHead>
            <TableHead>Participant</TableHead>
            <TableHead className="text-right">Score</TableHead>
            <TableHead className="text-right">Solved</TableHead>
            {!compact && <TableHead className="hidden text-right sm:table-cell">Total solve time</TableHead>}
            {!compact && <TableHead className="hidden text-right md:table-cell">Phase 1</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {(compact ? shown.slice(0, 10) : shown).map((r) => (
            <TableRow key={r.participant_id}>
              <TableCell className="text-right">
                <Rank rank={r.rank} />
              </TableCell>
              <TableCell>
                <Link href={`/admin/participants/${r.participant_id}`} className="font-medium hover:text-brand-dark hover:underline">
                  {r.name}
                </Link>
              </TableCell>
              <TableCell className={cn("text-right font-semibold tabular-nums", r.score === 0 && "text-faint")}>{r.score}</TableCell>
              <TableCell className={cn("text-right tabular-nums", r.solved === 0 && "text-faint")}>{r.solved}</TableCell>
              {!compact && (
                <TableCell className="hidden text-right tabular-nums sm:table-cell">
                  {r.solved ? duration(r.total_time_ms) : <span className="text-faint">—</span>}
                </TableCell>
              )}
              {!compact && (
                <TableCell className="hidden text-right tabular-nums md:table-cell">
                  {r.phase1_rank ? `#${r.phase1_rank}` : <span className="text-faint">—</span>}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!compact && (
        <p className="border-t px-4 py-2.5 text-[11.5px] text-muted-foreground">
          Ties break on total solve time, measured from the moment each question was won, then on Phase 1 rank.
        </p>
      )}
    </>
  );
}

/** The board as a card, for the dashboard. */
export function StandingsCard({
  phase,
  rows1,
  rows2,
}: {
  phase: "phase1" | "phase2";
  rows1: P1Row[] | null;
  rows2: P2Row[] | null;
}) {
  const href = phase === "phase1" ? "/admin/leaderboard/phase1" : "/admin/leaderboard/phase2";
  const count = phase === "phase1" ? rows1?.length : rows2?.length;
  return (
    <Section
      title={phase === "phase1" ? "Phase 1 standings" : "Phase 2 standings"}
      description={count ? `Top 10 of ${count}. Everyone is listed on the full board.` : undefined}
      actions={
        <Link href={href} className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-dark hover:underline">
          Full board <Icon.ChevronRight size={13} />
        </Link>
      }
      padded={false}
    >
      {phase === "phase1" ? <Phase1Standings rows={rows1} compact /> : <Phase2Standings rows={rows2} compact />}
    </Section>
  );
}
