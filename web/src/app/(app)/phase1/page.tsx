"use client";

/** Phase 1 hub: the two sections, your results, the standings -- each with its current state. */
import Link from "next/link";

import { useContest } from "@/components/contest-provider";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default function Phase1Hub() {
  const { state } = useContest();
  if (!state) return null;
  const p = state.contest.phase;
  const after = (k: string) => ["registration", "p1_puzzles", "p1_hacking", "review", "auction1", "coding1", "auction2", "final", "ended"].indexOf(p) > ["registration", "p1_puzzles", "p1_hacking", "review", "auction1", "coding1", "auction2", "final", "ended"].indexOf(k);
  const cards = [
    { href: "/phase1/puzzles", icon: <Icon.Puzzle size={22} />, title: "Section A — Logical puzzles", body: "MCQ and short answers. Revise until the section closes.", state: p === "p1_puzzles" ? "open" : after("p1_puzzles") ? "closed" : "not yet", done: state.me?.p1_puzzles_finished },
    { href: "/phase1/hacking", icon: <Icon.Bug size={22} />, title: "Section B — Hacking", body: "Find an input that breaks each given solution.", state: p === "p1_hacking" ? "open" : after("p1_hacking") ? "closed" : "not yet", done: state.me?.p1_hacking_finished },
    { href: "/phase1/results", icon: <Icon.List size={22} />, title: "My results", body: "Your per-question breakdown, once a section closes.", state: after("p1_puzzles") ? "available" : "not yet" },
    { href: "/phase1/leaderboard", icon: <Icon.Trophy size={22} />, title: "Standings", body: "Phase 1 ranking and who advances.", state: "available" },
  ];
  return (
    <div className="animate-fade-in">
      <PageHeader title="Phase 1 — Qualifying round" description="Two timed sections, run one after the other. Your total decides whether you advance to the auction contest." />
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.href} href={c.href}>
            <Card interactive className="h-full"><CardBody className="flex gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-box bg-page text-muted">{c.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="font-semibold">{c.title}</span>
                  {c.state === "open" && <Badge tone="green">open</Badge>}{c.state === "closed" && <Badge tone="grey">closed</Badge>}{c.state === "not yet" && <Badge tone="grey">not yet</Badge>}{c.done && <Badge tone="blue">finished</Badge>}</div>
                <div className="mt-0.5 text-sm text-muted">{c.body}</div>
              </div>
              <Icon.ChevronRight className="self-center text-faint" />
            </CardBody></Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
