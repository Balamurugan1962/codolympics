"use client";

/** The audit log: who did what, when, and why. Disputes are settled from here. */
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/field";
import { PageBody, PageHeader, Section, Toolbar } from "@/components/ui/page";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/client";

type E = { id: number; actor: string | null; action: string; target: string | null; reason: string; detail: unknown; created_at: string };

export default function AuditPage() {
  const [rows, setRows] = useState<E[] | null>(null);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    void api.get<{ entries: E[] }>("/api/admin/audit").then((r) => setRows(r.entries));
  }, []);

  const q = filter.toLowerCase();
  const shown = (rows ?? []).filter(
    (e) =>
      !q ||
      e.action.includes(q) ||
      (e.actor ?? "").toLowerCase().includes(q) ||
      (e.target ?? "").toLowerCase().includes(q) ||
      e.reason.toLowerCase().includes(q),
  );

  return (
    <PageBody width="wide">
      <PageHeader
        title="Audit log"
        actions={
          <Button variant="outline" asChild>
            <a href="/api/admin/export" download>
              <Icon.Download size={14} /> Export everything
            </a>
          </Button>
        }
      />

      {!rows ? (
        <CardSkeleton lines={8} />
      ) : (
        <Section padded={false}>
          <Toolbar>
            <SearchInput
              className="w-full sm:w-80"
              placeholder="Filter by action, actor, target or reason"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onClear={() => setFilter("")}
            />
            <span className="ml-auto text-[12px] text-muted-foreground">
              {shown.length} of {rows.length}
            </span>
          </Toolbar>
          {shown.length === 0 ? (
            <EmptyState
              icon={<Icon.Shield />}
              title={rows.length === 0 ? "Nothing logged yet" : "Nothing matches that filter"}
              body={rows.length === 0 ? "Entries appear as soon as anything is changed." : undefined}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden sm:table-cell">Time</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="hidden md:table-cell">Target</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="hidden xl:table-cell">Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                      {new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </TableCell>
                    <TableCell className="font-medium">{e.actor ?? <span className="font-normal text-faint">system</span>}</TableCell>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-[11.5px]">{e.action}</code>
                    </TableCell>
                    <TableCell className="hidden font-mono text-[11.5px] text-muted-foreground md:table-cell">{e.target}</TableCell>
                    <TableCell className="max-w-[32ch] truncate" title={e.reason}>
                      {e.reason}
                    </TableCell>
                    <TableCell
                      className="hidden max-w-[24ch] truncate font-mono text-[11px] text-faint xl:table-cell"
                      title={JSON.stringify(e.detail)}
                    >
                      {e.detail ? JSON.stringify(e.detail) : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
      )}
    </PageBody>
  );
}
