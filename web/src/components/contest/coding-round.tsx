"use client";

/**
 * A coding round: what you own, and how far through each one you are.
 *
 * Ordered by what is left to do rather than by when it was won — with forty
 * minutes left, "which of these is still unsolved" is the only question worth
 * answering at a glance.
 */
import Link from "next/link";

import { useContest } from "@/components/contest-provider";
import { Countdown } from "@/components/countdown";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageBody, Section } from "@/components/ui/page";
import { Stat, StatRow } from "@/components/ui/stat";
import { cn } from "@/lib/utils";

const PROGRESS: Record<string, { dot: string; label: string; rank: number }> = {
  unattempted: { dot: "bg-line-2", label: "Not started", rank: 0 },
  attempted: { dot: "bg-amber-bg", label: "Attempted", rank: 1 },
  judging: { dot: "bg-blue animate-pulse", label: "Judging", rank: 2 },
  solved: { dot: "bg-green", label: "Solved", rank: 3 },
};

export function CodingRound() {
  const { state } = useContest();
  if (!state) return null;
  const { contest, questions = [], me } = state;

  const mine = [...questions].sort(
    (a, b) => (PROGRESS[a.progress]?.rank ?? 0) - (PROGRESS[b.progress]?.rank ?? 0) || a.title.localeCompare(b.title),
  );
  const solved = mine.filter((q) => q.progress === "solved");
  const common = contest.phase === "final";
  const earned = solved.reduce((s, q) => s + (q.score ?? 0), 0);
  const possible = mine.reduce((s, q) => s + (q.score ?? 0), 0);
  const next = mine.find((q) => q.progress !== "solved");

  return (
    <PageBody className="animate-fade-in">
      <div className="space-y-5">
        <section className="overflow-hidden rounded-md border border-brand/30 bg-card">
          <div className="h-1 bg-brand" />
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold tracking-[0.08em] text-brand-deep uppercase">
                {common ? "Common round" : "Coding round"}
              </div>
              <h1 className="mt-1 text-[20px] leading-tight font-semibold sm:text-[22px]">
                {next ? `Solve: ${next.title}` : mine.length ? (common ? "Everything is solved" : "Everything you own is solved") : common ? "No question is left" : "You own no questions"}
              </h1>
              {!next && (
                <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
                  {mine.length
                    ? common ? "Nothing left to attempt. Watch the leaderboard." : "Nothing left to attempt. Watch the leaderboard, or wait for the next auction."
                    : common ? "Every question was bought in round 1, so none is open in this round." : "There is nothing to solve this round. Losing every bid is a legitimate outcome."}
                </p>
              )}

            </div>
            {next && (
              <Button size="lg" className="shrink-0" asChild>
                <Link href={`/question/${next.id}`}>
                  <Icon.Code size={16} /> Open the question
                </Link>
              </Button>
            )}
          </div>
        </section>

        <StatRow cols={3}>
          <Stat
            label="Solved"
            value={`${solved.length}/${mine.length}`}
            tone={solved.length === mine.length && mine.length > 0 ? "success" : "default"}
            icon={<Icon.Check size={13} />}
            hint={common ? "questions still open" : mine.length ? `${earned} of ${possible} points` : "nothing owned"}
          />
          <Stat label="Coins" value={me ? me.balance.toLocaleString() : "—"} icon={<Icon.Coins size={13} />} hint="spend on hints and powerups" />
          <Stat
            label="Rank"
            value={state.rank ? `#${state.rank.rank}` : "—"}
            icon={<Icon.Trophy size={13} />}
            hint={state.rank ? `${state.rank.score} points` : contest.leaderboard_mode === "hidden" ? "leaderboard hidden" : "no standings yet"}
          />
        </StatRow>

        <Section
          title={common ? "Questions" : "My questions"}
          info="Only you can attempt these. Nobody else can read or solve them. Unsolved ones come first. Wrong submissions cost nothing, and hints can be bought at any time."
          padded={false}
          actions={
            <Button size="sm" variant="ghost" asChild>
              <Link href="/leaderboard">
                <Icon.Trophy size={14} /> Leaderboard
              </Link>
            </Button>
          }
        >
          {mine.length === 0 ? (
            <EmptyState
              icon={<Icon.Gavel />}
              title={common ? "No question is open" : "You don't own a question yet"}
              body={common ? "Every question was bought in round 1." : "Questions are won at auction."}
            />
          ) : (
            <ul className="divide-y">
              {mine.map((q) => {
                const p = PROGRESS[q.progress] ?? PROGRESS.unattempted;
                return (
                  <li key={q.id}>
                    <Link href={`/question/${q.id}`} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/50">
                      <span className={cn("size-2.5 shrink-0 rounded-full", p.dot)} title={p.label} aria-label={p.label} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-semibold">{q.title}</div>
                        <div className="text-[11.5px] text-faint">
                          {q.common ? "" : `bought for ${q.price_paid} coins · `}{q.attempts} attempt{q.attempts === 1 ? "" : "s"}
                          {q.progress === "solved" ? " · solved" : ""}
                        </div>
                      </div>
                      <div className="hidden items-center gap-2 sm:flex">
                        {q.difficulty && (
                          <Badge variant={q.difficulty === "hard" ? "destructive" : q.difficulty === "medium" ? "warning" : "success"}>
                            {q.difficulty}
                          </Badge>
                        )}
                        {q.score !== null && <Badge variant="neutral">{q.score} pts</Badge>}
                        {q.status === "void" && <Badge variant="destructive">voided</Badge>}
                      </div>
                      <Icon.ChevronRight size={16} className="text-faint" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
    </PageBody>
  );
}
