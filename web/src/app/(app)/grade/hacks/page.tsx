"use client";

/**
 * Every hack attempt, for the evaluators. Verdicts here are never shown to
 * participants. The list says who tried what and how it went; the attempt
 * itself is read on the participant's timeline for that question, alongside
 * their other attempts on it: the same page the Judge monitor opens.
 */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { Badge, verdictLabel } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/field";
import { PageBody, PageHeader, Section, Toolbar } from "@/components/ui/page";
import { Figures, FilterChips } from "@/components/ui/record";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/client";
import { fromHere } from "@/lib/came-from";
import { cn } from "@/lib/utils";

type Attempt = {
  id: number; name: string; title: string; state: string; validInput: boolean | null; invalidReason: string | null;
  hacked: boolean | null; verdict: string | null; pointsAwarded: number; created_at: string;
  participantId: string; questionId: number;
};
type Outcome = "hacked" | "missed" | "invalid" | "judging" | "error";

function outcomeOf(a: Attempt): Outcome {
  if (a.state !== "done") return "judging";
  if (a.validInput === false) return "invalid";
  if (a.hacked) return "hacked";
  if (a.hacked === false) return "missed";
  return "error";
}

const OUTCOME: Record<Outcome, { label: string; variant: "success" | "destructive" | "warning" | "info" | "neutral" }> = {
  hacked: { label: "Hacked", variant: "success" },
  missed: { label: "Did not break it", variant: "destructive" },
  invalid: { label: "Invalid input", variant: "warning" },
  judging: { label: "Judging", variant: "info" },
  error: { label: "Judge error", variant: "neutral" },
};

const FILTERS = ["all", "hacked", "missed", "invalid", "judging"] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_LABEL: Record<Filter, string> = { all: "All", hacked: "Hacked", missed: "Did not break it", invalid: "Invalid", judging: "Judging" };

export default function HacksPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Attempt[] | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  useEffect(() => { void api.get<{ attempts: Attempt[] }>("/api/grade/hacks").then((r) => setRows(r.attempts)); }, []);

  const all = (rows ?? []).map((a) => ({ a, outcome: outcomeOf(a) }));
  const count = (o: Outcome) => all.filter((r) => r.outcome === o).length;
  const q = search.trim().toLowerCase();
  const shown = all
    .filter((r) => filter === "all" || r.outcome === filter)
    .filter((r) => !q || r.a.name.toLowerCase().includes(q) || r.a.title.toLowerCase().includes(q));
  const points = all.reduce((s, r) => s + r.a.pointsAwarded, 0);

  return (
    <PageBody width="wide">
      <PageHeader title="Hack attempts" description="Verdicts here are never shown to participants." />
      {!rows ? (
        <PageSkeleton stats={4} rows={8} cols={5} />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Icon.Bug size={20} />} title="No hack attempts yet" body="Attempts appear here as soon as Section B opens." />
      ) : (
        <>
          <Figures
            className="mb-5"
            items={[
              { label: "Attempts", value: rows.length },
              { label: "Hacked", value: count("hacked"), tone: count("hacked") > 0 ? "success" : "default" },
              { label: "Did not break it", value: count("missed") },
              { label: "Invalid input", value: count("invalid"), tone: count("invalid") > 0 ? "warning" : "default" },
              { label: "Points awarded", value: points },
            ]}
          />
          <Section padded={false}>
            <Toolbar actions={<span className="text-[12px] text-muted-foreground tabular-nums">{shown.length} of {rows.length}</span>}>
              <SearchInput className="w-64" placeholder="Participant or question" value={search} onChange={(e) => setSearch(e.target.value)} />
              <FilterChips
                label="Outcome"
                value={filter}
                onChange={setFilter}
                options={FILTERS.map((f) => ({ value: f, label: FILTER_LABEL[f], count: f === "all" ? rows.length : count(f) }))}
              />
            </Toolbar>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Time</TableHead>
                  <TableHead>Participant</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead className="hidden sm:table-cell">Judge said</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map(({ a, outcome }) => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => router.push(fromHere(`/admin/participants/${a.participantId}/hacks/${a.questionId}`, "/grade/hacks"))}>
                    <TableCell className="whitespace-nowrap text-faint tabular-nums">
                      {new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>{a.title}</TableCell>
                    <TableCell>
                      <Badge variant={OUTCOME[outcome].variant}>{OUTCOME[outcome].label}</Badge>
                      {a.invalidReason && <div className="mt-1 text-[11.5px] text-faint">{a.invalidReason}</div>}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">{a.verdict ? verdictLabel(a.verdict) : "Not judged"}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", a.pointsAwarded > 0 ? "font-semibold text-green-dark" : a.pointsAwarded < 0 ? "text-red" : "text-faint")}>
                      {a.pointsAwarded}
                    </TableCell>
                    <TableCell className="pr-3 text-faint"><Icon.ChevronRight size={14} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {shown.length === 0 && <EmptyState compact title="Nothing matches" body="Try another filter." />}
          </Section>
        </>
      )}
    </PageBody>
  );
}
