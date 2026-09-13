"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/field";
import { SimpleSelect } from "@/components/ui/select";
import { PageBody, PageHeader, Section, Toolbar } from "@/components/ui/page";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
          <Toolbar actions={<span className="text-[12px] text-muted-foreground">{shown.length} of {rows.length}</span>}>
            <SearchInput className="w-64" placeholder="Filter by participant or solution" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <SimpleSelect className="w-40" value={outcome} onValueChange={setOutcome} aria-label="Outcome"
              options={[{ value: "all", label: "All outcomes" }, { value: "hacked", label: "Hacked" }, { value: "missed", label: "Did not break" }, { value: "invalid", label: "Invalid input" }, { value: "judging", label: "Judging" }] as const} />
          </Toolbar>
          <Table>
            <TableHeader><TableRow><TableHead className="w-20">Time</TableHead><TableHead>Participant</TableHead><TableHead>Solution</TableHead><TableHead>Outcome</TableHead><TableHead className="hidden sm:table-cell">Verdict</TableHead><TableHead className="text-right tabular-nums">Points</TableHead><TableHead className="hidden md:table-cell">Input</TableHead></TableRow></TableHeader>
            <TableBody>{shown.map((a) => {
              const o = outcomeOf(a);
              return (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap text-faint">{new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</TableCell>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>{a.title}</TableCell>
                  <TableCell>
                    {o === "judging" ? <Badge variant="info">judging</Badge> : o === "invalid" ? <Badge variant="warning">invalid</Badge> : o === "hacked" ? <Badge variant="success">hacked</Badge> : o === "missed" ? <Badge variant="destructive">not broken</Badge> : <Badge variant="neutral">IE</Badge>}
                    {a.invalidReason && <div className="mt-0.5 text-[11.5px] text-faint">{a.invalidReason}</div>}
                  </TableCell>
                  <TableCell className="hidden font-mono text-[12px] sm:table-cell">{a.verdict ?? "—"}</TableCell>
                  <TableCell className={`text-right tabular-nums ${a.pointsAwarded > 0 ? "font-semibold text-green-dark" : a.pointsAwarded < 0 ? "text-red" : ""}`}>{a.pointsAwarded}</TableCell>
                  <TableCell className="hidden md:table-cell"><pre className="max-h-16 max-w-xs overflow-auto rounded-box bg-page px-2 py-1 text-[11.5px]">{a.input}</pre></TableCell>
                </TableRow>
              );
            })}</TableBody>
          </Table>
          {shown.length === 0 && <EmptyState compact title="Nothing matches" body="Try another filter." />}
        </Section>
      )}
    </PageBody>
  );
}
