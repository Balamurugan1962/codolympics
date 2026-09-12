"use client";

import Link from "next/link";

import { useContest } from "@/components/contest-provider";
import { Countdown } from "@/components/countdown";
import { Markdown } from "@/components/markdown";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";

export default function DashboardPage() {
  const { state } = useContest();
  if (!state) return null;
  const { contest, me, questions = [], announcements, notifications = [], viewer } = state;
  const phase = contest.phase;
  const inPhase1 = ["registration", "p1_puzzles", "p1_hacking", "review"].includes(phase);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Balance" value={me ? me.balance.toLocaleString() : "—"} tone="green" />
        <Stat label="Phase" value={<span className="text-base">{label(phase)}</span>} />
        <Stat label="Time remaining" value={<Countdown until={contest.phase_ends_at} />} />
        <Stat label="Questions owned" value={questions.length} />
      </div>

      {notifications.length > 0 && (
        <Alert tone="info" title="For you">
          <ul className="space-y-1">{notifications.map((n) => <li key={n.id}><Markdown>{n.body_md}</Markdown></li>)}</ul>
        </Alert>
      )}

      {inPhase1 ? (
        <Card>
          <CardHeader title="Phase 1 — Qualifying round" />
          <CardBody className="space-y-3 text-sm">
            {phase === "registration" && <p>Registration is open. Phase 1 has not started yet — wait for the organisers.</p>}
            {phase === "p1_puzzles" && <p>Section A is open: <Link href="/phase1/puzzles" className="font-semibold text-green-dark">answer the logical puzzles</Link>. You may revise any answer until the section closes.</p>}
            {phase === "p1_hacking" && <p>Section B is open: <Link href="/phase1/hacking" className="font-semibold text-green-dark">find inputs that break the given solutions</Link>.</p>}
            {phase === "review" && <p>Phase 1 has closed. The organisers are reviewing results and selecting who advances. {me?.advanced ? <strong className="text-green-dark">You have been selected for Phase 2.</strong> : null}</p>}
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader title="My questions" action={<Link href="/auction" className="text-sm font-semibold text-green-dark">Go to auction →</Link>} />
          <CardBody>
            {!me?.advanced && viewer.role === "participant" ? (
              <Alert tone="warning">You were not selected for Phase 2, so bidding and submitting are not available. You can still see the leaderboard.</Alert>
            ) : questions.length === 0 ? (
              <p className="text-sm text-muted">You do not own any questions yet. Win them at auction — and remember: lose every bid and you will have nothing to solve.</p>
            ) : (
              <ul className="divide-y divide-line">
                {questions.map((q) => (
                  <li key={q.id} className="flex items-center justify-between py-3">
                    <div>
                      <Link href={`/question/${q.id}`} className="font-semibold text-ink hover:text-green-dark">{q.title}</Link>
                      <div className="mt-0.5 text-xs text-faint">{q.id} · bought for {q.price_paid}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={q.difficulty === "hard" ? "red" : q.difficulty === "medium" ? "amber" : "green"}>{q.difficulty}</Badge>
                      <Badge tone="grey">{q.score} pts</Badge>
                      {q.status === "void" && <Badge tone="red">voided</Badge>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}

      {announcements.length > 0 && (
        <Card>
          <CardHeader title="Announcements" />
          <CardBody>
            <ul className="space-y-3">{announcements.map((a) => (
              <li key={a.id} className="text-sm"><div className="text-xs text-faint">{new Date(a.createdAt).toLocaleTimeString()}</div><Markdown>{a.bodyMd}</Markdown></li>
            ))}</ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function label(p: string) {
  return ({ registration: "Registration", p1_puzzles: "Puzzles", p1_hacking: "Hacking", review: "Review", auction1: "Auction 1", coding1: "Coding 1", auction2: "Auction 2", final: "Final", ended: "Ended" } as Record<string, string>)[p] ?? p;
}
