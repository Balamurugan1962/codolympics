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

/** The wall clock, so a stalled page is obvious: a frozen clock means a dead tab. */
function Clock() {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  // Rendered after mount: the server's clock is not the hall's.
  return (
    <span className="text-[44px] leading-none font-semibold tracking-[-0.03em] tabular-nums sm:text-[56px]" suppressHydrationWarning>
      {now ?? " "}
    </span>
  );
}

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
    <div className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center px-6 py-10 text-center">
      <Logo inverse={false} size={40} />
      <div className="mt-5 text-[12px] font-semibold tracking-[0.12em] text-faint uppercase">{eyebrow}</div>
      <h1 className="mt-2 text-[27px] font-semibold tracking-[-0.02em] sm:text-[31px]">{title}</h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">{body}</p>
      {children && <div className="mt-8 w-full max-w-lg">{children}</div>}
    </div>
  );
}

/** Six lines, because six is what someone actually reads while waiting. */
export const RULES: [string, string][] = [
  ["Two sections, then an auction", "Puzzles and hacking decide who goes through. Finalists bid for the problems they want."],
  ["Same money for everyone", "Every finalist starts the auction with an identical balance. Money is never score."],
  ["Solving is all-or-nothing", "A solved problem earns its full score. Wrong submissions cost nothing."],
  ["Hidden tests stay hidden", "You see the samples and which test failed — never its contents, at any price."],
  ["One seat, one session", "Signing in elsewhere ends this one. Your work is saved on the server as you type."],
  ["Nothing moves by itself", "Organisers start each section. This screen changes on its own — do not refresh."],
];

export function RulesGrid({ className }: { className?: string }) {
  return (
    <ul className={cn("grid gap-x-8 gap-y-3.5 text-left sm:grid-cols-2", className)}>
      {RULES.map(([t, b]) => (
        <li key={t} className="flex gap-2.5">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-green-tint text-green-dark">
            <Icon.Check size={12} strokeWidth={3.5} />
          </span>
          <div className="min-w-0">
            <div className="text-[14px] leading-snug font-semibold">{t}</div>
            <div className="mt-1 text-[12.5px] leading-snug text-muted-foreground">{b}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Registration: they are in, and there is nothing to do until the organisers
 * start. Sized to one screen — a competitor should never have to scroll to
 * find out whether anything is being asked of them.
 */
export function Waiting() {
  const { state } = useContest();
  const name = state?.viewer.name ?? "";

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col items-center justify-center overflow-hidden px-6 py-6 text-center animate-fade-in">
      <Logo inverse={false} size={44} />
      <div className="mt-5 text-[12px] font-semibold tracking-[0.12em] text-faint uppercase">You are registered</div>
      <h1 className="mt-2 text-[27px] font-semibold tracking-[-0.02em] sm:text-[32px]">{name ? `You're in, ${name}` : "You're in"}</h1>
      <p className="mt-2.5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
        Nothing is required of you yet. When the organisers open Section A this screen becomes the puzzles, by itself — leave it open and do
        not refresh.
      </p>

      <div className="mt-6 flex flex-col items-center">
        <Clock />
        <span className="mt-2 flex items-center gap-2 text-[13.5px] text-muted-foreground">
          <span className="size-1.5 animate-pulse rounded-full bg-green" />
          Waiting for the organisers to start
        </span>
      </div>

      <RulesGrid className="mt-8 w-full max-w-3xl" />
    </div>
  );
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
        body="Bidding and submitting are not open to you. Your Phase 1 results stand, and you can still follow the contest to the end."
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
        body="Thank you for taking part. Nothing more will be judged; the final standings are below."
      >
        <div className="flex flex-col items-center gap-5">
          {rank && (
            <div className="rounded-lg border bg-card px-8 py-5 shadow-xs">
              <div className="text-[11px] font-semibold tracking-[0.08em] text-faint uppercase">You finished</div>
              <div className={cn("mt-1 text-[40px] leading-none font-semibold tracking-[-0.03em] tabular-nums", rank.rank <= 3 && "text-brand")}>
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
      <Logo inverse={false} size={40} className="opacity-90" />
      <span className="mt-6 flex items-center gap-2 text-[13.5px] text-muted-foreground">
        <Icon.Spinner size={15} />
        Loading the contest…
      </span>
    </div>
  );
}
