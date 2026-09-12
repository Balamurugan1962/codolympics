"use client";

/**
 * The frame around every participant and evaluator page.
 *   row 1  brand · navigation · phase + countdown · balance · connection · you
 *   row 2  the phase timeline: where we are, what's next
 * Navigation is stable per role -- it never rearranges as phases change.
 * Administrators get components/admin/admin-shell.tsx instead.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";

import { useContest } from "./contest-provider";
import { Countdown } from "./countdown";
import { Icon } from "./icons";
import { Logo } from "./logo";
import { Stepper, type Step } from "./ui/stepper";
import { useToast } from "./ui/toast";

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
  const { state, connected } = useContest();
  const pathname = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [mobile, setMobile] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
  useEffect(() => { setMobile(false); setMenu(false); }, [pathname]);

  if (!state) return null;
  const { viewer, contest, me } = state;
  const nav = NAV[viewer.role] ?? NAV.participant;
  const workspace = pathname.startsWith("/question/");
  const isActive = (href: string) => pathname === href || (href !== "/grade" && href !== "/dashboard" && pathname.startsWith(href + "/")) || (href === "/grade" && pathname === "/grade") || (href === "/dashboard" && workspace);

  return (
    <div className="flex min-h-screen flex-col">
      <LiveToasts />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-box focus:bg-card focus:px-3 focus:py-2">Skip to content</a>

      <header className="sticky top-0 z-40 bg-navy text-white">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4 sm:px-6">
          <button className="rounded-box p-1.5 text-white/80 hover:bg-white/10 hover:text-white md:hidden" aria-label="Menu" aria-expanded={mobile} onClick={() => setMobile((m) => !m)}><Icon.Menu size={20} /></button>
          <Link href={viewer.role === "participant" ? "/dashboard" : "/grade"} aria-label="Codolympics home" className="shrink-0"><Logo /></Link>
          <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Primary">
            {nav.map(({ href, label, icon: I }) => {
              const active = isActive(href);
              return (
                <Link key={href} href={href} aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-box px-3 py-1.5 text-[13px] font-semibold transition-colors ${active ? "bg-white/10 text-green-bright" : "text-white/70 hover:bg-white/5 hover:text-white"}`}>
                  <I size={15} />{label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-2 rounded-full bg-white/10 py-1 pl-2.5 pr-3 text-[12px] font-semibold sm:inline-flex" title="Current phase">
              <span className="h-1.5 w-1.5 rounded-full bg-green-bright" />
              {PHASE_LABEL[contest.phase]}
              {contest.phase_ends_at && <span className="border-l border-white/20 pl-2 text-white/90"><Countdown until={contest.phase_ends_at} /></span>}
            </span>
            {contest.phase_ends_at && <span className="text-[12px] font-semibold sm:hidden"><Countdown until={contest.phase_ends_at} /></span>}
            {me && (
              <span className="flex items-center gap-1.5 rounded-full bg-green-bright/15 py-1 pl-2.5 pr-3 text-[12px] font-semibold text-green-bright" title="Your balance">
                <Icon.Coins size={14} /> <span className="tabular-nums">{me.balance.toLocaleString()}</span>
              </span>
            )}
            <span aria-label={connected ? "Connected" : "Reconnecting"} title={connected ? "Connected to the contest server" : "Reconnecting…"}
              className={`h-2 w-2 rounded-full ${connected ? "bg-green-bright" : "bg-red animate-pulse"}`} />
            <div ref={menuRef} className="relative">
              <button onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu}
                className="flex items-center gap-2 rounded-box px-1.5 py-1 text-sm text-white/85 hover:bg-white/10">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-bright text-xs font-bold text-navy">{viewer.name.slice(0, 1).toUpperCase()}</span>
                <span className="hidden max-w-32 truncate text-[13px] font-medium sm:inline">{viewer.name}</span>
                <Icon.ChevronDown size={14} className="hidden text-white/60 sm:block" />
              </button>
              {menu && (
                <div role="menu" className="absolute right-0 mt-1.5 w-56 overflow-hidden rounded-box border border-line bg-card py-1 text-ink shadow-lg">
                  <div className="border-b border-line px-3 py-2 text-xs text-muted">Signed in as <span className="font-semibold text-ink">{viewer.name}</span><div className="mt-0.5 capitalize">{viewer.role}</div></div>
                  {viewer.role === "participant" && <Link role="menuitem" href="/welcome" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-page"><Icon.Info size={15} /> How it works</Link>}
                  <button role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-page"
                    onClick={async () => { await authClient.signOut(); router.push("/login"); router.refresh(); }}>
                    <Icon.Logout size={15} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        {mobile && (
          <nav className="border-t border-white/10 px-2 py-2 md:hidden" aria-label="Primary">
            {nav.map(({ href, label, icon: I }) => (
              <Link key={href} href={href} className={`flex items-center gap-2.5 rounded-box px-3 py-2 text-sm font-semibold ${isActive(href) ? "bg-white/10 text-green-bright" : "text-white/85 hover:bg-white/10"}`}><I size={15} />{label}</Link>
            ))}
          </nav>
        )}
      </header>

      <div className="sticky top-14 z-30 border-b border-line bg-card">
        <div className="mx-auto flex h-10 max-w-[1600px] items-center px-4 sm:px-6">
          <Stepper steps={PHASE_STEPS} current={contest.phase} />
        </div>
      </div>

      {!connected && (
        <div className="bg-red px-4 py-1.5 text-center text-sm font-semibold text-white" role="alert">
          Connection to the contest server lost — reconnecting. If this stays, raise your hand.
        </div>
      )}
      {me?.disqualified && <div className="bg-amber px-4 py-1.5 text-center text-sm font-semibold text-ink" role="alert">Your account has been disqualified. Speak to an organiser.</div>}

      <main id="main" className="flex-1">{children}</main>
    </div>
  );
}

/** Turns live events into feedback the participant actually notices. */
function LiveToasts() {
  const { state, lastEvent } = useContest();
  const { toast } = useToast();
  const prevBidder = useRef<string | null | undefined>(undefined);
  const seen = useRef<number>(0);

  useEffect(() => {
    if (!lastEvent || lastEvent.at === seen.current) return;
    seen.current = lastEvent.at;
    const me = state?.viewer.id;
    const d = lastEvent.data as Record<string, unknown>;
    switch (lastEvent.name) {
      case "auction": {
        const lot = (d.lot as { current_bidder_id: string | null; current_bid: number | null; title: string } | null) ?? null;
        const now = lot?.current_bidder_id ?? null;
        if (prevBidder.current === me && now && now !== me) toast({ title: "You've been outbid", description: `${lot?.title} is now at ${lot?.current_bid}.`, tone: "warning" });
        prevBidder.current = lot ? now : undefined;
        break;
      }
      case "verdict":
        if (d.state === "done") toast({ title: d.verdict === "AC" ? "Accepted!" : `Verdict: ${d.verdict}`, tone: d.verdict === "AC" ? "success" : d.verdict === "IE" ? "info" : "error" });
        break;
      case "hack":
        if (d.state === "done") toast({ title: "Hack attempt judged", description: "See the result on the hacking page.", tone: "info" });
        break;
      case "announce":
        toast({ title: "Announcement", description: String(d.body_md ?? "").slice(0, 120), tone: "info", duration: 8000 });
        break;
      case "notify":
        toast({ title: "For you", description: String(d.body ?? "").replace(/\*\*/g, "").slice(0, 120), tone: "info", duration: 8000 });
        break;
      case "phase":
        toast({ title: `Now: ${PHASE_LABEL[String(d.phase)] ?? d.phase}`, tone: "info" });
        break;
    }
  }, [lastEvent, state?.viewer.id, toast]);
  return null;
}
