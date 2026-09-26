"use client";

/**
 * Every time a participant left the contest screen: who, how, and when. The
 * organisers hear about each one as it happens (a toast); this is the record
 * to look back at when someone disputes a lock or the room asks who kept
 * leaving.
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { LEFT_HOW } from "@/components/admin/left-page-alerts";
import { useEngineEvent } from "@/components/contest-provider";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/field";
import { PageBody, PageHeader, Section, Toolbar } from "@/components/ui/page";
import { Pagination, usePaged } from "@/components/ui/pagination";
import { FilterChips } from "@/components/ui/record";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, errorMessage } from "@/lib/client";

type Kind = keyof typeof LEFT_HOW;
type Exit = { id: number; participant_id: string; name: string; kind: Kind; created_at: string; locked: boolean };
type Show = "all" | Kind;

const LABEL: Record<Kind, string> = { fullscreen: "Left full screen", blur: "Switched window", hidden: "Hid the tab" };

const when = (iso: string) =>
  new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function ScreenExitsPage() {
  const [rows, setRows] = useState<Exit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState<Show>("all");
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    try {
      setRows((await api.get<{ events: Exit[] }>("/api/admin/proctoring")).events);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  // The page keeps itself current: a new exit appears the moment it happens.
  useEngineEvent("proctor", () => void load());

  // One pass for both tallies, and the filtered list keeps its identity between keystrokes it does not depend on.
  const { perPerson, perKind } = useMemo(() => {
    const person = new Map<string, number>();
    const kind: Record<Kind, number> = { fullscreen: 0, blur: 0, hidden: 0 };
    for (const e of rows ?? []) {
      person.set(e.participant_id, (person.get(e.participant_id) ?? 0) + 1);
      kind[e.kind] += 1;
    }
    return { perPerson: person, perKind: kind };
  }, [rows]);
  const q = filter.trim().toLowerCase();
  const shown = useMemo(
    () => (rows ?? []).filter((e) => (show === "all" || e.kind === show) && (!q || e.name.toLowerCase().includes(q))),
    [rows, show, q],
  );
  const paged = usePaged(shown, { param: "page" });
  const none = (rows ?? []).length === 0;

  return (
    <PageBody width="wide">
      <PageHeader
        title="Screen exits"
        description="Every time a participant left full screen, switched to another window or hid the tab. Newest first, and it updates live."
      />

      {error ? (
        <EmptyState icon={<Icon.Shield />} title="Could not load the log" body={error} />
      ) : !rows ? (
        <PageSkeleton rows={8} cols={5} />
      ) : (
        <Section padded={false}>
          <Toolbar>
            <FilterChips<Show>
              label="Show"
              value={show}
              onChange={setShow}
              options={[
                { value: "all", label: "All", count: rows.length },
                ...(Object.keys(LABEL) as Kind[]).map((k) => ({ value: k, label: LABEL[k], count: perKind[k] })),
              ]}
            />
            <SearchInput
              className="w-full sm:ml-auto sm:w-64"
              placeholder="Find a participant"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onClear={() => setFilter("")}
            />
          </Toolbar>
          {shown.length === 0 ? (
            <EmptyState
              icon={<Icon.Expand />}
              title={none ? "Nobody has left the page" : "Nothing matches that filter"}
              body={none ? "Exits are recorded while proctoring is on and a round is running." : undefined}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Participant</TableHead>
                    <TableHead>What they did</TableHead>
                    <TableHead className="hidden sm:table-cell">Their exits</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.rows.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{when(e.created_at)}</TableCell>
                      <TableCell className="font-medium">
                        <Link href={`/admin/participants/${e.participant_id}`} className="hover:underline">{e.name}</Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={e.kind === "fullscreen" ? "warning" : "neutral"}>{LABEL[e.kind]}</Badge>
                      </TableCell>
                      <TableCell className="hidden tabular-nums text-muted-foreground sm:table-cell">{perPerson.get(e.participant_id)}</TableCell>
                      <TableCell>{e.locked ? <Badge variant="destructive">Locked out</Badge> : <span className="text-faint">Active</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination paged={paged} unit="exits" />
            </>
          )}
        </Section>
      )}
    </PageBody>
  );
}
