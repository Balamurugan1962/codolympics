"use client";

/**
 * The waiting room: what the day is, and what is happening right now.
 *
 * Two screens used to say this — /welcome and the dashboard's registration
 * hold — in different words and at different sizes. They are one screen now.
 * A competitor who sees the same card in both places learns it once.
 *
 * It has two jobs: explain the shape of the day, and say plainly that nothing
 * is required of them yet. Sized to one screen and it never scrolls. Small
 * type throughout — this is a reference card, not a landing page, and nobody
 * reads a 32px headline twice.
 */
import { useEffect, useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Countdown } from "@/components/countdown";
import { PHASE_LABEL } from "@/components/shell";

/** Six lines, because six is what someone actually reads while waiting. */
export const RULES: [string, string][] = [
  ["Two sections, then an auction", "Puzzles and hacking decide who goes through."],
  ["Same money for everyone", "Identical starting balance. Money is never score."],
  ["All or nothing", "A solved problem earns full score. Wrong submissions cost nothing."],
  ["Hidden tests stay hidden", "You see which test failed, never what was in it."],
  ["One seat, one session", "Signing in elsewhere ends this one. Work saves as you type."],
  ["Nothing moves by itself", "Organisers open each section. This screen follows."],
];

const STEPS: [string, string][] = [
  ["Section A · Puzzles", "Answer in any order. Change anything until it closes."],
  ["Section B · Hacking", "Each given solution is wrong. Send an input that breaks it."],
  ["Auction", "Bid one at a time. Win one and only you can solve it."],
  ["Coding", "Solve what you own. Ties break on total solve time."],
];

/** The hall clock. A frozen clock is how you spot a dead tab from the back of a room. */
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
    <span className="text-[13px] font-semibold tabular-nums text-muted-foreground" suppressHydrationWarning>
      {now ?? " "}
    </span>
  );
}

export function WelcomeScreen({ forwarding = false }: { forwarding?: boolean }) {
  const { state } = useContest();
  const phase = state?.contest.phase ?? "registration";
  const waiting = phase === "registration";
  const name = state?.viewer.name?.split(" ")[0] ?? "";

  return (
    <div className="mx-auto flex h-[calc(100vh-56px)] max-w-[620px] flex-col justify-center gap-6 px-6 py-8">
      {/* No mark here: the chrome above already carries it, and a logo twice on
          one screen is a logo nobody looks at. */}
      <h1 className="text-[17px] font-semibold tracking-[-0.012em]">
        {waiting && name ? `You're in, ${name}` : "How the day runs"}
      </h1>

      {/* The only live thing on the page, so the only thing wearing the accent. */}
      <div className="flex items-center gap-2.5 border-y border-line py-2.5" aria-live="polite">
        <span
          className={
            waiting ? "size-1.5 shrink-0 animate-pulse rounded-full bg-brand" : "size-1.5 shrink-0 rounded-full bg-green"
          }
        />
        <span className="min-w-0 flex-1 truncate text-[13px]">
          {waiting ? (
            <>
              <span className="font-semibold">Waiting for the organisers to start.</span>{" "}
              <span className="text-muted-foreground">Don&apos;t refresh — this screen follows.</span>
            </>
          ) : (
            <>
              <span className="font-semibold">{PHASE_LABEL[phase] ?? phase} is open.</span>{" "}
              <span className="text-muted-foreground">{forwarding ? "Taking you there…" : "See Contest."}</span>
            </>
          )}
        </span>
        {state?.contest.phase_ends_at && !waiting ? (
          <Countdown until={state.contest.phase_ends_at} className="text-[13px] font-semibold" />
        ) : (
          <Clock />
        )}
      </div>

      <ol className="border-t border-line">
        {STEPS.map(([title, body], i) => (
          <li key={title} className="flex gap-3.5 border-b border-line py-2.5">
            <span className="w-4 shrink-0 pt-px text-right font-mono text-[12px] text-faint">{i + 1}</span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold">{title}</div>
              <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section>
        <h2 className="text-[11px] font-semibold tracking-[0.08em] text-faint uppercase">Rules</h2>
        <ul className="mt-3 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
          {RULES.map(([t, b]) => (
            <li key={t}>
              <div className="text-[12.5px] leading-snug font-semibold">{t}</div>
              <div className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{b}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
