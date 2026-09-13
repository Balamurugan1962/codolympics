"use client";

/**
 * The administrator frame. A persistent navy sidebar carries the whole
 * information architecture, grouped by what you are doing — running the
 * contest, preparing content, managing people, watching it work. The top bar
 * holds only what must always be true: the phase, the clock, and who you are.
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

type Item = { href: string; label: string; icon: (p: { size?: number }) => React.ReactElement };

const NAV: { section: string | null; items: Item[] }[] = [
  {
    section: null,
    items: [
      { href: "/admin", label: "Dashboard", icon: Icon.Grid },
      { href: "/admin/readiness", label: "Readiness", icon: Icon.ListChecks },
    ],
  },
  {
    section: "Content",
    items: [
      { href: "/admin/problems", label: "Problems", icon: Icon.Code },
      { href: "/admin/phase1", label: "Phase 1", icon: Icon.Puzzle },
    ],
  },
  {
    section: "People",
    items: [
      { href: "/admin/participants", label: "Participants", icon: Icon.Users },
      { href: "/admin/staff", label: "Staff", icon: Icon.ShieldCheck },
      { href: "/admin/announcements", label: "Announcements", icon: Icon.Megaphone },
    ],
  },
  {
    section: "Monitor",
    items: [
      { href: "/admin/submissions", label: "Submissions", icon: Icon.List },
      { href: "/admin/audit", label: "Audit log", icon: Icon.Shield },
    ],
  },
  { section: "Configure", items: [{ href: "/admin/contest", label: "Settings", icon: Icon.Settings }] },
];

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

  const sidebar = (
    <div className="flex h-full w-60 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-5">
        <Mark size={24} />
        <span className="text-[15px] font-bold tracking-tight text-white">
          Cod<span className="text-green-bright">olympics</span>
        </span>
        <span className="ml-auto rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white/60 uppercase">
          Admin
        </span>
      </div>

      <nav className="pane flex-1 overflow-y-auto px-3 py-4" aria-label="Administration">
        {NAV.map((group, gi) => (
          <div key={group.section ?? gi} className={gi ? "mt-6" : ""}>
            {group.section && (
              <div className="mb-1.5 px-2.5 text-[10px] font-semibold tracking-[0.1em] text-white/35 uppercase">{group.section}</div>
            )}
            <ul className="space-y-0.5">
              {group.items.map(({ href, label, icon: I }) => {
                const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                        active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white/90",
                      )}
                    >
                      <I size={16} />
                      <span>{label}</span>
                      {active && <span className="ml-auto size-1.5 rounded-full bg-green-bright" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-3">
        <HealthRow label="Judge" ok={judgeOk} okText="healthy" badText="unreachable" />
        <HealthRow label="Live updates" ok={connection === "connecting" ? null : connection === "open"} okText="on" badText="reconnecting" />
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen shrink-0 lg:block">{sidebar}</aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-60 gap-0 border-sidebar-border bg-sidebar p-0">
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
              <span className="size-1.5 rounded-full bg-green-bright" />
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
                  <AvatarFallback className="bg-navy text-[11px] font-bold text-green-bright">
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
            <Icon.WifiOff size={14} /> Live connection lost — reconnecting.
          </div>
        )}

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

function HealthRow({ label, ok, okText, badText }: { label: string; ok: boolean | null; okText: string; badText: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px]">
      <span className={cn("size-1.5 shrink-0 rounded-full", ok === null ? "bg-white/30" : ok ? "bg-green-bright" : "animate-pulse bg-red")} />
      <span className="text-white/55">{label}</span>
      <span className={cn("ml-auto font-semibold", ok === false ? "text-red" : "text-white/80")}>
        {ok === null ? "…" : ok ? okText : badText}
      </span>
    </div>
  );
}
