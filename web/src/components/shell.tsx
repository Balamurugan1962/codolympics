"use client";

/**
 * The frame around every participant and evaluator page.
 *   row 1  brand · navigation · phase + countdown · balance · connection · you
 *   row 2  the phase timeline: where we are, what's next
 *
 * Navigation is stable per role — it never rearranges as phases change, because
 * a competitor hunting for a moved link is losing contest time. Administrators
 * get components/admin/admin-shell.tsx instead; their job is a console, not a
 * linear flow.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

import { AnnouncementOverlay } from "./announcement-overlay";
import { BlackoutOverlay } from "./contest/blackout-overlay";
import { Proctor } from "./contest/proctor";
import { PhaseRail, WHERE } from "./contest/phase-rail";
import { boardShown } from "@/lib/boards";
import { ContestLoading } from "./contest/waiting";
import { useContest, useEngineEvent } from "./contest-provider";
import { Icon } from "./icons";
import { plainText } from "./local-time";
import { Logo, Mark } from "./logo";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { verdictLabel } from "./ui/badge";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { useToast } from "./ui/toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

/** How the live connection is reported. Connecting is not a failure. */
const CONNECTION = {
  connecting: { dot: "bg-white/40 animate-pulse", label: "Connecting", hint: "Connecting to the contest server…" },
  open: { dot: "bg-green-bright", label: "Connected", hint: "Connected to the contest server" },
  lost: { dot: "bg-red animate-pulse", label: "Reconnecting", hint: "Connection lost, reconnecting…" },
} as const;

export type Step = { key: string; label: string; short?: string };

/** The contest, in order. Administrators see all nine; a competitor only ever sees the one they are in. */
export const PHASE_STEPS: Step[] = [
  { key: "registration", label: "Registration", short: "Reg" },
  { key: "p1_puzzles", label: "Puzzles", short: "A" },
  { key: "p1_hacking", label: "Hacking", short: "B" },
  { key: "review", label: "Review", short: "Rev" },
  { key: "auction1", label: "Auction 1", short: "A1" },
  { key: "coding1", label: "Coding 1", short: "C1" },
  { key: "auction2", label: "Auction 2", short: "A2" },
  { key: "final", label: "Final", short: "F" },
  { key: "ended", label: "Ended", short: "End" },
];
export const PHASE_LABEL = Object.fromEntries(PHASE_STEPS.map((s) => [s.key, s.label])) as Record<string, string>;

type NavItem = { href: string; label: string; icon: (p: { size?: number }) => React.ReactElement };
/**
 * Two items, and that is the point. The contest screen is whatever phase is
 * open, so there is nothing to navigate between during a round — every link
 * that is not the task is time a competitor can lose.
 */
