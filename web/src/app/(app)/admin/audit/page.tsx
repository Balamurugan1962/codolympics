"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { api } from "@/lib/client";

type E = { id: number; actor: string | null; action: string; target: string | null; reason: string; detail: unknown; created_at: string };

export default function AuditPage() {
  const [rows, setRows] = useState<E[]>([]);
  useEffect(() => { void api.get<{ entries: E[] }>("/api/admin/audit").then((r) => setRows(r.entries)); }, []);
  return (
    <Card>
      <CardHeader title="Audit log" action={<a href="/api/admin/export"><Button size="sm" variant="secondary">Export everything (JSON)</Button></a>} />
      <Table>
        <thead><tr><Th>Time</Th><Th>Actor</Th><Th>Action</Th><Th>Target</Th><Th>Reason</Th><Th>Detail</Th></tr></thead>
        <tbody>{rows.map((e) => (
          <tr key={e.id}><Td className="text-faint">{new Date(e.created_at).toLocaleTimeString()}</Td><Td>{e.actor ?? "system"}</Td><Td className="font-mono text-xs">{e.action}</Td><Td className="font-mono text-xs">{e.target}</Td><Td>{e.reason}</Td><Td className="max-w-xs truncate font-mono text-xs text-faint" title={JSON.stringify(e.detail)}>{e.detail ? JSON.stringify(e.detail) : ""}</Td></tr>
        ))}</tbody>
      </Table>
    </Card>
  );
}
