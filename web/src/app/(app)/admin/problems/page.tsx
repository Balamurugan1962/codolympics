"use client";

/** The problem set. One row per problem, its stage at a glance; creating one is its own page. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ProblemTransferActions, problemExportMenuItem } from "@/components/admin/problem-transfer";
import { PublishAllButton } from "@/components/admin/publish-all";
import { ValidateAllButton } from "@/components/admin/validate-all";
import { DifficultyBadge } from "@/components/admin/question-details-form";
import { Icon } from "@/components/icons";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Menu } from "@/components/ui/menu";
import { SearchInput } from "@/components/ui/field";
import { PageBody, PageHeader, Section, Toolbar } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Figures, FilterChips } from "@/components/ui/record";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/client";

export type P = {
  problem_id: string;
  testcases: number;
  bytes: number;
  version: string;
  validated: boolean;
  compare: string;
  time_limit_ms: number;
  memory_limit_mb: number;
  has_reference: boolean;
  hack_only: boolean;
  modified_at: string | null;
  versions: string[];
  current: string | null;
  /** What the last validation of the live (or newest) version found, here or elsewhere. */
  last_validation: ValidationRecord | null;
};
export type ValidationRecord = {
  at: string;
  verdict: string | null;
  passed: number | null;
  testcases: number;
  max_time_ms: number | null;
  time_limit_ms: number | null;
  ok: boolean;
  /** Set when the record arrived with an imported package instead of being run here. */
  imported?: string | null;
};
export type Q = {
  id: string;
  title: string;
  /** What bidders are told instead of the title. */
  topic: string;
  difficulty: string;
  score: number;
  basePrice: number;
  statementMd: string;
  sampleCount: number;
  auctionOrder: number;
  status: string;
  validated: boolean;
  hints: { idx: number; price: number; bodyMd: string }[];
};

type Stage = "no-package" | "unvalidated" | "no-details" | "unpublished" | "ready" | "void";

export function stageOf(p: P | null, q: Q | null): Stage {
  if (!p) return "no-package";
  if (q?.status === "void") return "void";
  // A passing record on the package counts, including one that came in with an
  // import: a hacking package has no question row to carry a flag, and asking
  // for a validation the zip already has is the work an import removes.
  // A hacking package has no testcases, so there is no reference to validate
  // and no state it could reach by validating. What proves it is the hacking
  // question's breaking input, which lives under Phase 1.
  if (!p.hack_only && !(p.validated || q?.validated || p.last_validation?.ok)) return "unvalidated";
  if (!p.hack_only && !q) return "no-details";
  if (!p.current) return "unpublished";
  return "ready";
}

const STAGE: Record<Stage, { label: string; tone: "success" | "destructive" | "warning" | "info" | "neutral" }> = {
  "no-package": { label: "No package", tone: "destructive" },
  unvalidated: { label: "Not validated", tone: "warning" },
  "no-details": { label: "No details", tone: "warning" },
  unpublished: { label: "Not published", tone: "warning" },
  ready: { label: "Ready", tone: "success" },
  void: { label: "Void", tone: "neutral" },
};

const KINDS = [
  { value: "all", label: "All" },
  { value: "auction", label: "Auction" },
  { value: "hacking", label: "Hacking" },
  { value: "attention", label: "Needs attention" },
] as const;

