"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { KIND_LABEL, stateOf, type Puzzle } from "@/components/admin/phase1-types";
import { PuzzleBuilder } from "@/components/admin/puzzle-builder";
import { Icon } from "@/components/icons";
import { StatusDot } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageBody, PageHeader, Section } from "@/components/ui/page";
import { CardSkeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client";

export default function EditPuzzlePage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const [puzzle, setPuzzle] = useState<Puzzle | null | undefined>(undefined);
  const load = useCallback(async () => {
    const r = await api.get<{ questions: Puzzle[] }>("/api/admin/phase1/puzzles");
    setPuzzle(r.questions.find((q) => q.id === Number(id)) ?? null);
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const crumb = <Link href="/admin/phase1" className="inline-flex items-center gap-1 hover:text-ink"><Icon.ChevronLeft size={14} /> Phase 1 · Section A</Link>;
  if (puzzle === undefined) return <PageBody width="wide"><PageHeader breadcrumb={crumb} title="Puzzle" /><CardSkeleton lines={10} /></PageBody>;
  if (puzzle === null) return <PageBody width="wide"><PageHeader breadcrumb={crumb} title="Puzzle not found" /><Section padded={false}><EmptyState icon={<Icon.Puzzle size={20} />} title="No puzzle with that id" body="It may have been deleted." /></Section></PageBody>;
  const s = stateOf(puzzle);
  return (
    <PageBody width="wide">
      <PageHeader
        breadcrumb={crumb}
        title={puzzle.title}
        description={`Puzzle #${puzzle.id} · ${KIND_LABEL[puzzle.kind]} · ${puzzle.points} pts${puzzle.explainPoints ? ` + ${puzzle.explainPoints} reasoning` : ""}`}
        actions={s === "live" ? <StatusDot tone="success">Live</StatusDot> : s === "ready" ? <StatusDot tone="info">Ready to publish</StatusDot> : s === "void" ? <StatusDot tone="neutral">Void</StatusDot> : <StatusDot tone="warning">Draft</StatusDot>}
      />
      <PuzzleBuilder existing={puzzle} initialStep={search.get("step") ?? undefined} onSaved={load} />
    </PageBody>
  );
}
