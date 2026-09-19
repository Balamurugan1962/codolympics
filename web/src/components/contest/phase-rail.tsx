"use client";

/**
 * Where we are in the day, and what the competitor is meant to be doing.
 *
 * A competitor asks three questions all day: what part are we in, how long is
 * left, and what am I supposed to do right now. The header used to answer only
 * the first two, and only as a chip — so the answer to "what next" lived in a
 * paragraph on each screen, written differently every time.
 *
 * This is that answer, in one place, in the same place on every screen: the
 * four parts they were shown on the welcome screen, the one they are in, and a
 * sentence of what to do. Steps are a map, not a menu — they are not links,
 * because a competitor cannot move themselves between parts of the contest.
 */
import { Countdown } from "@/components/countdown";
import { cn } from "@/lib/utils";

/** The day as a competitor was taught it, not the nine phases the engine tracks. */
const STEPS = ["Puzzles", "Hacking", "Auction", "Coding", "Result"] as const;

/**
 * Which step a phase belongs to, what has just started, and the one line of
 * what to do in it.
 *
 * `started` is the sentence a competitor is told the moment the phase opens, on
 * screen and in the toast, so both say the same thing.
 */
export const WHERE: Record<string, { step: number; started: string; todo: string }> = {
  registration: { step: 0, started: "Registration is open", todo: "Waiting for the organisers to start" },
  p1_puzzles: { step: 1, started: "Section A has started: the puzzles", todo: "Answer the puzzles. Change any answer until it closes" },
  p1_hacking: { step: 2, started: "Section B has started: hacking", todo: "Break the given solutions with a test input" },
  review: { step: 2, started: "Section B is over", todo: "Marking in progress. Nothing to do" },
  auction1: { step: 3, started: "Auction 1 has started", todo: "Bid for the questions you want to solve" },
  coding1: { step: 4, started: "Coding round 1 has started", todo: "Solve the questions you own" },
  auction2: { step: 3, started: "Auction 2 has started", todo: "Bid for what is left, or keep solving" },
  final: { step: 4, started: "The final round has started", todo: "Last round. Solve what you own" },
  ended: { step: 5, started: "The contest has ended", todo: "The contest is over" },
};

export function PhaseRail({ phase, endsAt }: { phase: string; endsAt: string | null }) {
  const here = WHERE[phase] ?? { step: 0, started: "", todo: "" };
  return (
    <div className="border-b bg-card">
      <div className="mx-auto flex h-10 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
        <ol className="hidden items-center gap-1.5 text-[12px] sm:flex" aria-label="Contest progress">
          {STEPS.map((label, i) => {
            const state = here.step === i + 1 ? "now" : here.step > i + 1 ? "done" : "todo";
            return (
              <li key={label} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden className="text-line-2">/</span>}
                <span
                  aria-current={state === "now" ? "step" : undefined}
                  className={cn(
                    state === "now" && "font-semibold text-brand-deep",
                    state === "done" && "text-muted-foreground",
                    state === "todo" && "text-faint",
                  )}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="min-w-0 flex-1 truncate text-[12.5px] text-muted-foreground sm:text-right">
          <span className="font-medium text-foreground sm:hidden">{STEPS[Math.max(0, here.step - 1)]} · </span>
          {here.todo}
        </p>
        {endsAt && (
          <span className="shrink-0 text-[12.5px] font-semibold tabular-nums">
            <Countdown until={endsAt} /> <span className="font-normal text-faint">left</span>
          </span>
        )}
      </div>
    </div>
  );
}
