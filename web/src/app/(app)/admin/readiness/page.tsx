"use client";

/**
 * The pre-contest checklist, on its own page.
 *
 * It answers one question — can this contest be run today? — and it is read
 * closely once or twice before the doors open, not glanced at all day. That is
 * a different job from the dashboard, which is for the hour you are in, so it
 * gets the room to say what each item means and where to go and fix it.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageBody, PageHeader, Section } from "@/components/ui/page";
import { Progress } from "@/components/ui/progress";
import { ListSkeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client";
import { cn } from "@/lib/utils";

type Item = { key: string; label: string; ok: boolean; detail: string; href: string };
type Readiness = { items: Item[]; done: number; total: number };

/**
 * The order the checklist is worked through, and what each group is for. Keys
 * not listed here still appear, under "Other" — the server owns the list.
 */
const GROUPS: { title: string; blurb: string; icon: (p: { size?: number }) => React.ReactElement; keys: string[] }[] = [
  {
    title: "The judge and its problems",
    blurb: "Nothing can be solved or scored until every question has a package the judge can actually run.",
    icon: Icon.Server,
    keys: ["judge", "problems", "details", "validated"],
  },
  {
    title: "Phase 1",
    blurb: "The qualifying round needs published questions and a stated basis for who advances.",
    icon: Icon.Puzzle,
    keys: ["phase1", "basis"],
  },
  {
    title: "People",
    blurb: "Someone to compete, and someone other than you to grade.",
    icon: Icon.Users,
    keys: ["evaluators", "participants", "registration"],
  },
];

export default function ReadinessPage() {
  const [ready, setReady] = useState<Readiness | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setReady(await api.get<Readiness>("/api/admin/readiness"));
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  const items = ready?.items ?? [];
  const placed = new Set(GROUPS.flatMap((g) => g.keys));
  const other = items.filter((i) => !placed.has(i.key));
  const groups = [
    ...GROUPS.map((g) => ({ ...g, items: g.keys.map((k) => items.find((i) => i.key === k)).filter(Boolean) as Item[] })),
    ...(other.length ? [{ title: "Other", blurb: "", icon: Icon.List, items: other }] : []),
  ].filter((g) => g.items.length > 0);

  const outstanding = ready ? ready.total - ready.done : 0;
  const allClear = Boolean(ready) && outstanding === 0;

  return (
    <PageBody>
      <PageHeader
        title="Readiness"
        actions={
          <Button variant="outline" size="sm" onClick={load} loading={busy}>
            <Icon.Refresh size={14} /> Re-check
          </Button>
        }
      />

      {!ready ? (
        <ListSkeleton rows={9} />
      ) : (
        <div className="space-y-5">
          <Card className={cn("overflow-hidden", allClear && "border-green/40")}>
            <div className={cn("flex flex-wrap items-center gap-3 px-4 py-3", allClear ? "bg-green-tint" : "bg-amber-tint/50")}>
              <span className={cn("shrink-0", allClear ? "text-green-dark" : "text-amber")}>
                {allClear ? <Icon.Check size={16} strokeWidth={3} /> : <Icon.Alert size={16} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold">
                  {allClear ? "Ready to run" : `${outstanding} thing${outstanding === 1 ? "" : "s"} left to fix`}
                </div>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
                  {allClear
                    ? "Every check passes. Open registration and start Phase 1."
                    : "None of these block experimenting. They block a fair contest."}
                </p>
              </div>
              <div className="w-full sm:w-52">
                <div className="mb-1.5 flex items-baseline justify-between text-[12px]">
                  <span className="font-semibold tabular-nums">
                    {ready.done} of {ready.total}
                  </span>
                  <span className="text-muted-foreground">passing</span>
                </div>
                <Progress
                  value={(ready.done / Math.max(1, ready.total)) * 100}
                  className={cn("h-2", allClear ? "bg-green/20" : "bg-line-2/60")}
                />
              </div>
            </div>
          </Card>

          {groups.map((g) => {
            const left = g.items.filter((i) => !i.ok).length;
            return (
              <Section
                key={g.title}
                title={
                  <span className="flex items-center gap-2">
                    <g.icon size={15} />
                    {g.title}
                  </span>
                }
                description={g.blurb || undefined}
                actions={
                  <span className={cn("text-[12px] font-semibold tabular-nums", left ? "text-amber" : "text-brand-deep")}>
                    {g.items.length - left}/{g.items.length}
                  </span>
                }
                padded={false}
              >
                <ul className="divide-y">
                  {g.items.map((it) => (
                    <li key={it.key}>
                      <Link href={it.href} className="flex items-center gap-3.5 px-5 py-3 transition-colors hover:bg-muted/50">
                        <span
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-full",
                            it.ok ? "bg-green-tint text-green-dark" : "bg-amber-tint text-amber ring-1 ring-amber-bg/30",
                          )}
                        >
                          {it.ok ? <Icon.Check size={13} strokeWidth={3} /> : <Icon.Alert size={12} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-[13px]", it.ok ? "text-muted-foreground" : "font-semibold")}>{it.label}</span>
                          <span className="mt-0.5 block truncate text-[11.5px] text-faint">{it.detail}</span>
                        </span>
                        <span className="hidden shrink-0 items-center gap-1 text-[12px] font-semibold text-brand-deep sm:flex">
                          {it.ok ? "Review" : "Fix"} <Icon.ChevronRight size={14} />
                        </span>
                        <Icon.ChevronRight size={15} className="shrink-0 text-faint sm:hidden" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Section>
            );
          })}
        </div>
      )}
    </PageBody>
  );
}
