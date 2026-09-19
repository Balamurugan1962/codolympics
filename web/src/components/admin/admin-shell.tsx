"use client";

/**
 * The administrator frame. A persistent navy sidebar carries the whole
 * information architecture as eight destinations, each named after a job;
 * the pages inside one appear only while you are in it. The top bar holds
 * only what must always be true: the phase, the clock, and who you are.
 *
 * Health lives at the foot of the sidebar rather than in a dashboard card,
 * because "is the judge up?" is a question you ask while doing something else.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

import { AnnouncementOverlay } from "../announcement-overlay";
import { useContest } from "../contest-provider";
import { Countdown } from "../countdown";
import { Icon } from "../icons";
import { Mark } from "../logo";
import { PHASE_LABEL } from "../shell";
import { Avatar, AvatarFallback } from "../ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";

type Role = "admin" | "evaluator";
type Item = { href: string; label: string; roles?: Role[] };
type Group = {
  label: string;
  icon: (p: { size?: number }) => React.ReactElement;
  /** Where the group row goes. Defaults to its first child. */
  href?: string;
  items?: Item[];
};

/**
 * The console's whole information architecture, two levels deep and no deeper.
 *
 * Eight destinations, each named after a job: run the day, prepare a phase,
 * grade, read the boards, manage people, watch the machinery, set it up. A
 * group's pages appear only while you are inside it, because nineteen links
 * under eight headings was a wall to read rather than a place to be — and at
 * any moment an organiser is doing exactly one of these jobs.
 *
 * A question set's order is not a destination of its own: it is one thing you
 * do to that set, reached by the Order button on its list and named there.
 * Listed here, "Section A order" sat beside "Section A · Puzzles" as if they
 * were peers, and the prefixes were doing the work the grouping should do.
 *
 * `roles` narrows an item to administrators. It is presentation only — every
 * route enforces its own permissions server-side, because hiding a link has
 * never been a control.
 */
const NAV: Group[] = [
  { label: "Dashboard", icon: Icon.Grid, href: "/admin" },
  {
    label: "Phase 1",
    icon: Icon.Flag,
    items: [
      { href: "/admin/phase1/puzzles", label: "Puzzles" },
      { href: "/admin/phase1/hacking", label: "Hacking" },
      { href: "/admin/phase1/review", label: "Review & advance" },
    ],
  },
  {
    label: "Phase 2",
    icon: Icon.Gavel,
    items: [
      { href: "/admin/problems", label: "Problems" },
      { href: "/admin/auction", label: "Auction control" },
      { href: "/admin/powerups", label: "Powerups" },
    ],
  },
  {
    label: "Grading",
    icon: Icon.Scale,
    items: [
      { href: "/grade", label: "Answers" },
      { href: "/grade/hacks", label: "Hack attempts" },
    ],
  },
  {
    label: "Leaderboards",
    icon: Icon.Trophy,
    items: [
      { href: "/admin/leaderboard/phase1", label: "Phase 1" },
      { href: "/admin/leaderboard/phase2", label: "Phase 2" },
    ],
  },
  {
    label: "People",
    icon: Icon.Users,
    items: [
      { href: "/admin/participants", label: "Participants" },
      { href: "/admin/staff", label: "Staff", roles: ["admin"] },
      { href: "/admin/announcements", label: "Announcements" },
    ],
  },
  {
    label: "Monitor",
    icon: Icon.Server,
    items: [
      { href: "/admin/judge", label: "Judge" },
      { href: "/admin/submissions", label: "Submissions" },
      { href: "/admin/audit", label: "Audit log" },
    ],
  },
  {
    label: "Setup",
    icon: Icon.Settings,
    items: [
      { href: "/admin/readiness", label: "Readiness" },
      { href: "/admin/contest", label: "Settings", roles: ["admin"] },
    ],
  },
];

/**
 * Phase 2's board only makes sense once Phase 1 is behind you, so it is hidden
 * until then rather than shown empty.
 */
const BEFORE_PHASE2 = ["registration", "p1_puzzles", "p1_hacking", "review"];

/**
 * Pages an evaluator has no business on. The server refuses the requests
 * anyway; this exists so a typed URL says why instead of rendering a screen
 * whose every request fails.
 */
