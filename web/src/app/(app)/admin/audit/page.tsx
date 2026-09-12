"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Table, Td, Th } from "@/components/ui/table";
import { api } from "@/lib/client";

type E = { id: number; actor: string | null; action: string; target: string | null; reason: string; detail: unknown; created_at: string };

export default function AuditPage() {
  const [rows, setRows] = useState<E[] | null>(null);
  const [filter, setFilter] = useState("");
  useEffect(() => { void api.get<{ entries: E[] }>("/api/admin/audit").then((r) => setRows(r.entries)); }, []);
  const shown = (rows ?? []).filter((e) => !filter || e.action.includes(filter) || (e.actor ?? "").toLowerCase().includes(filter.toLowerCase()) || (e.target ?? "").includes(filter));
  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Audit log" description="Every override, grade and change, with who, when and why. This is what disputes are settled from."
        actions={<><Input className="w-56" placeholder="Filter by action, actor, target" value={filter} onChange={(e) => setFilter(e.target.value)} /><a href="/api/admin/export"><Button variant="secondary" icon={<Icon.Upload className="rotate-180" />}>Export everything</Button></a></>} />
      {!rows ? <CardSkeleton lines={8} /> : shown.length === 0 ? <EmptyState icon={<Icon.List size={22} />} title="Nothing logged yet" /> : (
        <Card>
          <Table>
            <thead><tr><Th>Time</Th><Th>Actor</Th><Th>Action</Th><Th className="hidden md:table-cell">Target</Th><Th>Reason</Th><Th className="hidden lg:table-cell">Detail</Th></tr></thead>
            <tbody>{shown.map((e) => (
              <tr key={e.id}><Td className="whitespace-nowrap text-faint">{new Date(e.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</Td><Td>{e.actor ?? <span className="text-faint">system</span>}</Td><Td className="font-mono text-xs">{e.action}</Td><Td className="hidden font-mono text-xs md:table-cell">{e.target}</Td><Td>{e.reason}</Td><Td className="hidden max-w-xs truncate font-mono text-xs text-faint lg:table-cell" title={JSON.stringify(e.detail)}>{e.detail ? JSON.stringify(e.detail) : ""}</Td></tr>
            ))}</tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
