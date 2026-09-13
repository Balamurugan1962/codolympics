"use client";

/** The problem set. One row per problem, its stage at a glance; creating one is its own page. */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ProblemTransferActions, problemExportMenuItem } from "@/components/admin/problem-transfer";
import { ValidateAllButton } from "@/components/admin/validate-all";
import { DifficultyBadge } from "@/components/admin/question-details-form";
import { Icon } from "@/components/icons";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Menu } from "@/components/ui/menu";
import { SearchInput } from "@/components/ui/field";
import { PageBody, PageHeader, Section, Toolbar } from "@/components/ui/page";
import { SimpleSelect } from "@/components/ui/select";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Stat, StatRow } from "@/components/ui/stat";
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
};
export type Q = {
  id: string;
  title: string;
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
  if (!(p.validated || q?.validated)) return "unvalidated";
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
  { value: "all", label: "All problems" },
  { value: "auction", label: "Auction problems" },
  { value: "hacking", label: "Hacking problems" },
  { value: "attention", label: "Needs attention" },
] as const;

export default function ProblemsPage() {
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
        description="Every judge package and what participants see of it. A problem is auctionable once it is validated, described and published."
        actions={
          <>
            <ValidateAllButton onDone={load} />
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
        <CardSkeleton lines={8} />
      ) : all.length === 0 ? (
        <Section padded={false}>
          <EmptyState
            icon={<Icon.Package />}
            title="No problems yet"
            body="Create one from a judge package — problem.json and tests/, plus a checker, validator or reference solution if the problem needs them."
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
          <StatRow cols={4}>
            <Stat label="Problems" value={all.length} icon={<Icon.Code size={13} />} hint={`${hacking} for hacking`} />
            <Stat label="Ready" value={ready} tone="success" icon={<Icon.Check size={13} />} hint="validated and published" />
            <Stat
              label="Need attention"
              value={attention}
              tone={attention ? "warning" : "default"}
              icon={<Icon.Alert size={13} />}
              hint={attention ? "unvalidated, undescribed or unpublished" : "nothing outstanding"}
            />
            <Stat
              label="Auction lots"
              value={questions.filter((q) => q.status !== "void").length}
              icon={<Icon.Gavel size={13} />}
              hint="with details, in auction order"
            />
          </StatRow>

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
              <SimpleSelect className="w-44" value={kind} onValueChange={setKind} options={KINDS} aria-label="Show" />
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
                  <TableHead className="w-28">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ id, p, q, stage }) => (
                  <TableRow key={id}>
                    <TableCell className="hidden text-right text-faint tabular-nums lg:table-cell">{q ? q.auctionOrder : "—"}</TableCell>
                    <TableCell>
                      <Link href={`/admin/problems/${encodeURIComponent(id)}`} className="group block">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold group-hover:text-brand-dark">
                            {q?.title ?? (p?.hack_only ? <span className="font-mono">{id}</span> : <span className="font-normal text-faint">Untitled</span>)}
                          </span>
                          {p?.hack_only && <Badge variant="info">Hacking</Badge>}
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
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5">
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/admin/problems/${encodeURIComponent(id)}`}>
                            Open <Icon.ChevronRight size={14} />
                          </Link>
                        </Button>
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
