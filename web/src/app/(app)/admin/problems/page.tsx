"use client";

/** The problem set. One row per problem, its stage at a glance; creating one is its own page. */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { DifficultyBadge } from "@/components/admin/question-details-form";
import { Icon } from "@/components/icons";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput, Select } from "@/components/ui/input";
import { PageBody, PageHeader, Section, Toolbar } from "@/components/ui/page";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Stat, StatRow } from "@/components/ui/stat";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { api } from "@/lib/client";

export type P = { problem_id: string; testcases: number; bytes: number; version: string; validated: boolean; compare: string; time_limit_ms: number; memory_limit_mb: number; has_reference: boolean; hack_only: boolean; modified_at: string | null; versions: string[]; current: string | null };
export type Q = { id: string; title: string; difficulty: string; score: number; basePrice: number; statementMd: string; sampleCount: number; auctionOrder: number; status: string; validated: boolean; hints: { idx: number; price: number; bodyMd: string }[] };

type Stage = "no-package" | "unvalidated" | "no-details" | "unpublished" | "ready" | "void";

export function stageOf(p: P | null, q: Q | null): Stage {
  if (!p) return "no-package";
  if (q?.status === "void") return "void";
  if (!(p.validated || q?.validated)) return "unvalidated";
  if (!p.hack_only && !q) return "no-details";
  if (!p.current) return "unpublished";
  return "ready";
}

const STAGE: Record<Stage, { label: string; tone: "green" | "red" | "amber" | "blue" | "grey" }> = {
  "no-package": { label: "No package", tone: "red" },
  unvalidated: { label: "Not validated", tone: "amber" },
  "no-details": { label: "No details", tone: "amber" },
  unpublished: { label: "Not published", tone: "amber" },
  ready: { label: "Ready", tone: "green" },
  void: { label: "Void", tone: "grey" },
};

