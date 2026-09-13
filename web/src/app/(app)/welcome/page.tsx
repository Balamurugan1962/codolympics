"use client";

/**
 * How the day runs, on one screen.
 *
 * Reachable from the account menu at any time, so someone can check the rules
 * mid-auction without losing their place. Deliberately the same six rules as
 * the waiting screen and no more: a page nobody finishes is a page nobody
 * read, and this is competition time.
 */
import Link from "next/link";

import { RulesGrid } from "@/components/contest/waiting";
import { Icon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

const STEPS = [
  { icon: <Icon.Puzzle size={18} />, title: "Section A · Puzzles", body: "Answer in any order; change anything until it closes." },
  { icon: <Icon.Bug size={18} />, title: "Section B · Hacking", body: "Each given solution is wrong. Send an input that breaks it." },
  { icon: <Icon.Gavel size={18} />, title: "Auction", body: "Bid for problems one at a time. Win one and only you may solve it." },
  { icon: <Icon.Code size={18} />, title: "Coding", body: "Solve what you own. Ties break on total solve time." },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto flex h-[calc(100vh-56px)] max-w-3xl flex-col justify-center overflow-hidden px-6 py-6 animate-fade-in">
      <div className="flex flex-col items-center text-center">
        <Logo inverse={false} size={44} />
        <h1 className="mt-5 text-[27px] font-semibold tracking-[-0.02em] sm:text-[32px]">How the day runs</h1>
        <p className="mt-2.5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          First you prove yourself with puzzles and hacking. Then you bid for the problems you want to solve.
        </p>
      </div>

      <ol className="mt-7 grid gap-3 sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3.5 rounded-lg border bg-card p-4 shadow-xs">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-navy text-brand-bright">{s.icon}</span>
            <div className="min-w-0">
              <div className="text-[14.5px] font-semibold">
                <span className="mr-1.5 text-faint">{i + 1}.</span>
                {s.title}
              </div>
              <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 border-t pt-5">
        <h2 className="mb-4 text-center text-[12px] font-semibold tracking-[0.08em] text-faint uppercase">The rules that matter</h2>
        <RulesGrid />
      </div>

      <div className="mt-6 flex justify-center">
        <Button size="lg" asChild>
          <Link href="/dashboard">
            <Icon.ArrowRight size={15} /> Back to the contest
          </Link>
        </Button>
      </div>
    </div>
  );
}
