"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Table, Td, Th } from "@/components/ui/table";
import { api } from "@/lib/client";

type A = { id: number; name: string; title: string; state: string; validInput: boolean | null; invalidReason: string | null; hacked: boolean | null; verdict: string | null; pointsAwarded: number; created_at: string; input: string };

export default function HacksPage() {
  const [rows, setRows] = useState<A[] | null>(null);
  useEffect(() => { void api.get<{ attempts: A[] }>("/api/grade/hacks").then((r) => setRows(r.attempts)); }, []);
  return (
    <div className="animate-fade-in">
      <PageHeader title="Hack attempts" description="Every attempt with its verdict — the detail participants are never shown." />
      {!rows ? <CardSkeleton lines={8} /> : rows.length === 0 ? <EmptyState icon={<Icon.Bug size={22} />} title="No hack attempts yet" /> : (
        <Card>
          <Table>
            <thead><tr><Th>Time</Th><Th>Participant</Th><Th>Solution</Th><Th>Outcome</Th><Th>Verdict</Th><Th className="text-right">Points</Th><Th>Input</Th></tr></thead>
            <tbody>{rows.map((a) => (
              <tr key={a.id}>
                <Td className="whitespace-nowrap text-faint">{new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Td><Td>{a.name}</Td><Td>{a.title}</Td>
                <Td>{a.state !== "done" ? <Badge tone="blue">judging</Badge> : a.validInput === false ? <Badge tone="amber">invalid</Badge> : a.hacked ? <Badge tone="green">hacked</Badge> : a.hacked === false ? <Badge tone="red">not broken</Badge> : <Badge tone="grey">IE</Badge>}{a.invalidReason && <div className="text-xs text-faint">{a.invalidReason}</div>}</Td>
                <Td className="font-mono text-xs">{a.verdict ?? "—"}</Td><Td className="text-right tabular-nums">{a.pointsAwarded}</Td>
                <Td><pre className="max-h-16 max-w-xs overflow-auto text-xs">{a.input}</pre></Td>
              </tr>
            ))}</tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
