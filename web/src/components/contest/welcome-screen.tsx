"use client";

/**
 * The waiting room: what the day is, and what is happening right now.
 *
 * Two screens used to say this — /welcome and the dashboard's registration
 * hold — in different words and at different sizes. They are one screen now.
 * A competitor who sees the same panels in both places learns it once.
 *
 * It was briefly built out of bare hairlines on the page background, centred in
 * a full-height box. On a laptop that left the text floating in the middle of
 * an empty screen with nothing holding it, which reads as a page that failed to
 * load rather than one that is waiting. So it is built from the same cards as
 * every other screen: a status panel that carries the live state, then the
 * shape of the day, then the rules.
 *
 * Still deliberately small type and no hero headline — this is a reference card
 * somebody glances at between rounds, not a landing page.
 */
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { useContest } from "@/components/contest-provider";
import { Countdown } from "@/components/countdown";
import { PHASE_LABEL } from "@/components/shell";
import { PageBody, Section } from "@/components/ui/page";
import { cn } from "@/lib/utils";

/** Six lines, because six is what someone actually reads while waiting. */
export const RULES: [string, string][] = [
  ["Two sections, then an auction", "Puzzles and hacking decide who goes through."],
  ["Two currencies", "Coins buy questions, hints and powerups. Points come from solving."],
  ["All or nothing", "A solved problem pays its full points. Wrong submissions cost nothing."],
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
    <span className="text-[20px] leading-none font-semibold tabular-nums" suppressHydrationWarning>
      {now ?? " "}
    </span>
  );
}

export function WelcomeScreen({ forwarding = false }: { forwarding?: boolean }) {
  const { state } = useContest();
  const phase = state?.contest.phase ?? "registration";
  const waiting = phase === "registration";
  const name = state?.viewer.name?.split(" ")[0] ?? "";

  return (
    <PageBody width="narrow" className="animate-fade-in">
      {/* The status panel. The only live thing on the screen, so the only thing
          that gets the accent and the tinted band. */}
      <section className="overflow-hidden rounded-lg border bg-card shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b bg-muted/40 px-5 py-4">
          <div className="min-w-0">
            <h1 className="truncate text-[19px] leading-tight font-semibold tracking-[-0.015em]">
              {waiting && name ? `You're in, ${name}` : "How the day runs"}
            </h1>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              {waiting ? "Nothing is required of you yet." : "The running order, and what each part asks of you."}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase">
              {state?.contest.phase_ends_at && !waiting ? "Closes in" : "Now"}
            </div>
            <div className="mt-1">
              {state?.contest.phase_ends_at && !waiting ? (
                <Countdown until={state.contest.phase_ends_at} className="text-[20px] leading-none font-semibold" />
              ) : (
                <Clock />
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 px-5 py-3.5" aria-live="polite">
          <span className={cn("size-1.5 shrink-0 rounded-full", waiting ? "animate-pulse bg-brand" : "bg-green")} />
          <span className="min-w-0 flex-1 text-[13px]">
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
          {forwarding && <Icon.Spinner size={14} className="shrink-0 text-muted-foreground" />}
        </div>
      </section>

      <Section title="The shape of the day" description="Four parts, in this order. Organisers open each one." className="mt-5" padded={false}>
        <ol className="divide-y">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="flex items-start gap-3.5 px-5 py-3">
              <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground tabular-nums">
                {i + 1}
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold">{title}</div>
                <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Rules" description="The six that change how you play." className="mt-5">
        <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {RULES.map(([t, b]) => (
            <li key={t} className="min-w-0">
              <div className="text-[12.5px] leading-snug font-semibold">{t}</div>
              <div className="mt-1 text-[12px] leading-snug text-muted-foreground">{b}</div>
            </li>
          ))}
        </ul>
      </Section>
    </PageBody>
  );
}
