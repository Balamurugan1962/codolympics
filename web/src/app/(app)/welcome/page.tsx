"use client";

/** First sign-in: what Codolympics is, how the day runs, the rules that matter. One button. */
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/icons";
import { Mark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";

const RULES = [
  ["Two phases", "Phase 1 qualifies you: logical puzzles, then hacking. Phase 2 is the auction contest."],
  ["Own it to solve it", "In Phase 2, questions are auctioned one at a time. Only the owner may attempt it — exactly one person per question."],
  ["Same money for everyone", "Every finalist starts Phase 2 with an identical balance. Bids rise by a fixed step. Money is not score."],
  ["Solving is all-or-nothing", "A solved question earns its full score. Wrong submissions cost nothing; ties break on total solve time."],
  ["Hidden tests stay hidden", "You see sample tests and the number of the failing test — never its contents, at any price. Hints are author-written text."],
  ["One seat, one session", "Signing in elsewhere ends your previous session. Your code and answers are saved on the server as you type."],
];

export default function WelcomePage() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-3xl animate-fade-in">
      <div className="mb-8 flex flex-col items-center text-center">
        <Mark size={56} />
        <h1 className="mt-4 text-3xl font-semibold">Welcome to Codolympics</h1>
        <p className="mt-2 max-w-xl text-muted">A coding competition where you first prove yourself with puzzles, then bid for the problems you want to solve. Here is everything you need to know.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {RULES.map(([t, b]) => (
          <Card key={t}><CardBody className="flex gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-tint text-green-dark"><Icon.Check size={14} strokeWidth={3} /></span>
            <div><div className="font-semibold">{t}</div><div className="mt-0.5 text-sm text-muted">{b}</div></div>
          </CardBody></Card>
        ))}
      </div>
      <div className="mt-8 flex flex-col items-center gap-3">
        <Button size="lg" icon={<Icon.ArrowRight />} onClick={() => { try { localStorage.setItem("welcomed", "1"); } catch { /* fine */ } router.push("/dashboard"); }}>I&apos;m ready</Button>
        <Link href="/dashboard" className="text-sm text-faint hover:text-muted">Skip</Link>
      </div>
    </div>
  );
}