export default function ProblemsPage() {
  const router = useRouter();
  const [problems, setProblems] = useState<P[] | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [filter, setFilter] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]["value"]>("all");

  const load = useCallback(async () => {
    const [p, q] = await Promise.all([api.get<{ problems: P[] }>("/api/admin/problems"), api.get<{ questions: Q[] }>("/api/admin/questions")]);
    setProblems(p.problems);
    setQuestions(q.questions);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const ids = [...new Set([...(problems ?? []).map((p) => p.problem_id), ...questions.map((q) => q.id)])];
  const all = ids
    .map((id) => {
      const p = problems?.find((x) => x.problem_id === id) ?? null;
      const q = questions.find((x) => x.id === id) ?? null;
      return { id, p, q, stage: stageOf(p, q) };
    })
    .sort((a, b) => (a.q?.auctionOrder ?? 1e9) - (b.q?.auctionOrder ?? 1e9) || a.id.localeCompare(b.id));

  const rows = all
    .filter(
      (r) =>
        kind === "all" ||
        (kind === "auction" && !r.p?.hack_only) ||
        (kind === "hacking" && r.p?.hack_only) ||
        (kind === "attention" && !["ready", "void"].includes(r.stage)),
    )
    .filter((r) => !filter || r.id.toLowerCase().includes(filter.toLowerCase()) || (r.q?.title ?? "").toLowerCase().includes(filter.toLowerCase()));

  const ready = all.filter((r) => r.stage === "ready").length;
  const attention = all.filter((r) => !["ready", "void"].includes(r.stage)).length;
  const hacking = all.filter((r) => r.p?.hack_only).length;

  return (
    <PageBody width="wide">
      <PageHeader
        title="Problems"
        actions={
          <>
            <ValidateAllButton onDone={load} />
            <PublishAllButton url="/api/admin/problems/publish-all" what="problem" onDone={load} />
            <Button variant="outline" asChild>
              <Link href="/admin/problems/order">
                <Icon.Sort size={14} /> Order
              </Link>
            </Button>
            <ProblemTransferActions onImported={load} />
            <Button asChild>
              <Link href="/admin/problems/new">
                <Icon.Plus size={14} /> New problem
              </Link>
            </Button>
          </>
        }
      />

      {!problems ? (
        <PageSkeleton stats={4} rows={7} cols={6} />
      ) : all.length === 0 ? (
        <Section padded={false}>
          <EmptyState
            icon={<Icon.Package />}
            title="No problems yet"
            body="A package is problem.json plus tests/."
            action={
              <Button size="sm" asChild>
                <Link href="/admin/problems/new">
                  <Icon.Plus size={14} /> Create the first problem
                </Link>
              </Button>
            }
          />
        </Section>
      ) : (
        <div className="space-y-5">
          <Figures items={[
            { label: "Problems", value: all.length, note: `${hacking} for hacking` },
            { label: "Ready", value: ready, note: "validated, described and live", tone: "success" },
            { label: "Need attention", value: attention, note: attention ? "unvalidated, undescribed or unpublished" : "none", tone: attention ? "warning" : "default" },
            { label: "Auction lots", value: questions.filter((q) => q.status !== "void").length, note: "described for bidders" },
          ]} />

          <Section padded={false}>
            <Toolbar
              actions={
                <span className="text-[12px] text-muted-foreground">
                  {rows.length} of {all.length}
                </span>
              }
            >
              <SearchInput
                className="w-full sm:w-64"
                placeholder="Filter by id or title"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                onClear={() => setFilter("")}
              />
              <FilterChips label="Show" value={kind} onChange={setKind}
                options={KINDS.map((k) => ({ value: k.value, label: k.label, count:
                  k.value === "all" ? all.length
                  : k.value === "auction" ? all.filter((r) => !r.p?.hack_only).length
                  : k.value === "hacking" ? hacking
                  : attention }))} />
            </Toolbar>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden w-14 text-right lg:table-cell">#</TableHead>
                  <TableHead>Problem</TableHead>
                  <TableHead className="hidden md:table-cell">Tier</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Score</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Base</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Tests</TableHead>
                  <TableHead className="hidden md:table-cell">Live</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ id, p, q, stage }) => (
                  <TableRow key={id} className="cursor-pointer" onClick={() => router.push(`/admin/problems/${encodeURIComponent(id)}`)}>
                    <TableCell className="hidden text-right text-faint tabular-nums lg:table-cell">{q ? q.auctionOrder : "–"}</TableCell>
                    <TableCell>
                      <Link href={`/admin/problems/${encodeURIComponent(id)}`} className="group block" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold group-hover:text-brand-deep">
                            {q?.title ?? (p?.hack_only ? <span className="font-mono">{id}</span> : <span className="font-normal text-faint">Untitled</span>)}
                          </span>
                          {p?.hack_only && <Badge variant="neutral">Hacking</Badge>}
                          {q?.status === "sold" && <Badge variant="neutral">Sold</Badge>}
                        </div>
                        <div className="font-mono text-[11.5px] text-faint">{id}</div>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{q ? <DifficultyBadge d={q.difficulty} /> : <span className="text-faint">—</span>}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{q ? q.score : <span className="text-faint">—</span>}</TableCell>
                    <TableCell className="hidden text-right tabular-nums lg:table-cell">{q ? q.basePrice : <span className="text-faint">—</span>}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{p ? p.testcases : <span className="text-faint">—</span>}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {p?.current ? <span className="font-mono text-[12px]">{p.current}</span> : <span className="text-faint">—</span>}
                    </TableCell>
                    <TableCell>
                      <StatusDot tone={STAGE[stage].tone}>{STAGE[stage].label}</StatusDot>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end">
                        <Menu label={`Actions for ${id}`} items={[problemExportMenuItem(id)]} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {rows.length === 0 && <EmptyState compact icon={<Icon.Search />} title="Nothing matches" body="Try another filter." />}
          </Section>
        </div>
      )}
    </PageBody>
  );
}
