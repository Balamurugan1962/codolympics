"use client";

/**
 * The judge: is it up, what is it doing, and is anything stuck.
 *
 * Its own page rather than four tiles on the dashboard. Health is a question
 * you ask when something looks wrong, and when you ask it you want the whole
 * answer — the queue, the retries, the internal errors and where to go next —
 * not a number with no context. The dashboard keeps one line saying whether to
 * come here at all.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageBody, PageHeader, Section } from "@/components/ui/page";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Stat, StatRow, StatSkeleton } from "@/components/ui/stat";
import { Summary, SummaryItem } from "@/components/ui/summary";
import { api } from "@/lib/client";

type Health = {
  judge: { status: string; go_judge: string; problems: number; busy: number; capacity: number } | null;
  backlog: { pending: number; inFlight: number; retrying: number; internalErrors: number };
};

export default function JudgePage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setHealth(await api.get<Health>("/api/admin/health"));
    } catch {
      setHealth({ judge: null, backlog: { pending: 0, inFlight: 0, retrying: 0, internalErrors: 0 } });
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const down = Boolean(health) && (!health!.judge || health!.judge.status !== "ok");
  const b = health?.backlog;

  return (
    <PageBody>
      <PageHeader
        title="Judge"
        description="The sandbox that compiles and runs every submission. Everything scored in this contest passes through it."
        actions={
          <Button variant="outline" size="sm" onClick={load} loading={busy}>
            <Icon.Refresh size={14} /> Re-check
          </Button>
        }
      />

      {!health ? (
        <div className="space-y-5">
          <StatRow cols={4}>
            {Array.from({ length: 4 }).map((_, i) => (
              <StatSkeleton key={i} />
            ))}
          </StatRow>
          <CardSkeleton lines={5} />
        </div>
      ) : (
        <div className="space-y-5">
          {down && (
            <Alert variant="destructive">
              <Icon.Alert />
              <AlertTitle>The judge is unreachable</AlertTitle>
              <AlertDescription>
                Nothing can be judged until it is back. Submissions queue and retry on their own, so none are lost — participants see
                "judging" rather than an error. Check the sandbox container is running and that the judge API is listening.
              </AlertDescription>
            </Alert>
          )}

          <StatRow cols={4}>
            <Stat
              label="Status"
              value={down ? "Down" : "Healthy"}
              tone={down ? "destructive" : "success"}
              icon={<Icon.Server size={13} />}
              hint={health.judge ? `${health.judge.busy} of ${health.judge.capacity} slots busy` : "not answering"}
            />
            <Stat
              label="In flight"
              value={b?.inFlight ?? 0}
              icon={<Icon.Play size={13} />}
              hint={b?.pending ? `${b.pending} waiting to be sent` : "nothing waiting"}
            />
            <Stat
              label="Retrying"
              value={b?.retrying ?? 0}
              tone={b?.retrying ? "warning" : "default"}
              icon={<Icon.Refresh size={13} />}
              hint={b?.retrying ? "the judge has not accepted these yet" : "nothing stuck"}
            />
            <Stat
              label="Internal errors"
              value={b?.internalErrors ?? 0}
              tone={b?.internalErrors ? "destructive" : "default"}
              icon={<Icon.Alert size={13} />}
              hint={b?.internalErrors ? "these need a human" : "none"}
            />
          </StatRow>

          <Section title="What the judge is running" description="Reported by the judge itself, refreshed every five seconds.">
            <Summary cols={3}>
              <SummaryItem label="Sandbox">{health.judge?.go_judge ?? <span className="text-faint">unreachable</span>}</SummaryItem>
              <SummaryItem label="Packages on disk">{health.judge?.problems ?? <span className="text-faint">—</span>}</SummaryItem>
              <SummaryItem label="Concurrency">
                {health.judge ? `${health.judge.busy} running of ${health.judge.capacity}` : <span className="text-faint">—</span>}
              </SummaryItem>
            </Summary>
          </Section>

          {(b?.internalErrors ?? 0) > 0 && (
            <Alert variant="warning">
              <Icon.Alert />
              <AlertTitle>
                {b!.internalErrors} submission{b!.internalErrors === 1 ? "" : "s"} ended in an internal error
              </AlertTitle>
              <AlertDescription>
                An internal error is the judge's fault, not the competitor's, and it scores nothing. Open them in{" "}
                <Link href="/admin/submissions" className="font-semibold text-brand-deep hover:underline">
                  Submissions
                </Link>{" "}
                and rejudge once the cause is fixed.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </PageBody>
  );
}
