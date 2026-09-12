"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput, Select } from "@/components/ui/input";
import { PageBody, PageHeader, Section, Toolbar } from "@/components/ui/page";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { api } from "@/lib/client";

type A = { id: number; name: string; title: string; state: string; validInput: boolean | null; invalidReason: string | null; hacked: boolean | null; verdict: string | null; pointsAwarded: number; created_at: string; input: string };
type Outcome = "all" | "hacked" | "missed" | "invalid" | "judging";

function outcomeOf(a: A): Exclude<Outcome, "all"> | "error" {
  if (a.state !== "done") return "judging";
  if (a.validInput === false) return "invalid";
  if (a.hacked) return "hacked";
  if (a.hacked === false) return "missed";
  return "error";
}

export default function HacksPage() {
  const [rows, setRows] = useState<A[] | null>(null);
  const [filter, setFilter] = useState("");
  const [outcome, setOutcome] = useState<Outcome>("all");
  useEffect(() => { void api.get<{ attempts: A[] }>("/api/grade/hacks").then((r) => setRows(r.attempts)); }, []);
  const shown = (rows ?? []).filter((a) => outcome === "all" || outcomeOf(a) === outcome).filter((a) => !filter || a.name.toLowerCase().includes(filter.toLowerCase()) || a.title.toLowerCase().includes(filter.toLowerCase()));
  return (
    <PageBody width="wide" className="animate-fade-in">
      <PageHeader title="Hack attempts" description="Every attempt with its verdict — the detail participants are never shown." />
      {!rows ? <CardSkeleton lines={8} /> : rows.length === 0 ? <EmptyState icon={<Icon.Bug size={20} />} title="No hack attempts yet" body="Attempts appear here as soon as Section B opens." /> : (
        <Section padded={false}>
          <Toolbar actions={<span className="text-[12px] text-muted">{shown.length} of {rows.length}</span>}>
            <SearchInput className="w-64" placeholder="Filter by participant or solution" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <div className="w-40">
              <Select value={outcome} onChange={(e) => setOutcome(e.target.value as Outcome)} aria-label="Outcome">
                <option value="all">All outcomes</option><option value="hacked">Hacked</option><option value="missed">Did not break</option><option value="invalid">Invalid input</option><option value="judging">Judging</option>
              </Select>
            </div>
          </Toolbar>
          <Table>
            <thead><tr><Th className="w-20">Time</Th><Th>Participant</Th><Th>Solution</Th><Th>Outcome</Th><Th className="hidden sm:table-cell">Verdict</Th><Th align="right">Points</Th><Th className="hidden md:table-cell">Input</Th></tr></thead>
            <tbody>{shown.map((a) => {
              const o = outcomeOf(a);
              return (
                <Tr key={a.id}>
                  <Td className="whitespace-nowrap text-faint">{new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Td>
                  <Td className="font-medium">{a.name}</Td>
                  <Td>{a.title}</Td>
                  <Td>
                    {o === "judging" ? <Badge tone="blue">judging</Badge> : o === "invalid" ? <Badge tone="amber">invalid</Badge> : o === "hacked" ? <Badge tone="green">hacked</Badge> : o === "missed" ? <Badge tone="red">not broken</Badge> : <Badge tone="grey">IE</Badge>}
                    {a.invalidReason && <div className="mt-0.5 text-[11.5px] text-faint">{a.invalidReason}</div>}
                  </Td>
                  <Td className="hidden font-mono text-[12px] sm:table-cell">{a.verdict ?? "—"}</Td>
                  <Td align="right" className={a.pointsAwarded > 0 ? "font-semibold text-green-dark" : a.pointsAwarded < 0 ? "text-red" : ""}>{a.pointsAwarded}</Td>
                  <Td className="hidden md:table-cell"><pre className="max-h-16 max-w-xs overflow-auto rounded-box bg-page px-2 py-1 text-[11.5px]">{a.input}</pre></Td>
                </Tr>
              );
            })}</tbody>
          </Table>
          {shown.length === 0 && <EmptyState compact title="Nothing matches" body="Try another filter." />}
        </Section>
      )}
    </PageBody>
  );
}
