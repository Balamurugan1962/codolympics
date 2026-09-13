"use client";

/**
 * Home. Answers "what do I do now?" with one button, then shows what you own,
 * how you stand, and what the organisers have said.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useContest } from "@/components/contest-provider";
import { Countdown } from "@/components/countdown";
import { Icon } from "@/components/icons";
import { LocalTime } from "@/components/local-time";
import { Markdown } from "@/components/markdown";
import { PHASE_LABEL } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageBody, Section } from "@/components/ui/page";
import { Stat, StatRow } from "@/components/ui/stat";
import { api } from "@/lib/client";

export default function HomePage() {
  const { state, refresh } = useContest();
  const router = useRouter();

  useEffect(() => {
    try { if (!localStorage.getItem("welcomed") && state?.viewer.role === "participant") router.replace("/welcome"); } catch { /* fine */ }
  }, [router, state?.viewer.role]);

  if (!state) return null;
  const { contest, me, questions = [], announcements, notifications = [], viewer, auction, rank } = state;
  const phase = contest.phase;
  const now = whatNow(phase, { auctionTitle: auction?.lot?.title, questions, advanced: me?.advanced ?? false });
  const inPhase2 = ["auction1", "coding1", "auction2", "final", "ended"].includes(phase);

  return (
    <PageBody className="animate-fade-in">
      <div className="space-y-5">
        <section className="overflow-hidden rounded-box border border-green/30 bg-card">
          <div className="h-1 bg-green" />
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-green-dark">Now · {PHASE_LABEL[phase]}</div>
              <h1 className="mt-1 text-[20px] font-semibold leading-tight sm:text-[22px]">{now.title}</h1>
              <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">{now.body}</p>
              {contest.phase_ends_at && <p className="mt-2.5 flex items-center gap-1.5 text-[13px] text-muted-foreground"><Icon.Clock size={14} /> <Countdown until={contest.phase_ends_at} className="font-semibold text-ink" /> remaining</p>}
            </div>
            {now.cta && <Link href={now.cta.href} className="shrink-0"><Button size="lg">now.cta.icon {now.cta.label}</Button></Link>}
          </div>
        </section>

        {notifications.length > 0 && (
          <Section title={<span className="flex items-center gap-2"><Icon.Bell size={15} /> For you</span>} actions={<Button size="sm" variant="ghost" onClick={async () => { await api.post("/api/notifications/read"); await refresh(); }}>Mark read</Button>} className="border-blue/30">
            <ul className="space-y-2 text-[13px]">{notifications.map((n) => <li key={n.id} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue" /><Markdown>{n.body_md}</Markdown></li>)}</ul>
          </Section>
        )}

        <StatRow cols={4}>
          <Stat label="Balance" value={me ? me.balance.toLocaleString() : "—"} tone="success" icon={<Icon.Coins size={13} />} hint={phase.startsWith("auction") ? "available to bid" : "spend on hints"} />
          <Stat label="Questions" value={questions.length} icon={<Icon.Code size={13} />} hint={`${questions.filter((q) => q.progress === "solved").length} solved`} />
          <Stat label="Rank" value={rank ? `#${rank.rank}` : "—"} icon={<Icon.Trophy size={13} />} hint={rank ? `${rank.score} points` : contest.leaderboard_mode === "hidden" ? "leaderboard hidden" : "no standings yet"} />
          <Stat label="Time left" value={<Countdown until={contest.phase_ends_at} />} icon={<Icon.Clock size={13} />} hint={contest.phase_ends_at ? "in this round" : "no deadline running"} />
        </StatRow>

        {inPhase2 && (
          <Section title="My questions" description="Only you can attempt these. Open one to read the statement and write code." padded={false}
            actions={phase.startsWith("auction") && <Link href="/auction"><Button size="sm" variant="outline"><Icon.Gavel size={14} /> Auction</Button></Link>}>
            {viewer.role === "participant" && !me?.advanced ? (
              <EmptyState icon={<Icon.Lock size={18} />} title="You were not selected for Phase 2" body="Bidding and submitting are not available. You can still follow the leaderboard." action={<Link href="/leaderboard"><Button variant="outline" size="sm">Leaderboard</Button></Link>} />
            ) : questions.length === 0 ? (
              <EmptyState icon={<Icon.Gavel size={18} />} title="You don't own a question yet" body="Questions are won at auction. Lose every bid and there will be nothing to solve — bid with that in mind." action={phase.startsWith("auction") ? <Link href="/auction"><Button size="sm">Go to the auction</Button></Link> : undefined} />
            ) : (
              <ul className="divide-y divide-line">
                {questions.map((q) => (
                  <li key={q.id}>
                    <Link href={`/question/${q.id}`} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-page">
                      <ProgressDot progress={q.progress} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-semibold">{q.title}</div>
                        <div className="text-[11.5px] text-faint">bought for {q.price_paid} · {q.attempts} attempt{q.attempts === 1 ? "" : "s"}{q.progress === "solved" ? " · solved" : ""}</div>
                      </div>
                      <div className="hidden items-center gap-2 sm:flex">
                        <Badge variant={q.difficulty === "hard" ? "destructive" : q.difficulty === "medium" ? "warning" : "success"}>{q.difficulty}</Badge>
                        <Badge variant="neutral">{q.score} pts</Badge>
                        {q.status === "void" && <Badge variant="destructive">voided</Badge>}
                      </div>
                      <Icon.ChevronRight size={16} className="text-faint" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {announcements.length > 0 && (
          <Section title="Announcements" padded={false}>
            <ul className="divide-y divide-line">{announcements.map((a) => (
              <li key={a.id} className="px-5 py-3 text-[13px]"><div className="mb-1 text-[11px] text-faint"><LocalTime iso={a.createdAt} /></div><Markdown>{a.bodyMd}</Markdown></li>
            ))}</ul>
          </Section>
        )}
      </div>
    </PageBody>
  );
}

export function ProgressDot({ progress }: { progress: string }) {
  const map: Record<string, [string, string]> = { solved: ["bg-green", "Solved"], judging: ["bg-blue animate-pulse", "Judging"], attempted: ["bg-amber-bg", "Attempted"], unattempted: ["bg-line-2", "Not attempted"] };
  const [cls, label] = map[progress] ?? map.unattempted;
  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cls}`} title={label} aria-label={label} />;
}

function whatNow(phase: string, ctx: { auctionTitle?: string; questions: { id: string; title: string; progress: string }[]; advanced: boolean }) {
  const next = ctx.questions.find((q) => q.progress !== "solved");
  switch (phase) {
    case "registration": return { title: "You're registered", body: "Phase 1 starts when the organisers open it. Read the rules while you wait.", cta: { href: "/welcome", label: "Read the rules", icon: <Icon.Info size={16} /> } };
    case "p1_puzzles": return { title: "Section A is open — logical puzzles", body: "Answer in any order and change any answer until the section closes. Press Finish when you're done to record your time.", cta: { href: "/phase1/puzzles", label: "Answer the puzzles", icon: <Icon.Puzzle size={16} /> } };
    case "p1_hacking": return { title: "Section B is open — hacking", body: "Each solution is wrong somewhere. Find an input that breaks it. The first hack on each solution scores.", cta: { href: "/phase1/hacking", label: "Start hacking", icon: <Icon.Bug size={16} /> } };
    case "review": return { title: "Phase 1 is being reviewed", body: ctx.advanced ? "You have been selected for Phase 2. The auction opens when the organisers start it." : "Evaluators are grading and the organisers will select who advances. Your own results are visible now.", cta: { href: "/phase1/results", label: "My results", icon: <Icon.List size={16} /> } };
    case "auction1": case "auction2": return { title: ctx.auctionTitle ? `Bidding on: ${ctx.auctionTitle}` : "The auction is open", body: "Questions are offered one at a time. Every bid restarts the countdown — bidding last does not win. You can also keep coding.", cta: { href: "/auction", label: "Join the auction", icon: <Icon.Gavel size={16} /> } };
    case "coding1": case "final": return next
      ? { title: `Solve: ${next.title}`, body: "Submit as often as you like — wrong answers cost nothing. Hints can be bought at any time.", cta: { href: `/question/${next.id}`, label: "Open the question", icon: <Icon.Code size={16} /> } }
      : ctx.questions.length ? { title: "Everything you own is solved", body: "Nothing left to attempt. Watch the leaderboard, or buy more in the next auction.", cta: { href: "/leaderboard", label: "Leaderboard", icon: <Icon.Trophy size={16} /> } }
      : { title: "You own no questions", body: "There is nothing to solve this round. Bid in the next auction.", cta: null };
    default: return { title: "The contest has ended", body: "Thank you for taking part. Final standings are on the leaderboard.", cta: { href: "/leaderboard", label: "Final standings", icon: <Icon.Trophy size={16} /> } };
  }
}
