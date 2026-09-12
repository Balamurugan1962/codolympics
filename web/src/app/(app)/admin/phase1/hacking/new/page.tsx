"use client";

import Link from "next/link";

import { HackBuilder } from "@/components/admin/hack-builder";
import { Icon } from "@/components/icons";
import { PageBody, PageHeader } from "@/components/ui/page";

export default function NewHackPage() {
  return (
    <PageBody width="wide">
      <PageHeader
        breadcrumb={<Link href="/admin/phase1?tab=hacking" className="inline-flex items-center gap-1 hover:text-ink"><Icon.ChevronLeft size={14} /> Phase 1 · Section B</Link>}
        title="New hacking question"
        description="Pick the judge problem, write the statement, paste the flawed solution, and check it as a participant will see it."
      />
      <HackBuilder existing={null} />
    </PageBody>
  );
}