const NAV: NavItem[] = [
  { href: "/dashboard", label: "Contest", icon: Icon.Grid },
  { href: "/leaderboard", label: "Leaderboard", icon: Icon.Trophy },
  { href: "/marketplace", label: "Marketplace", icon: Icon.Coins },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { state, connection } = useContest();
  const pathname = usePathname();
  const router = useRouter();
  const [mobile, setMobile] = useState(false);

  useEffect(() => setMobile(false), [pathname]);

  // State is seeded from the server, so this is the rare reconnect case —
  // still better than a blank page with no explanation.
  if (!state) {
    return (
      <div className="flex min-h-screen flex-col">
        <header className="h-14 bg-navy" />
        <ContestLoading />
      </div>
    );
  }
  const { viewer, contest, me } = state;
  // Nothing to buy or aim at if you are not competing, and nothing to buy at
  // all until Phase 2: powerups are spent against the people you are bidding
  // and solving against, so the shop is not even listed in Phase 1.
  const shopping = viewer.role === "participant" && contest.in_phase2;
  // A hidden board is not listed either: a tab that opens "hidden" is a tease.
  const hidden = [...(shopping ? [] : ["/marketplace"]), ...(boardShown(contest) ? [] : ["/leaderboard"])];
  const nav = NAV.filter((n) => !hidden.includes(n.href));
  const home = "/dashboard";
  const workspace = pathname.startsWith("/question/");
  // The workspace is opened from the contest screen, so it keeps that item lit.
  const isActive = (href: string) => pathname === href || (href === "/dashboard" && workspace) || (href !== "/dashboard" && pathname.startsWith(href + "/"));

  const signOut = async () => {
    await authClient.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen flex-col">
      <LiveToasts />
      <AnnouncementOverlay />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow-lg"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 bg-navy text-white">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
          <button
            className="-ml-1.5 rounded-md p-1.5 text-white/75 transition-colors hover:bg-white/10 hover:text-white md:hidden"
            aria-label="Open navigation"
            onClick={() => setMobile(true)}
          >
            <Icon.Menu size={20} />
          </button>

          <Link href={home} aria-label="Codolympics home" className="shrink-0 rounded-md">
            <Logo />
          </Link>

          <nav className="ml-5 hidden items-center gap-0.5 md:flex" aria-label="Primary">
            {nav.map(({ href, label, icon: I }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-14 items-center gap-2 px-3 text-[13px] font-semibold transition-colors",
                    active ? "text-brand-bright" : "text-white/70 hover:text-white",
                  )}
                >
                  <I size={15} />
                  {label}
                  {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-t bg-brand-bright" />}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
            {/* Coins only exist in Phase 2, so the wallet appears with them
                rather than sitting at zero all through Phase 1. */}
            {me && shopping && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1.5 rounded-none bg-brand-bright/15 px-2.5 py-1 text-[12px] font-semibold text-brand-bright">
                    <Icon.Coins size={14} />
                    <span className="tabular-nums">{me.balance.toLocaleString()}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Your coins. Spent on questions, hints and powerups</TooltipContent>
              </Tooltip>
            )}

            {/* Silence is the healthy state: the dot appears only when the
                stream is not live, so it means something when you see it. */}
            {connection !== "open" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span aria-label={CONNECTION[connection].label} className={cn("size-2 rounded-full", CONNECTION[connection].dot)} />
                </TooltipTrigger>
                <TooltipContent>{CONNECTION[connection].hint}</TooltipContent>
              </Tooltip>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-md px-1 py-1 text-sm text-white/85 transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-brand-bright/60 focus-visible:outline-none">
                  <Avatar className="size-7 rounded-full">
                    <AvatarFallback className="bg-brand-bright text-[11px] font-bold text-navy">
                      {viewer.name.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-32 truncate text-[13px] font-medium sm:inline">{viewer.name}</span>
                  <Icon.ChevronDown size={14} className="hidden text-white/60 sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-[11px] text-muted-foreground">Signed in as</div>
                  <div className="truncate text-[13px] font-semibold">{viewer.name}</div>
                  <div className="text-[11.5px] text-muted-foreground capitalize">{viewer.role}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {viewer.role === "participant" && (
                  <DropdownMenuItem asChild>
                    <Link href="/welcome">
                      <Icon.Info size={15} /> How it works
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={signOut}>
                  <Icon.Logout size={15} /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <PhaseRail
        phase={contest.phase}
        endsAt={contest.phase_ends_at}
        shield={viewer.role === "participant" ? state.shield ?? null : null}
        attackBreak={viewer.role === "participant" ? state.attack_break ?? null : null}
      />

      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent
          side="left"
          className="w-72 gap-0 border-white/10 bg-navy p-0 text-white [&>button]:top-3.5 [&>button]:right-3.5 [&>button]:p-1.5 [&>button]:text-white/60 [&>button]:opacity-100 [&>button]:hover:text-white"
        >
          <SheetHeader className="h-14 justify-center border-b border-white/10 px-5">
            <SheetTitle className="flex items-center gap-2.5 text-[15px] font-bold tracking-tight text-white">
              <Mark size={24} /> Cod<span className="-ml-2.5 text-brand-bright">olympics</span>
            </SheetTitle>
          </SheetHeader>
          <nav className="p-3" aria-label="Primary">
            {nav.map(({ href, label, icon: I }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors",
                  isActive(href) ? "bg-white/10 text-brand-bright" : "text-white/80 hover:bg-white/5 hover:text-white",
                )}
              >
                <I size={16} />
                {label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      {connection === "lost" && (
        <div className="flex items-center justify-center gap-2 bg-red px-4 py-1.5 text-center text-[13px] font-semibold text-white" role="alert">
          <Icon.WifiOff size={14} />
          Connection to the contest server lost, reconnecting. If this stays, raise your hand.
        </div>
      )}
      {me?.disqualified && (
        <div className="flex items-center justify-center gap-2 bg-amber-bg px-4 py-1.5 text-center text-[13px] font-semibold text-navy" role="alert">
          <Icon.Alert size={14} />
          Your account has been disqualified. Speak to an organiser.
        </div>
      )}

      <main id="main" className="flex-1">
        {children}
      </main>

      {/* Above every screen, and outside <main> so nothing it covers is
          unmounted. The page underneath is still there when it lifts. */}
      {viewer.role === "participant" && <BlackoutOverlay />}
      {viewer.role === "participant" && <Proctor />}
    </div>
  );
}

/** Turns live events into feedback the participant actually notices. */
function LiveToasts() {
  const { state } = useContest();
  const { toast } = useToast();
  const prevBidder = useRef<string | null | undefined>(undefined);
  // The phase as last announced, so a repeat is not announced again.
  const seenPhase = useRef<{ phase: string; registrationOpen: boolean } | null>(
    state ? { phase: state.contest.phase, registrationOpen: state.contest.registration_open } : null,
  );

  useEngineEvent("*", (event) => {
    const me = state?.viewer.id;
    const d = event.data as Record<string, unknown>;
    switch (event.name) {
      case "auction": {
        const lot = (d.lot as { current_bidder_id: string | null; current_bid: number | null; title: string } | null) ?? null;
        const now = lot?.current_bidder_id ?? null;
        // Only the moment of losing the lead is worth interrupting for.
        if (prevBidder.current === me && now && now !== me) {
          toast({ title: "You have been outbid", description: `${lot?.title} is now at ${lot?.current_bid}.`, tone: "warning" });
        }
        prevBidder.current = lot ? now : undefined;
        break;
      }
      case "verdict":
        if (d.state === "done") {
          // Never the abbreviation on its own: a competitor should not have to
          // learn that "OLE" is a thing in order to read their own result.
          toast({
            title: verdictLabel(d.verdict as string | null),
            tone: d.verdict === "AC" ? "success" : d.verdict === "IE" ? "info" : "error",
          });
        }
        break;
      case "hack":
        if (d.state === "done") toast({ title: "Your hack attempt has been judged", description: "The result is on the question you attempted.", tone: "info" });
        break;
      case "notify":
        // Markdown in a toast shows its asterisks, so it is flattened first.
        toast({ title: "For you", description: plainText(String(d.body ?? "")).slice(0, 140), tone: "info", duration: 9000 });
        break;
      case "phase": {
        // A "phase" event is also sent when a deadline is extended or
        // registration is opened or closed, so only a change in the phase
        // itself announces a phase. Closing registration says so instead:
        // it used to repeat "Registration is open".
        const phase = String(d.phase);
        const before = seenPhase.current;
        seenPhase.current = { phase, registrationOpen: d.registration_open === true };
        if (before === null) break;
        if (before.phase !== phase) {
          // "Now: Registration" told a competitor nothing. Say what started and
          // what they are meant to do, in the words the rail above already uses.
          const here = WHERE[phase];
          toast({ title: here?.started ?? `Now: ${PHASE_LABEL[phase] ?? phase}`, description: here?.todo, tone: "info", duration: 9000 });
        } else if (phase === "registration" && before.registrationOpen !== (d.registration_open === true)) {
          toast({
            title: d.registration_open ? "Registration is open again" : "Registration is closed",
            description: d.registration_open ? "New accounts can be created." : "No more accounts can be created. Waiting for the organisers to start.",
            tone: "info",
            duration: 9000,
          });
        }
        break;
      }
    }
  });

  return null;
}
