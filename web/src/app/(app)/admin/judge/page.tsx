"use client";

/**
 * The judge: is it up, what is it doing right now, and what has it just done.
 *
 * The old version of this page answered only the first question — four tiles
 * and a health line — which is the least useful third of it. When a judge is
 * misbehaving during a contest the thing you need is the queue itself: whose
 * work is sitting in it, how long it has been sitting, and whether it is the
 * same package failing over and over.
 *
 * Three kinds of work end up here, and all three are shown, because "the judge
 * is busy" is meaningless if half of what it is busy with is invisible: code
 * submissions, hacks (a participant's input run against someone else's
 * solution), and the validator runs that score Section A at close.
 *
 * The list is split in two on purpose. What is in flight is a live thing you
 * watch and it is ordered oldest-first, because the one that has been waiting
 * longest is the one that is wrong. What has finished is a record you search,
 * so it is newest-first, filterable and paged from the URL.
 */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge, VerdictBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/field";
import { PageBody, PageHeader, Section, Toolbar } from "@/components/ui/page";
import { Pagination, usePaged } from "@/components/ui/pagination";
import { StatStripSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { Stat, StatRow } from "@/components/ui/stat";
import { Summary, SummaryItem } from "@/components/ui/summary";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/client";
import { fromHere } from "@/lib/came-from";
import { cn } from "@/lib/utils";

import { Elapsed, KIND, STATE_WORDS, type Work, type WorkKind, duration, hrefOf } from "./work";

type Feed = {
  judge: { status: string; go_judge: string; problems: number; busy: number; capacity: number } | null;
  backlog: { pending: number; inFlight: number; retrying: number; internalErrors: number };
  work: Work[];
  counts: { live: number; queued: number; running: number; retrying: number; errors: number; hacks: number };
};

/* Poll hard while something is in flight, and back off to a heartbeat when the
 * queue is empty — there is nothing to watch between rounds, and this page is
 * left open on a second monitor for hours. */
const BUSY_MS = 1500;
const IDLE_MS = 6000;

const KINDS: ({ key: "all"; label: string } | { key: WorkKind; label: string })[] = [
  { key: "all", label: "Everything" },
  { key: "submission", label: "Code" },
  { key: "run", label: "Runs" },
  { key: "hack", label: "Hacks" },
  { key: "validator", label: "Validator" },
];

export default function JudgePage() {
  const router = useRouter();
  const open = (w: Work) => { const href = hrefOf(w); if (href) router.push(fromHere(href, "/admin/judge")); };
  const [feed, setFeed] = useState<Feed | null>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<"all" | WorkKind>("all");
  const [filter, setFilter] = useState("");
  const inFlight = useRef(false);

  const load = useCallback(async (manual = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (manual) setBusy(true);
    try {
      setFeed(await api.get<Feed>("/api/admin/judge/activity"));
    } catch {
      setFeed((f) => (f ? { ...f, judge: null } : null));
    } finally {
      inFlight.current = false;
      if (manual) setBusy(false);
    }
  }, []);

  // One timer, re-armed at the cadence the current state deserves. A drawer
  // being open does not pause it: the row behind it is often the one changing.
  const live = feed?.counts.live ?? 0;
  useEffect(() => {
    void load();
    const t = setInterval(() => {
      if (!document.hidden) void load();
    }, live > 0 ? BUSY_MS : IDLE_MS);
    return () => clearInterval(t);
  }, [load, live > 0]);

  const down = Boolean(feed) && (!feed!.judge || feed!.judge.status !== "ok");
  const all = feed?.work ?? [];
  const match = (w: Work) => {
    if (kind !== "all" && w.kind !== kind) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      w.name.toLowerCase().includes(q) ||
      w.target.toLowerCase().includes(q) ||
      (w.problem_id ?? "").toLowerCase().includes(q) ||
      (w.job_id ?? "").toLowerCase().includes(q)
    );
  };
  const running = all.filter((w) => w.live && match(w));
  const settled = all.filter((w) => !w.live && match(w));
  const paged = usePaged(settled, { param: "page", size: 20 });

  return (
    <PageBody width="wide">
      <PageHeader
        title="Judge"
        description="Every request sent to the judge, submissions, hacks and validator runs."
        actions={
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-[12px] text-muted-foreground sm:flex">
              <span className={cn("size-1.5 rounded-full", live > 0 ? "animate-pulse bg-blue" : "bg-line-2")} />
              {live > 0 ? `refreshing every ${BUSY_MS / 1000}s` : "idle"}
            </span>
            <Button variant="outline" size="sm" onClick={() => load(true)} loading={busy}>
              <Icon.Refresh size={14} /> Re-check
            </Button>
          </div>
        }
      />

      {!feed ? (
        <div className="space-y-5">
          <StatStripSkeleton cols={4} />
          <TableSkeleton rows={4} cols={5} />
          <TableSkeleton rows={8} cols={6} />
        </div>
      ) : (
        <div className="space-y-5">
          {down && (
            <Alert variant="destructive">
              <Icon.Alert />
              <AlertTitle>The judge is not answering</AlertTitle>
              <AlertDescription>
                Nothing is being judged. Work queues and retries on its own, so none of it is lost. Participants see "judging"
                rather than an error. Check the sandbox container is running and the judge API is listening.
              </AlertDescription>
            </Alert>
          )}

          <StatRow cols={4}>
            <Stat
              label="Status"
              value={down ? "Down" : "Healthy"}
              tone={down ? "destructive" : "success"}
              icon={<Icon.Server size={13} />}
              hint={
                feed.judge
                  ? `sandbox ${feed.judge.go_judge} · ${feed.judge.problems} package${feed.judge.problems === 1 ? "" : "s"} · ${feed.judge.busy}/${feed.judge.capacity} slots`
                  : "not answering"
              }
            />
            <Stat
              label="In flight"
              value={feed.counts.live}
              tone={feed.counts.live > 0 ? "info" : "default"}
              icon={<Icon.Play size={13} />}
              hint={
                feed.counts.live === 0
                  ? "nothing waiting"
                  : `${feed.counts.running} running, ${feed.counts.queued} queued${
                      feed.counts.hacks ? `, ${feed.counts.hacks} of them hacks` : ""
                    }`
              }
            />
            <Stat
              label="Retrying"
              value={feed.counts.retrying}
              tone={feed.counts.retrying ? "warning" : "default"}
              icon={<Icon.Refresh size={13} />}
              hint={feed.counts.retrying ? "the judge has not accepted these yet" : "nothing stuck"}
            />
            <Stat
              label="Judge errors"
              value={feed.counts.errors}
              tone={feed.counts.errors ? "destructive" : "default"}
              icon={<Icon.Alert size={13} />}
              hint={feed.counts.errors ? "these scored nothing and need a human" : "none"}
            />
          </StatRow>

          {running.length === 0 ? (
            /* An idle queue is the normal state between rounds, and it does not
             * deserve a card with a picture in it. One line — and when nothing
             * has ever been sent, this is the page's only empty message rather
             * than the first of two. */
            <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-[12.5px] text-muted-foreground shadow-xs">
              <Icon.CircleCheck size={14} className="text-green" />
              {all.length === 0
                ? "Nothing has been sent to the judge yet. Requests appear here the moment a round opens."
                : "Nothing is waiting on the judge right now."}
            </div>
          ) : (
          <Section
            title="In flight"
            description="Longest wait first. A row that stops moving is the one to look at."
            padded={false}
          >
            {(
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">Kind</TableHead>
                    <TableHead>Participant</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead className="w-56">Doing</TableHead>
                    <TableHead className="hidden w-40 lg:table-cell">Judge job</TableHead>
                    <TableHead className="w-24 text-right">Waiting</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {running.map((w) => (
                    <Row key={w.key} w={w} onOpen={() => open(w)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={cn("size-1.5 shrink-0 rounded-full", w.state === "running" ? "animate-pulse bg-blue" : "bg-amber-bg")} />
                          <span className="truncate text-[12.5px] text-muted-foreground">
                            {w.progress && w.state === "running"
                              ? `test ${w.progress.done} of ${w.progress.total}`
                              : STATE_WORDS[w.state]}
                          </span>
                        </div>
                        {w.progress && w.progress.total > 0 && (
                          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-blue transition-[width] duration-300"
                              style={{ width: `${Math.min(100, (w.progress.done / w.progress.total) * 100)}%` }}
                            />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {w.job_id ? (
                          <span className="block max-w-[15ch] truncate font-mono text-[11px] text-faint" title={w.job_id}>
                            {w.job_id}
                          </span>
                        ) : (
                          <span className="text-[11.5px] text-amber">not accepted</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <Elapsed since={w.created_at} className="text-[12.5px] text-muted-foreground" />
                        {w.retries > 0 && (
                          <span className="ml-1.5 text-[11px] text-amber" title={`sent again ${w.retries} times`}>
                            ×{w.retries + 1}
                          </span>
                        )}
                      </TableCell>
                    </Row>
                  ))}
                </TableBody>
              </Table>
            )}
          </Section>
          )}

          <Section
            title="Finished"
            description={
              all.length === 0
                ? "Nothing answered yet."
                : "Everything the judge has answered, newest first. Open one for the code, the input and the jury detail."
            }
            padded={false}
          >
            {/* Nothing to filter until something has been judged. */}
            {all.length > 0 && (
            <Toolbar
              actions={
                <div className="flex items-center gap-1 rounded-md border bg-card p-0.5">
                  {KINDS.map((k) => (
                    <button
                      key={k.key}
                      type="button"
                      onClick={() => setKind(k.key)}
                      aria-pressed={kind === k.key}
                      className={cn(
                        "rounded-[4px] px-2.5 py-1 text-[12px] font-medium transition-colors",
                        kind === k.key ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
              }
            >
              <SearchInput
                className="w-full sm:w-72"
                placeholder="Participant, problem or job id"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                onClear={() => setFilter("")}
              />
            </Toolbar>
            )}

            {settled.length === 0 ? (
              all.length === 0 ? (
                <p className="px-5 py-6 text-[12.5px] text-muted-foreground">
                  Answered requests are listed here, newest first. Open one for the code, the input and the jury detail.
                </p>
              ) : (
                <EmptyState icon={<Icon.Gavel />} title="Nothing matches" body="Try a different filter." />
              )
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Time</TableHead>
                      <TableHead className="w-28">Kind</TableHead>
                      <TableHead>Participant</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead className="w-64">Result</TableHead>
                      <TableHead className="hidden w-20 text-right sm:table-cell">Took</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.rows.map((w) => (
                      <Row key={w.key} w={w} onOpen={() => open(w)} time>
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-1.5">
                            {w.kind === "submission" || w.kind === "run" ? <VerdictBadge verdict={w.verdict} /> : w.label ? <Badge variant={w.tone}>{w.label}</Badge> : null}
                            <span className="truncate text-[12.5px] text-muted-foreground" title={w.outcome ?? ""}>
                              {w.outcome}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-right text-[12.5px] text-muted-foreground tabular-nums sm:table-cell">
                          {duration(w.duration_ms)}
                        </TableCell>
                      </Row>
                    ))}
                  </TableBody>
                </Table>
                <Pagination paged={paged} unit="requests" className="px-4" />
              </>
            )}
          </Section>
        </div>
      )}

    </PageBody>
  );
}

/**
 * A row you can open. The whole row is the target rather than a trailing
 * "Inspect" button — every row here is worth opening, and a button per row
 * would be 200 buttons that all say the same word.
 */
function Row({
  w,
  onOpen,
  time = false,
  children,
}: {
  w: Work;
  onOpen: () => void;
  time?: boolean;
  children: React.ReactNode;
}) {
  const k = KIND[w.kind];
  const openable = hrefOf(w) !== null;
  return (
    <TableRow
      tabIndex={openable ? 0 : undefined}
      role={openable ? "button" : undefined}
      onClick={openable ? onOpen : undefined}
      onKeyDown={(e) => {
        if (openable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        openable && "cursor-pointer focus-visible:bg-accent focus-visible:outline-none",
        w.state === "error" && "bg-red-tint/40",
        w.superseded && "opacity-55",
      )}
    >
      {time && (
        <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
          {new Date(w.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </TableCell>
      )}
      <TableCell>
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
          <span className="text-faint">{k.icon}</span>
          {k.label}
        </span>
      </TableCell>
      <TableCell className="max-w-[18ch] truncate font-medium" title={w.name}>
        {w.name}
      </TableCell>
      <TableCell className="min-w-0">
        <span className="block max-w-[24ch] truncate" title={w.target}>
          {w.target}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-faint">
          {w.problem_id && <span className="max-w-[16ch] truncate font-mono">{w.problem_id}</span>}
          {w.language && <span>{w.language}</span>}
          {w.attempt !== null && w.attempt > 1 && <Badge variant="info">rejudge {w.attempt - 1}</Badge>}
        </span>
      </TableCell>
      {children}
    </TableRow>
  );
}
