"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, Td, Th } from "@/components/ui/table";
import { api } from "@/lib/client";

type A = { id: number; name: string; title: string; state: string; validInput: boolean | null; invalidReason: string | null; hacked: boolean | null; verdict: string | null; pointsAwarded: number; created_at: string; input: string };

/** Every hack attempt with its verdict -- the detail participants never see. */
export default function HacksPage() {
  const [rows, setRows] = useState<A[]>([]);
  useEffect(() => { void api.get<{ attempts: A[] }>("/api/grade/hacks").then((r) => setRows(r.attempts)); }, []);
  return (
    <Card>
      <CardHeader title="Hack attempts" />
      <Table>
        <thead><tr><Th>Time</Th><Th>Participant</Th><Th>Solution</Th><Th>Outcome</Th><Th>Verdict</Th><Th>Points</Th><Th>Input</Th></tr></thead>
        <tbody>{rows.map((a) => (
          <tr key={a.id}>
            <Td className="text-faint">{new Date(a.created_at).toLocaleTimeString()}</Td><Td>{a.name}</Td><Td>{a.title}</Td>
            <Td>{a.state !== "done" ? <Badge>judging</Badge> : a.validInput === false ? <Badge tone="amber">invalid: {a.invalidReason}</Badge> : a.hacked ? <Badge tone="green">hacked</Badge> : a.hacked === false ? <Badge tone="red">not broken</Badge> : <Badge tone="grey">IE</Badge>}</Td>
            <Td className="font-mono text-xs">{a.verdict ?? "—"}</Td><Td className="tabular-nums">{a.pointsAwarded}</Td>
            <Td><pre className="max-h-16 max-w-xs overflow-auto text-xs">{a.input}</pre></Td>
          </tr>
        ))}</tbody>
      </Table>
    </Card>
  );
}
