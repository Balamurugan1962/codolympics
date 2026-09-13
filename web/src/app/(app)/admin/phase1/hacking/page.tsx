"use client";

import Link from "next/link";

import { HackList } from "@/components/admin/phase1-lists";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { PageBody, PageHeader } from "@/components/ui/page";

export default function HackingPage() {
  return (
    <PageBody width="wide">
      <PageHeader
        title="Section B · Hacking"
        description="A deliberately flawed solution per question. Participants read it and send an input that breaks it; a known breaking input must be proven before it can go live."
        actions={
          <Button asChild>
            <Link href="/admin/phase1/hacking/new">
              <Icon.Plus size={14} /> New hacking question
            </Link>
          </Button>
        }
      />
      <HackList />
    </PageBody>
  );
}
