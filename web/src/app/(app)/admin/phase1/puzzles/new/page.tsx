"use client";

import Link from "next/link";

import { PuzzleBuilder } from "@/components/admin/puzzle-builder";
import { Icon } from "@/components/icons";
import { PageBody, PageHeader } from "@/components/ui/page";

export default function NewPuzzlePage() {
  return (
    <PageBody width="wide">
      <PageHeader
        breadcrumb={<Link href="/admin/phase1/puzzles" className="inline-flex items-center gap-1 hover:text-ink"><Icon.ChevronLeft size={14} /> Puzzles</Link>}
        title="New puzzle"
      />
      <PuzzleBuilder existing={null} />
    </PageBody>
  );
}