const ADMIN_ONLY = ["/admin/contest", "/admin/staff"];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { state, connection } = useContest();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false); // the mobile drawer
  const [judgeOk, setJudgeOk] = useState<boolean | null>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const poll = async () => {
      try {
        const h = await api.get<{ judge: { status: string } | null }>("/api/admin/health");
        setJudgeOk(h.judge?.status === "ok");
      } catch {
        setJudgeOk(false);
      }
    };
    void poll();
    const t = setInterval(poll, 15_000);
    return () => clearInterval(t);
  }, []);

  if (!state) return null;
  const { viewer, contest } = state;
  const role = viewer.role === "admin" ? "admin" : "evaluator";
  const nav = NAV.map((g) => ({
    ...g,
    items: g.items?.filter(
      (it) =>
        (!it.roles || it.roles.includes(role)) &&
        !(it.href === "/admin/leaderboard/phase2" && BEFORE_PHASE2.includes(contest.phase)),
    ),
  })).filter((g) => !g.items || g.items.length > 0);

  const here = current(pathname, nav);

  const sidebar = (
    <div className="flex h-full w-60 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-5">
        <Mark size={24} />
        <span className="text-[15px] font-bold tracking-tight text-white">
          Cod<span className="text-brand-bright">olympics</span>
        </span>
        <span className="ml-auto rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white/60 uppercase">
          Admin
        </span>
      </div>

      <nav className="pane min-h-0 flex-1 overflow-y-auto px-3 py-3" aria-label="Administration">
        <ul className="space-y-0.5">
          {nav.map(({ label, icon: I, items, href }) => {
            const target = items?.[0]?.href ?? href ?? "/admin";
            const open = here?.group === label;
            return (
              <li key={label}>
                <Link
                  href={target}
                  aria-current={here?.href === target && !items ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                    open ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white/90",
                  )}
                >
                  <I size={16} />
                  <span>{label}</span>
                  {items && (
                    <Icon.ChevronRight size={13} className={cn("ml-auto text-white/30 transition-transform", open && "rotate-90")} />
                  )}
                </Link>

                {open && items && (
                  <ul className="mt-0.5 mb-1 ml-[26px] border-l border-white/10">
                    {items.map((it) => {
                      const active = here?.href === it.href;
                      return (
                        <li key={it.href}>
                          <Link
                            href={it.href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "-ml-px flex min-h-8 items-center border-l pr-2 pl-3 text-[12.5px] transition-colors",
                              active
                                ? "border-brand-bright font-medium text-white"
                                : "border-transparent text-white/50 hover:border-white/25 hover:text-white/90",
                            )}
                          >
                            {it.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex shrink-0 items-center gap-4 border-t border-sidebar-border px-4 py-2.5">
        <Health label="Judge" ok={judgeOk} bad="unreachable" />
        <Health label="Live" ok={connection === "connecting" ? null : connection === "open"} bad="reconnecting" />
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen shrink-0 lg:block">{sidebar}</aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-60 gap-0 border-sidebar-border bg-sidebar p-0 [&>button]:top-3.5 [&>button]:right-3.5 [&>button]:p-1.5 [&>button]:text-white/60 [&>button]:opacity-100 [&>button]:hover:text-white"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Administration</SheetTitle>
          </SheetHeader>
          {sidebar}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4 lg:px-8">
          <button
            className="-ml-1.5 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <Icon.Menu size={18} />
          </button>

          <div className="flex items-center gap-2.5 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-navy px-2.5 py-1 text-[11.5px] font-semibold text-white">
              <span className="size-1.5 rounded-full bg-brand-bright" />
              {PHASE_LABEL[contest.phase] ?? contest.phase}
            </span>
            {contest.phase_ends_at && (
              <span className="hidden items-center gap-1.5 text-[12.5px] text-muted-foreground sm:inline-flex">
                <Icon.Clock size={14} />
                <Countdown until={contest.phase_ends_at} className="font-semibold text-foreground" /> left
              </span>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="ml-auto flex items-center gap-2 rounded-md px-1 py-1 text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none">
                <Avatar className="size-7">
                  <AvatarFallback className="bg-navy text-[11px] font-bold text-brand-bright">
                    {viewer.name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-32 truncate text-[13px] font-medium sm:inline">{viewer.name}</span>
                <Icon.ChevronDown size={14} className="text-faint" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="font-normal">
                <div className="text-[11px] text-muted-foreground">Signed in as</div>
                <div className="truncate text-[13px] font-semibold">{viewer.name}</div>
                <div className="text-[11.5px] text-muted-foreground capitalize">{viewer.role}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={async () => {
                  await authClient.signOut();
                  router.push("/login");
                  router.refresh();
                }}
              >
                <Icon.Logout size={15} /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {connection === "lost" && (
          <div className="flex items-center justify-center gap-2 bg-red px-4 py-1.5 text-center text-[13px] font-semibold text-white" role="alert">
            <Icon.WifiOff size={14} /> Live connection lost, reconnecting.
          </div>
        )}

        <main className="flex-1">
          {role === "evaluator" && ADMIN_ONLY.some((p) => pathname.startsWith(p)) ? <NotForYou /> : children}
        </main>
      </div>
    </div>
  );
}

/**
 * Which nav entry the current URL belongs to.
 *
 * The longest matching href wins, so /admin/problems/7 lands on Problems while
 * /admin/problems/order keeps its own row, and a question's own page lights up
 * the list it came from.
 */
function current(pathname: string, nav: Group[]): { group: string; href: string } | null {
  let best: { group: string; href: string } | null = null;
  let length = -1;
  for (const g of nav) {
    for (const href of g.items?.map((it) => it.href) ?? [g.href ?? ""]) {
      const matches = href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(href + "/");
      if (matches && href.length > length) {
        best = { group: g.label, href };
        length = href.length;
      }
    }
  }
  return best;
}

/** An honest dead end rather than a screen of failed requests. */
function NotForYou() {
  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full border bg-muted text-faint">
        <Icon.Lock size={18} />
      </div>
      <h1 className="text-[15px] font-semibold">This one is the administrator's</h1>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
        Evaluators grade, author questions and read every board. Contest settings and staff accounts belong to whoever is running the day.
      </p>
      <Link href="/grade" className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand-deep hover:underline">
        Back to grading <Icon.ChevronRight size={13} />
      </Link>
    </div>
  );
}

/** A dot and a word. The detail lives on the Judge page; this only says whether to go there. */
function Health({ label, ok, bad }: { label: string; ok: boolean | null; bad: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11.5px]" title={ok === false ? bad : undefined}>
      <span className={cn("size-1.5 shrink-0 rounded-full", ok === null ? "bg-white/30" : ok ? "bg-green-bright" : "animate-pulse bg-red")} />
      <span className={ok === false ? "font-semibold text-red" : "text-white/50"}>{ok === false ? bad : label}</span>
    </span>
  );
}
