"use client";

/**
 * The screens where a competitor has nothing to do but wait.
 *
 * These matter more than they look. Someone staring at a screen that says
 * nothing assumes it is broken, refreshes, and then asks an organiser — which
 * is three people's time gone. So each one says plainly what is happening, what
 * happens next, and that nothing is required of them right now.
 *
 * No call-to-action buttons: there is nothing to act on. Offering one would
 * only invite a click that does nothing.
 */
import Link from "next/link";
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useContest } from "../contest-provider";
import { WelcomeScreen } from "./welcome-screen";

/** The shape the other waiting screens take: one mark, one line, one explanation. */
function Hold({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: string;
  body: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-56px)] max-w-[560px] flex-col items-center justify-center px-6 py-10 text-center">
      <Logo inverse={false} size={26} />
      <div className="mt-5 text-[11px] font-semibold tracking-[0.1em] text-faint uppercase">{eyebrow}</div>
      <h1 className="mt-1.5 text-[19px] font-semibold tracking-[-0.015em]">{title}</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
      {children && <div className="mt-6 w-full">{children}</div>}
    </div>
  );
}

/**
 * Registration: they are in, and there is nothing to do until the organisers
 * start. The same card /welcome shows, so the two screens agree word for word.
 */
export function Waiting() {
  return <WelcomeScreen />;
}

/** Review: the sections are over and the organisers are deciding. */
export function Reviewing() {
  const { state } = useContest();
  const advanced = state?.me?.advanced ?? false;

  return (
    <div className="animate-fade-in">
      <Hold
        eyebrow="Phase 1 is over"
        title={advanced ? "You're through to the auction" : "Your answers are in"}
        body={
          advanced
            ? "Evaluators are finishing the marking. The auction opens when the organisers start it, and this screen becomes the auction floor."
            : "Evaluators are marking the written answers, then the organisers select who advances. Nothing more is required of you."
        }
      >
        <div className="flex flex-col items-center gap-4">
          {advanced && <Badge variant="success" size="lg">Selected for Phase 2</Badge>}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/phase1/results">
                <Icon.List size={14} /> See how you did
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/phase1/leaderboard">
                <Icon.Trophy size={14} /> Standings
              </Link>
            </Button>
          </div>
        </div>
      </Hold>
    </div>
  );
}

/** Not selected, while Phase 2 runs around them. */
export function NotSelected() {
  return (
    <div className="animate-fade-in">
      <Hold
        eyebrow="Phase 2 is running"
        title="You were not selected for Phase 2"
        body="You can still follow the contest to the end."
      >
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/phase1/results">
              <Icon.List size={14} /> My Phase 1 results
            </Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/leaderboard">
              <Icon.Trophy size={14} /> Leaderboard
            </Link>
          </Button>
        </div>
      </Hold>
    </div>
  );
}

/** The end. */
export function Ended() {
  const { state } = useContest();
  const rank = state?.rank;

  return (
    <div className="animate-fade-in">
      <Hold
        eyebrow="The contest has ended"
        title="That's the contest"
        body="Nothing more will be judged. Final standings below."
      >
        <div className="flex flex-col items-center gap-5">
          {rank && (
            <div className="rounded-[5px] border border-line bg-card px-7 py-4">
              <div className="text-[11px] font-semibold tracking-[0.1em] text-faint uppercase">You finished</div>
              <div className={cn("mt-1 text-[30px] leading-none font-semibold tracking-[-0.025em] num", rank.rank <= 3 && "text-brand-deep")}>
                #{rank.rank}
              </div>
              <div className="mt-1.5 text-[12.5px] text-muted-foreground">
                {rank.score} points · {rank.solved} solved
              </div>
            </div>
          )}
          <Button asChild>
            <Link href="/leaderboard">
              <Icon.Trophy size={15} /> Final standings
            </Link>
          </Button>
        </div>
      </Hold>
    </div>
  );
}

/**
 * What a competitor sees for the moment before their screen arrives.
 *
 * Not a grid of grey bars: they have no idea what is loading, and a skeleton
 * of a layout that may not even be the next one is just noise. The mark and one
 * honest line say the app is alive and working, which is the only thing worth
 * saying for half a second.
 */
export function ContestLoading() {
  return (
    <div className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center px-6 py-10 text-center" aria-busy>
      <Logo inverse={false} size={26} className="opacity-90" />
      <span className="mt-5 flex items-center gap-2 text-[13px] text-muted-foreground">
        <Icon.Spinner size={15} />
        Loading the contest…
      </span>
    </div>
  );
}
