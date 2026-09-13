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
import { useContest } from "./contest-provider";
import { Countdown } from "./countdown";
import { Icon } from "./icons";
import { plainText } from "./local-time";
import { Logo, Mark } from "./logo";
import { Avatar, AvatarFallback } from "./ui/avatar";
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
import { Stepper, type Step } from "./ui/stepper";
import { useToast } from "./ui/toast";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

/** How the live connection is reported. Connecting is not a failure. */
const CONNECTION = {
  connecting: { dot: "bg-white/40 animate-pulse", label: "Connecting", hint: "Connecting to the contest server…" },
  open: { dot: "bg-green-bright", label: "Connected", hint: "Connected to the contest server" },
  lost: { dot: "bg-red animate-pulse", label: "Reconnecting", hint: "Connection lost — reconnecting…" },
} as const;

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
const NAV: Record<string, NavItem[]> = {
  participant: [
    { href: "/dashboard", label: "Home", icon: Icon.Grid },
    { href: "/phase1", label: "Phase 1", icon: Icon.Puzzle },
    { href: "/auction", label: "Auction", icon: Icon.Gavel },
    { href: "/leaderboard", label: "Leaderboard", icon: Icon.Trophy },
  ],
  evaluator: [
    { href: "/grade", label: "Grading", icon: Icon.Edit },
    { href: "/grade/hacks", label: "Hack attempts", icon: Icon.Bug },
    { href: "/phase1/leaderboard", label: "Phase 1 standings", icon: Icon.Trophy },
  ],
};

export function Shell({ children }: { children: React.ReactNode }) {
  const { state, connection } = useContest();
  const pathname = usePathname();
  const router = useRouter();
  const [mobile, setMobile] = useState(false);

  useEffect(() => setMobile(false), [pathname]);

  if (!state) return null;
  const { viewer, contest, me } = state;
  const nav = NAV[viewer.role] ?? NAV.participant;
  const home = viewer.role === "participant" ? "/dashboard" : "/grade";
  const workspace = pathname.startsWith("/question/");
  const isActive = (href: string) =>
    pathname === href ||
    (href !== "/grade" && href !== "/dashboard" && pathname.startsWith(href + "/")) ||
    (href === "/dashboard" && workspace);

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
            <span
              className="hidden items-center gap-2 rounded-full bg-white/10 py-1 pr-3 pl-2.5 text-[12px] font-semibold sm:inline-flex"
              title="Current phase"
            >
              <span className="size-1.5 rounded-full bg-brand-bright" />
              {PHASE_LABEL[contest.phase]}
              {contest.phase_ends_at && (
                <span className="border-l border-white/20 pl-2 text-white/90">
                  <Countdown until={contest.phase_ends_at} />
                </span>
              )}
            </span>
            {contest.phase_ends_at && (
              <span className="text-[12px] font-semibold sm:hidden">
                <Countdown until={contest.phase_ends_at} />
              </span>
            )}

            {me && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1.5 rounded-full bg-brand-bright/15 py-1 pr-3 pl-2.5 text-[12px] font-semibold text-brand-bright">
                    <Icon.Coins size={14} />
                    <span className="tabular-nums">{me.balance.toLocaleString()}</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Your balance</TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  aria-label={CONNECTION[connection].label}
                  className={cn("size-2 rounded-full", CONNECTION[connection].dot)}
                />
              </TooltipTrigger>
              <TooltipContent>{CONNECTION[connection].hint}</TooltipContent>
            </Tooltip>

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

      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="left" className="w-72 gap-0 border-white/10 bg-navy p-0 text-white">
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

      <div className="sticky top-14 z-30 border-b bg-card">
        <div className="mx-auto flex h-10 max-w-[1600px] items-center px-4 sm:px-6">
          <Stepper steps={PHASE_STEPS} current={contest.phase} />
        </div>
      </div>

      {connection === "lost" && (
        <div className="flex items-center justify-center gap-2 bg-red px-4 py-1.5 text-center text-[13px] font-semibold text-white" role="alert">
          <Icon.WifiOff size={14} />
          Connection to the contest server lost — reconnecting. If this stays, raise your hand.
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
    </div>
  );
}

/** Turns live events into feedback the participant actually notices. */
function LiveToasts() {
  const { state, lastEvent } = useContest();
  const { toast } = useToast();
  const prevBidder = useRef<string | null | undefined>(undefined);
  const seen = useRef(0);

  useEffect(() => {
    // The provider re-renders for reasons other than a new event; `at` is the
    // event's own timestamp, so each one is announced exactly once.
    if (!lastEvent || lastEvent.at === seen.current) return;
    seen.current = lastEvent.at;

    const me = state?.viewer.id;
    const d = lastEvent.data as Record<string, unknown>;
    switch (lastEvent.name) {
      case "auction": {
        const lot = (d.lot as { current_bidder_id: string | null; current_bid: number | null; title: string } | null) ?? null;
        const now = lot?.current_bidder_id ?? null;
        // Only the moment of losing the lead is worth interrupting for.
        if (prevBidder.current === me && now && now !== me) {
          toast({ title: "You've been outbid", description: `${lot?.title} is now at ${lot?.current_bid}.`, tone: "warning" });
        }
        prevBidder.current = lot ? now : undefined;
        break;
      }
      case "verdict":
        if (d.state === "done") {
          toast({
            title: d.verdict === "AC" ? "Accepted" : `Verdict: ${d.verdict}`,
            tone: d.verdict === "AC" ? "success" : d.verdict === "IE" ? "info" : "error",
          });
        }
        break;
      case "hack":
        if (d.state === "done") toast({ title: "Hack attempt judged", description: "See the result on the hacking page.", tone: "info" });
        break;
      case "notify":
        // Markdown in a toast shows its asterisks, so it is flattened first.
        toast({ title: "For you", description: plainText(String(d.body ?? "")).slice(0, 140), tone: "info", duration: 9000 });
        break;
      case "phase":
        toast({ title: `Now: ${PHASE_LABEL[String(d.phase)] ?? d.phase}`, tone: "info" });
        break;
    }
  }, [lastEvent, state?.viewer.id, toast]);

  return null;
}
