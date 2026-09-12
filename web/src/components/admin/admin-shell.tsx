"use client";

/**
 * The administrator frame. A persistent sidebar carries the whole
 * information architecture, grouped by what you are doing — running the
 * contest, preparing content, managing people, watching it work. The top bar
 * holds only what must always be true: the phase, the clock, and who you are.
 *
 * Participants and evaluators get components/shell.tsx instead; their job is
 * a linear flow, not a console.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/client";

import { useContest } from "../contest-provider";
import { Countdown } from "../countdown";
import { Icon } from "../icons";
import { Mark } from "../logo";
import { PHASE_LABEL } from "../shell";

type Item = { href: string; label: string; icon: (p: { size?: number }) => React.ReactElement };

const NAV: { section: string | null; items: Item[] }[] = [
  { section: null, items: [{ href: "/admin", label: "Dashboard", icon: Icon.Grid }] },
  { section: "Content", items: [
    { href: "/admin/problems", label: "Problems", icon: Icon.Code },
    { href: "/admin/phase1", label: "Phase 1", icon: Icon.Puzzle },
  ] },
  { section: "People", items: [
    { href: "/admin/participants", label: "Participants", icon: Icon.Users },
  ] },
  { section: "Monitor", items: [
    { href: "/admin/submissions", label: "Submissions", icon: Icon.List },
    { href: "/admin/audit", label: "Audit log", icon: Icon.Shield },
  ] },
  { section: "Configure", items: [
    { href: "/admin/contest", label: "Settings", icon: Icon.Settings },
  ] },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { state, connected } = useContest();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);      // mobile drawer
  const [menu, setMenu] = useState(false);
  const [judgeOk, setJudgeOk] = useState<boolean | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setOpen(false); setMenu(false); }, [pathname]);
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
  useEffect(() => {
    const poll = async () => {
      try { const h = await api.get<{ judge: { status: string } | null }>("/api/admin/health"); setJudgeOk(h.judge?.status === "ok"); }
      catch { setJudgeOk(false); }
    };
    void poll();
    const t = setInterval(poll, 15_000);
    return () => clearInterval(t);
  }, []);

  if (!state) return null;
  const { viewer, contest } = state;

  const sidebar = (
    <div className="flex h-full w-60 flex-col bg-navy text-white">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-white/10 px-5">
        <Mark size={24} />
        <span className="text-[15px] font-bold tracking-tight">Cod<span className="text-green-bright">olympics</span></span>
        <span className="ml-auto rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/60">Admin</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Administration">
        {NAV.map((group, gi) => (
          <div key={group.section ?? gi} className={gi ? "mt-6" : ""}>
            {group.section && <div className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/35">{group.section}</div>}
            <ul className="space-y-0.5">
              {group.items.map(({ href, label, icon: I }) => {
                const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link href={href} aria-current={active ? "page" : undefined}
                      className={`group flex items-center gap-2.5 rounded-box px-2.5 py-2 text-[13px] font-medium transition-colors ${
                        active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white/90"}`}>
                      <I size={16} />
                      <span>{label}</span>
                      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-green-bright" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        <div className="flex items-center gap-2 rounded-box px-2.5 py-2 text-[12px]">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${judgeOk === null ? "bg-white/30" : judgeOk ? "bg-green-bright" : "bg-red animate-pulse"}`} />
          <span className="text-white/60">Judge</span>
          <span className={`ml-auto font-semibold ${judgeOk === false ? "text-red" : "text-white/80"}`}>{judgeOk === null ? "…" : judgeOk ? "healthy" : "unreachable"}</span>
        </div>
        <div className="flex items-center gap-2 rounded-box px-2.5 py-2 text-[12px]">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${connected ? "bg-green-bright" : "bg-red animate-pulse"}`} />
          <span className="text-white/60">Live updates</span>
          <span className="ml-auto font-semibold text-white/80">{connected ? "on" : "reconnecting"}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-page">
      <aside className="sticky top-0 hidden h-screen shrink-0 lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 shadow-xl">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-card px-4 lg:px-8">
          <button className="rounded-box p-1.5 text-muted hover:bg-page lg:hidden" aria-label="Open navigation" onClick={() => setOpen(true)}><Icon.Menu size={18} /></button>

          <div className="flex items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-navy px-2.5 py-1 text-xs font-semibold text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-green-bright" />
              {PHASE_LABEL[contest.phase] ?? contest.phase}
            </span>
            {contest.phase_ends_at && (
              <span className="hidden items-center gap-1.5 text-muted sm:inline-flex">
                <Icon.Clock size={14} /><Countdown until={contest.phase_ends_at} className="font-semibold text-ink" />
              </span>
            )}
          </div>

          <div ref={menuRef} className="relative ml-auto">
            <button onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu}
              className="flex items-center gap-2 rounded-box px-1.5 py-1 text-sm hover:bg-page">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy text-xs font-bold text-green-bright">{viewer.name.slice(0, 1).toUpperCase()}</span>
              <span className="hidden max-w-32 truncate font-medium sm:inline">{viewer.name}</span>
              <Icon.ChevronDown size={14} className="text-faint" />
            </button>
            {menu && (
              <div role="menu" className="absolute right-0 mt-1.5 w-52 overflow-hidden rounded-box border border-line bg-card py-1 shadow-lg">
                <div className="border-b border-line px-3 py-2 text-xs text-muted">Signed in as <span className="font-semibold text-ink">{viewer.name}</span><div className="mt-0.5 capitalize">{viewer.role}</div></div>
                <button role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-page"
                  onClick={async () => { await authClient.signOut(); router.push("/login"); router.refresh(); }}>
                  <Icon.Logout size={15} /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>

        {!connected && <div className="bg-red px-4 py-1.5 text-center text-sm font-semibold text-white" role="alert">Live connection lost — reconnecting.</div>}

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
