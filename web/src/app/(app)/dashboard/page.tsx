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
import { Markdown } from "@/components/markdown";
import { PHASE_LABEL } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Stat } from "@/components/ui/stat";
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

  return (
    <div className="space-y-5 animate-fade-in">
      {/* NOW: the one thing to do */}
      <Card className="border-green/40 bg-gradient-to-br from-green-tint to-card">
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-green-dark">Now · {PHASE_LABEL[phase]}</div>
            <h1 className="mt-1 text-xl font-semibold">{now.title}</h1>
            <p className="mt-1 text-sm text-muted">{now.body}</p>
            {contest.phase_ends_at && <p className="mt-2 flex items-center gap-1.5 text-sm text-muted"><Icon.Clock /> <Countdown until={contest.phase_ends_at} className="font-semibold text-ink" /> remaining</p>}
          </div>
          {now.cta && <Link href={now.cta.href}><Button size="lg" icon={now.cta.icon} className="whitespace-nowrap">{now.cta.label}</Button></Link>}
        </CardBody>
      </Card>

      {notifications.length > 0 && (
        <Card className="border-blue/30">
          <CardHeader title={<span className="flex items-center gap-2"><Icon.Bell /> For you</span>} action={<Button size="sm" variant="ghost" onClick={async () => { await api.post("/api/notifications/read"); await refresh(); }}>Mark read</Button>} />
          <CardBody><ul className="space-y-2 text-sm">{notifications.map((n) => <li key={n.id} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue" /><Markdown>{n.body_md}</Markdown></li>)}</ul></CardBody>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Balance" value={me ? me.balance.toLocaleString() : "—"} tone="green" icon={<Icon.Coins />} hint={phase.startsWith("auction") ? "available to bid" : "spend on hints"} />
        <Stat label="Questions" value={questions.length} icon={<Icon.Code />} hint={`${questions.filter((q) => q.progress === "solved").length} solved`} />
        <Stat label="Rank" value={rank ? `#${rank.rank}` : "—"} icon={<Icon.Trophy />} hint={rank ? `${rank.score} points` : contest.leaderboard_mode === "hidden" ? "leaderboard hidden" : "no standings yet"} />
        <Stat label="Time left" value={<Countdown until={contest.phase_ends_at} />} icon={<Icon.Clock />} hint={contest.phase_ends_at ? "in this round" : "no deadline running"} />
      </div>

      {["auction1", "coding1", "auction2", "final", "ended"].includes(phase) && (
        <Card>
          <CardHeader title="My questions" description="Only you can attempt these. Open one to read the statement and write code." action={phase.startsWith("auction") && <Link href="/auction"><Button size="sm" variant="secondary" icon={<Icon.Gavel />}>Auction</Button></Link>} />
          {viewer.role === "participant" && !me?.advanced ? (
            <CardBody><EmptyState icon={<Icon.Lock />} title="You were not selected for Phase 2" body="Bidding and submitting are not available. You can still follow the leaderboard." action={<Link href="/leaderboard"><Button variant="secondary" size="sm">Leaderboard</Button></Link>} /></CardBody>
          ) : questions.length === 0 ? (
            <CardBody><EmptyState icon={<Icon.Gavel />} title="You don't own a question yet" body="Questions are won at auction. Lose every bid and there will be nothing to solve — bid with that in mind." action={phase.startsWith("auction") ? <Link href="/auction"><Button size="sm">Go to the auction</Button></Link> : undefined} /></CardBody>
          ) : (
            <ul className="divide-y divide-line">
              {questions.map((q) => (
                <li key={q.id}>
                  <Link href={`/question/${q.id}`} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-page">
                    <ProgressDot progress={q.progress} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{q.title}</div>
                      <div className="text-xs text-faint">{q.id} · bought for {q.price_paid} · {q.attempts} attempt{q.attempts === 1 ? "" : "s"}</div>
                    </div>
                    <div className="hidden items-center gap-2 sm:flex">
                      <Badge tone={q.difficulty === "hard" ? "red" : q.difficulty === "medium" ? "amber" : "green"}>{q.difficulty}</Badge>
                      <Badge tone="grey">{q.score} pts</Badge>
                      {q.status === "void" && <Badge tone="red">voided</Badge>}
                    </div>
                    <Icon.ChevronRight className="text-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {announcements.length > 0 && (
        <Card>
          <CardHeader title="Announcements" />
          <ul className="divide-y divide-line">{announcements.map((a) => (
            <li key={a.id} className="px-4 py-3 text-sm"><div className="mb-1 text-xs text-faint">{new Date(a.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div><Markdown>{a.bodyMd}</Markdown></li>
          ))}</ul>
        </Card>
      )}
    </div>
  );
}

export function ProgressDot({ progress }: { progress: string }) {
  const map: Record<string, [string, string]> = { solved: ["bg-green", "Solved"], judging: ["bg-blue animate-pulse", "Judging"], attempted: ["bg-amber", "Attempted"], unattempted: ["bg-line-2", "Not attempted"] };
  const [cls, label] = map[progress] ?? map.unattempted;
  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cls}`} title={label} aria-label={label} />;
}

function whatNow(phase: string, ctx: { auctionTitle?: string; questions: { id: string; title: string; progress: string }[]; advanced: boolean }) {
  const next = ctx.questions.find((q) => q.progress !== "solved");
  switch (phase) {
    case "registration": return { title: "You're registered", body: "Phase 1 starts when the organisers open it. Read the rules while you wait.", cta: { href: "/welcome", label: "Read the rules", icon: <Icon.Info /> } };
    case "p1_puzzles": return { title: "Section A is open — logical puzzles", body: "Answer in any order and change any answer until the section closes. Press Finish when you're done to record your time.", cta: { href: "/phase1/puzzles", label: "Answer the puzzles", icon: <Icon.Puzzle /> } };
    case "p1_hacking": return { title: "Section B is open — hacking", body: "Each solution is wrong somewhere. Find an input that breaks it. The first hack on each solution scores.", cta: { href: "/phase1/hacking", label: "Start hacking", icon: <Icon.Bug /> } };
    case "review": return { title: "Phase 1 is being reviewed", body: ctx.advanced ? "You have been selected for Phase 2. The auction opens when the organisers start it." : "Evaluators are grading and the organisers will select who advances. Your own results are visible now.", cta: { href: "/phase1/results", label: "My results", icon: <Icon.List /> } };
    case "auction1": case "auction2": return { title: ctx.auctionTitle ? `Bidding on: ${ctx.auctionTitle}` : "The auction is open", body: "Questions are offered one at a time. Every bid restarts the countdown — bidding last does not win. You can also keep coding.", cta: { href: "/auction", label: "Join the auction", icon: <Icon.Gavel /> } };
    case "coding1": case "final": return next
      ? { title: `Solve: ${next.title}`, body: "Submit as often as you like — wrong answers cost nothing. Hints can be bought at any time.", cta: { href: `/question/${next.id}`, label: "Open the question", icon: <Icon.Code /> } }
      : ctx.questions.length ? { title: "Everything you own is solved", body: "Nothing left to attempt. Watch the leaderboard, or buy more in the next auction.", cta: { href: "/leaderboard", label: "Leaderboard", icon: <Icon.Trophy /> } }
      : { title: "You own no questions", body: "There is nothing to solve this round. Bid in the next auction.", cta: null };
    default: return { title: "The contest has ended", body: "Thank you for taking part. Final standings are on the leaderboard.", cta: { href: "/leaderboard", label: "Final standings", icon: <Icon.Trophy /> } };
  }
}
