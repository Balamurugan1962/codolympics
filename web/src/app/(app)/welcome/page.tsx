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
import { Mark } from "@/components/logo";
import { Button } from "@/components/ui/button";

const STEPS = [
  { icon: <Icon.Puzzle size={16} />, title: "Section A · Puzzles", body: "Answer in any order; change anything until it closes." },
  { icon: <Icon.Bug size={16} />, title: "Section B · Hacking", body: "Each given solution is wrong. Send an input that breaks it." },
  { icon: <Icon.Gavel size={16} />, title: "Auction", body: "Bid for problems one at a time. Win one and only you may solve it." },
  { icon: <Icon.Code size={16} />, title: "Coding", body: "Solve what you own. Ties break on total solve time." },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto flex h-[calc(100vh-56px)] max-w-3xl flex-col justify-center overflow-hidden px-6 py-6 animate-fade-in">
      <div className="flex flex-col items-center text-center">
        <Mark size={36} />
        <h1 className="mt-3.5 text-[22px] font-semibold tracking-[-0.02em] sm:text-[26px]">How the day runs</h1>
        <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-muted-foreground">
          First you prove yourself with puzzles and hacking. Then you bid for the problems you want to solve.
        </p>
      </div>

      <ol className="mt-6 grid gap-2.5 sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3 rounded-lg border bg-card p-3 shadow-xs">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-navy text-brand-bright">{s.icon}</span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold">
                <span className="mr-1.5 text-faint">{i + 1}.</span>
                {s.title}
              </div>
              <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 border-t pt-5">
        <h2 className="mb-3 text-center text-[11px] font-semibold tracking-[0.08em] text-faint uppercase">The rules that matter</h2>
        <RulesGrid />
      </div>

      <div className="mt-6 flex justify-center">
        <Button asChild>
          <Link href="/dashboard">
            <Icon.ArrowRight size={15} /> Back to the contest
          </Link>
        </Button>
      </div>
    </div>
  );
}
