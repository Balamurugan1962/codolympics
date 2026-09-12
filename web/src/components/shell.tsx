"use client";

/**
 * The frame every signed-in page sits in: a dark navy bar with the contest
 * name, role-specific navigation, and -- for participants -- the balance,
 * phase and time remaining that must always be visible (US-F3-01).
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

import { useContest } from "./contest-provider";
import { Countdown } from "./countdown";

const PHASE_LABEL: Record<string, string> = {
  registration: "Registration", p1_puzzles: "Phase 1 · Puzzles", p1_hacking: "Phase 1 · Hacking", review: "Review",
  auction1: "Auction 1", coding1: "Coding Round 1", auction2: "Auction 2", final: "Final Round", ended: "Ended",
};

function navFor(role: string, phase: string): [string, string][] {
  if (role === "admin") return [["/admin", "Overview"], ["/admin/contest", "Contest"], ["/admin/problems", "Problems"], ["/admin/phase1", "Phase 1"], ["/admin/participants", "Participants"], ["/admin/submissions", "Submissions"], ["/admin/audit", "Audit"]];
  if (role === "evaluator") return [["/grade", "Grading"], ["/grade/hacks", "Hacks"], ["/phase1/leaderboard", "Phase 1 board"]];
  const p1 = ["registration", "p1_puzzles", "p1_hacking", "review"].includes(phase);
  return p1
    ? [["/dashboard", "Home"], ["/phase1/puzzles", "Puzzles"], ["/phase1/hacking", "Hacking"], ["/phase1/results", "My results"], ["/phase1/leaderboard", "Standings"]]
    : [["/dashboard", "My questions"], ["/auction", "Auction"], ["/leaderboard", "Leaderboard"]];
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { state, connected } = useContest();
  const pathname = usePathname();
  const router = useRouter();
  if (!state) return null;
  const { viewer, contest, me } = state;

  return (
    <div className="min-h-screen">
      <header className="bg-navy text-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
          <Link href="/" className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
            <span className="inline-block h-6 w-6 rounded-sm bg-green-bright" />
            Contest
          </Link>
          <nav className="flex gap-1">
            {navFor(viewer.role, contest.phase).map(([href, label]) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link key={href} href={href}
                  className={`rounded-box px-3 py-1.5 text-sm font-semibold ${active ? "bg-white/10 text-green-bright" : "text-white/80 hover:text-white"}`}>
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="rounded-box bg-white/10 px-2 py-1 text-xs font-semibold">{PHASE_LABEL[contest.phase] ?? contest.phase}</span>
            {contest.phase_ends_at && <Countdown until={contest.phase_ends_at} className="font-semibold" />}
            {me && <span className="font-semibold text-green-bright tabular-nums">{me.balance.toLocaleString()} <span className="text-white/60">coins</span></span>}
            <span title={connected ? "connected" : "reconnecting…"} className={`h-2 w-2 rounded-full ${connected ? "bg-green-bright" : "bg-red animate-pulse"}`} />
            <span className="text-white/80">{viewer.name}</span>
            <button className="text-white/60 hover:text-white"
              onClick={async () => { await authClient.signOut(); router.push("/login"); router.refresh(); }}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      {!connected && (
        <div className="bg-red px-4 py-1.5 text-center text-sm font-semibold text-white">
          Connection to the contest server lost — reconnecting. Raise your hand if this persists.
        </div>
      )}
      {me?.disqualified && (
        <div className="bg-amber px-4 py-1.5 text-center text-sm font-semibold text-ink">Your account has been disqualified. Speak to an organiser.</div>
      )}
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
