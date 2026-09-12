"use client";

/** The audit log: who did what, when, and why. Disputes are settled from here. */
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/input";
import { PageBody, PageHeader, Section, Toolbar } from "@/components/ui/page";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { api } from "@/lib/client";

type E = { id: number; actor: string | null; action: string; target: string | null; reason: string; detail: unknown; created_at: string };

export default function AuditPage() {
  const [rows, setRows] = useState<E[] | null>(null);
  const [filter, setFilter] = useState("");
  useEffect(() => { void api.get<{ entries: E[] }>("/api/admin/audit").then((r) => setRows(r.entries)); }, []);

  const shown = (rows ?? []).filter((e) => !filter ||
    e.action.includes(filter.toLowerCase()) ||
    (e.actor ?? "").toLowerCase().includes(filter.toLowerCase()) ||
    (e.target ?? "").toLowerCase().includes(filter.toLowerCase()) ||
    e.reason.toLowerCase().includes(filter.toLowerCase()));

  return (
    <PageBody width="wide">
      <PageHeader
        title="Audit log"
        description="Every override, grade and parameter change, with who did it and the reason they gave."
        actions={<a href="/api/admin/export" download><Button variant="secondary" icon={<Icon.Download size={14} />}>Export everything</Button></a>}
      />

      {!rows ? <CardSkeleton lines={8} /> : (
        <Section padded={false}>
          <Toolbar><SearchInput className="w-72" placeholder="Filter by action, actor, target or reason" value={filter} onChange={(e) => setFilter(e.target.value)} /></Toolbar>
          {shown.length === 0 ? (
            <EmptyState icon={<Icon.Shield size={20} />} title={rows.length === 0 ? "Nothing logged yet" : "Nothing matches"} body={rows.length === 0 ? "Entries appear as soon as anything is changed." : undefined} />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th className="hidden sm:table-cell">Time</Th>
                  <Th>Actor</Th>
                  <Th>Action</Th>
                  <Th className="hidden md:table-cell">Target</Th>
                  <Th>Reason</Th>
                  <Th className="hidden xl:table-cell">Detail</Th>
                </tr>
              </thead>
              <tbody>
                {shown.map((e) => (
                  <Tr key={e.id}>
                    <Td className="hidden whitespace-nowrap text-muted sm:table-cell">{new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</Td>
                    <Td className="font-medium">{e.actor ?? <span className="font-normal text-faint">system</span>}</Td>
                    <Td><code className="rounded bg-page px-1.5 py-0.5 text-[11.5px]">{e.action}</code></Td>
                    <Td className="hidden font-mono text-[11.5px] text-muted md:table-cell">{e.target}</Td>
                    <Td className="max-w-[32ch] truncate" title={e.reason}>{e.reason}</Td>
                    <Td className="hidden max-w-[24ch] truncate font-mono text-[11px] text-faint xl:table-cell" title={JSON.stringify(e.detail)}>{e.detail ? JSON.stringify(e.detail) : ""}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Section>
      )}
    </PageBody>
  );
}
