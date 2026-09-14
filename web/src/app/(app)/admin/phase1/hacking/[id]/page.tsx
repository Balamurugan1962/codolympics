"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { HackBuilder } from "@/components/admin/hack-builder";
import { stateOf, type Hack } from "@/components/admin/phase1-types";
import { Icon } from "@/components/icons";
import { StatusDot } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageBody, PageHeader, Section } from "@/components/ui/page";
import { DetailSkeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/client";

export default function EditHackPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const [hack, setHack] = useState<Hack | null | undefined>(undefined);
  const load = useCallback(async () => {
    const r = await api.get<{ questions: Hack[] }>("/api/admin/phase1/hacking");
    setHack(r.questions.find((q) => q.id === Number(id)) ?? null);
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const crumb = <Link href="/admin/phase1?tab=hacking" className="inline-flex items-center gap-1 hover:text-ink"><Icon.ChevronLeft size={14} /> Phase 1 · Section B</Link>;
  if (hack === undefined) return <PageBody width="wide"><DetailSkeleton tabs={2} /></PageBody>;
  if (hack === null) return <PageBody width="wide"><PageHeader breadcrumb={crumb} title="Question not found" /><Section padded={false}><EmptyState icon={<Icon.Bug size={20} />} title="No hacking question with that id" /></Section></PageBody>;
  const s = stateOf(hack);
  return (
    <PageBody width="wide">
      <PageHeader
        breadcrumb={crumb}
        title={hack.title}
        description={<span>Question #{hack.id} · judge problem <span className="font-mono">{hack.problemId}</span> · {hack.hackPoints} pts</span>}
        actions={s === "live" ? <StatusDot tone="success">Live</StatusDot> : s === "ready" ? <StatusDot tone="info">Ready to publish</StatusDot> : s === "void" ? <StatusDot tone="neutral">Void</StatusDot> : <StatusDot tone="warning">Draft</StatusDot>}
      />
      <HackBuilder existing={hack} initialStep={search.get("step") ?? undefined} onSaved={load} />
    </PageBody>
  );
}
