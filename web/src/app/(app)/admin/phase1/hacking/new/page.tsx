"use client";

import Link from "next/link";

import { HackBuilder } from "@/components/admin/hack-builder";
import { Icon } from "@/components/icons";
import { PageBody, PageHeader } from "@/components/ui/page";

export default function NewHackPage() {
  return (
    <PageBody width="wide">
      <PageHeader
        breadcrumb={<Link href="/admin/phase1/hacking" className="inline-flex items-center gap-1 hover:text-ink"><Icon.ChevronLeft size={14} /> Hacking questions</Link>}
        title="New hacking question"
      />
      <HackBuilder existing={null} />
    </PageBody>
  );
}
