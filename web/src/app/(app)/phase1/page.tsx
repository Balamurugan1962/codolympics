"use client";

/** Phase 1 hub: the two sections, your results, the standings -- each with its current state. */
import Link from "next/link";

import { useContest } from "@/components/contest-provider";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { PageBody, PageHeader } from "@/components/ui/page";

const ORDER = ["registration", "p1_puzzles", "p1_hacking", "review", "auction1", "coding1", "auction2", "final", "ended"];

export default function Phase1Hub() {
  const { state } = useContest();
  if (!state) return null;
  const p = state.contest.phase;
  const after = (k: string) => ORDER.indexOf(p) > ORDER.indexOf(k);
  const cards = [
    { href: "/phase1/puzzles", icon: <Icon.Puzzle size={20} />, title: "Section A · Logical puzzles", body: "Multiple choice, short answers, sequences and lists. Revise until the section closes.", state: p === "p1_puzzles" ? "open" : after("p1_puzzles") ? "closed" : "not yet", done: state.me?.p1_puzzles_finished },
    { href: "/phase1/hacking", icon: <Icon.Bug size={20} />, title: "Section B · Hacking", body: "Read a flawed solution and find an input that breaks it.", state: p === "p1_hacking" ? "open" : after("p1_hacking") ? "closed" : "not yet", done: state.me?.p1_hacking_finished },
    { href: "/phase1/results", icon: <Icon.List size={20} />, title: "My results", body: "Your per-question breakdown, once a section closes.", state: after("p1_puzzles") ? "available" : "not yet" },
    { href: "/phase1/leaderboard", icon: <Icon.Trophy size={20} />, title: "Standings", body: "The Phase 1 ranking and who advances.", state: "available" },
  ];
  return (
    <PageBody className="animate-fade-in">
      <PageHeader title="Phase 1 · Qualifying round" description="Two timed sections, run one after the other. Your total decides whether you advance to the auction contest. Ties go to the earlier submission time." />
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="group flex gap-4 rounded-box border border-line bg-card p-4 transition-[border-color,box-shadow] hover:border-line-2 hover:shadow-sm">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-box ${c.state === "open" ? "bg-green-tint text-green-dark" : "bg-page text-muted"}`}>{c.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13.5px] font-semibold group-hover:text-green-dark">{c.title}</span>
                {c.state === "open" && <Badge tone="green">open</Badge>}
                {c.state === "closed" && <Badge tone="grey">closed</Badge>}
                {c.state === "not yet" && <Badge tone="outline">not yet</Badge>}
                {c.done && <Badge tone="blue">finished</Badge>}
              </div>
              <div className="mt-1 text-[12.5px] leading-relaxed text-muted">{c.body}</div>
            </div>
            <Icon.ChevronRight size={16} className="self-center text-faint" />
          </Link>
        ))}
      </div>
    </PageBody>
  );
}
