"use client";

import Link from "next/link";

import { PuzzleBuilder } from "@/components/admin/puzzle-builder";
import { Icon } from "@/components/icons";
import { PageBody, PageHeader } from "@/components/ui/page";

export default function NewPuzzlePage() {
  return (
    <PageBody width="wide">
      <PageHeader
        breadcrumb={<Link href="/admin/phase1" className="inline-flex items-center gap-1 hover:text-ink"><Icon.ChevronLeft size={14} /> Phase 1 · Section A</Link>}
        title="New puzzle"
        description="Choose the kind, write the question, decide how it is graded, and check it as a participant will see it."
      />
      <PuzzleBuilder existing={null} />
    </PageBody>
  );
}