export default function ProblemsPage() {
  const [problems, setProblems] = useState<P[] | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [filter, setFilter] = useState("");
  const [kind, setKind] = useState<"all" | "auction" | "hacking" | "attention">("all");

  const load = useCallback(async () => {
    const [p, q] = await Promise.all([api.get<{ problems: P[] }>("/api/admin/problems"), api.get<{ questions: Q[] }>("/api/admin/questions")]);
    setProblems(p.problems); setQuestions(q.questions);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const ids = [...new Set([...(problems ?? []).map((p) => p.problem_id), ...questions.map((q) => q.id)])];
  const all = ids.map((id) => {
    const p = problems?.find((x) => x.problem_id === id) ?? null;
    const q = questions.find((x) => x.id === id) ?? null;
    return { id, p, q, stage: stageOf(p, q) };
  }).sort((a, b) => (a.q?.auctionOrder ?? 1e9) - (b.q?.auctionOrder ?? 1e9) || a.id.localeCompare(b.id));
  const rows = all
    .filter((r) => kind === "all" || (kind === "auction" && !r.p?.hack_only) || (kind === "hacking" && r.p?.hack_only) || (kind === "attention" && !["ready", "void"].includes(r.stage)))
    .filter((r) => !filter || r.id.toLowerCase().includes(filter.toLowerCase()) || (r.q?.title ?? "").toLowerCase().includes(filter.toLowerCase()));
  const ready = all.filter((r) => r.stage === "ready").length;
  const attention = all.filter((r) => !["ready", "void"].includes(r.stage)).length;
  const hacking = all.filter((r) => r.p?.hack_only).length;

  return (
    <PageBody width="wide">
      <PageHeader
        title="Problems"
        description="Every judge package and what participants see of it. A problem is auctionable once it is validated, described and published."
        actions={<Link href="/admin/problems/new"><Button icon={<Icon.Plus size={14} />}>New problem</Button></Link>}
      />

      {!problems ? <CardSkeleton lines={8} /> : all.length === 0 ? (
        <Section padded={false}>
          <EmptyState icon={<Icon.Upload size={20} />} title="No problems yet"
            body="Create one from a judge package — problem.json and tests/, plus a checker, validator or reference solution if the problem needs them."
            action={<Link href="/admin/problems/new"><Button size="sm" icon={<Icon.Plus size={14} />}>Create the first problem</Button></Link>} />
        </Section>
      ) : (
        <div className="space-y-4">
          <StatRow cols={4}>
            <Stat label="Problems" value={all.length} icon={<Icon.Code size={13} />} hint={`${hacking} for hacking`} />
            <Stat label="Ready" value={ready} tone="green" icon={<Icon.Check size={13} />} hint="validated and published" />
            <Stat label="Need attention" value={attention} tone={attention ? "amber" : "ink"} icon={<Icon.Alert size={13} />} hint={attention ? "unvalidated, undescribed or unpublished" : "nothing outstanding"} />
            <Stat label="Auction lots" value={questions.filter((q) => q.status !== "void").length} icon={<Icon.Gavel size={13} />} hint="with details, in auction order" />
          </StatRow>

          <Section padded={false}>
            <Toolbar actions={<span className="text-[12px] text-muted">{rows.length} of {all.length}</span>}>
              <SearchInput className="w-64" placeholder="Filter by id or title" value={filter} onChange={(e) => setFilter(e.target.value)} />
              <div className="w-44">
                <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Show">
                  <option value="all">All problems</option>
                  <option value="auction">Auction problems</option>
                  <option value="hacking">Hacking problems</option>
                  <option value="attention">Needs attention</option>
                </Select>
              </div>
            </Toolbar>
            <Table>
              <thead>
                <tr>
                  <Th className="w-14 hidden lg:table-cell" align="right">#</Th>
                  <Th>Problem</Th>
                  <Th className="hidden md:table-cell">Tier</Th>
                  <Th className="hidden sm:table-cell" align="right">Score</Th>
                  <Th className="hidden lg:table-cell" align="right">Base</Th>
                  <Th className="hidden sm:table-cell" align="right">Tests</Th>
                  <Th className="hidden md:table-cell">Live</Th>
                  <Th>Stage</Th>
                  <Th className="w-16"><span className="sr-only">Open</span></Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ id, p, q, stage }) => (
                  <Tr key={id}>
                    <Td className="hidden text-faint lg:table-cell" align="right">{q ? q.auctionOrder : "—"}</Td>
                    <Td>
                      <Link href={`/admin/problems/${encodeURIComponent(id)}`} className="group block">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold group-hover:text-green-dark">{q?.title ?? (p?.hack_only ? <span className="font-mono">{id}</span> : <span className="font-normal text-faint">Untitled</span>)}</span>
                          {p?.hack_only && <Badge tone="blue">Hacking</Badge>}
                          {q?.status === "sold" && <Badge tone="grey">Sold</Badge>}
                        </div>
                        <div className="font-mono text-[11.5px] text-faint">{id}</div>
                      </Link>
                    </Td>
                    <Td className="hidden md:table-cell">{q ? <DifficultyBadge d={q.difficulty} /> : <span className="text-faint">—</span>}</Td>
                    <Td className="hidden sm:table-cell" align="right">{q ? q.score : <span className="text-faint">—</span>}</Td>
                    <Td className="hidden lg:table-cell" align="right">{q ? q.basePrice : <span className="text-faint">—</span>}</Td>
                    <Td className="hidden sm:table-cell" align="right">{p ? p.testcases : <span className="text-faint">—</span>}</Td>
                    <Td className="hidden md:table-cell">{p?.current ? <span className="font-mono text-[12px]">{p.current}</span> : <span className="text-faint">—</span>}</Td>
                    <Td><StatusDot tone={STAGE[stage].tone}>{STAGE[stage].label}</StatusDot></Td>
                    <Td><Link href={`/admin/problems/${encodeURIComponent(id)}`}><Button size="sm" variant="ghost">Open <Icon.ChevronRight size={14} /></Button></Link></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            {rows.length === 0 && <EmptyState compact title="Nothing matches" body="Try another filter." />}
          </Section>
        </div>
      )}
    </PageBody>
  );
}
