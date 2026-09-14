"use client";

import Link from "next/link";
import { useState } from "react";

import { PuzzleList } from "@/components/admin/phase1-lists";
import { TransferActions } from "@/components/admin/phase1-transfer";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { PageBody, PageHeader } from "@/components/ui/page";

export default function PuzzlesPage() {
  // An import creates rows behind the list's back; remounting is the simplest
  // honest refresh, and the list already loads on mount.
  const [version, setVersion] = useState(0);

  return (
    <PageBody width="wide">
      <PageHeader
        title="Section A · Puzzles"
        description="Each one must pass its self-test before it can go live."
        actions={
          <>
            <TransferActions section="puzzles" onImported={async () => setVersion((v) => v + 1)} />
            <Button asChild>
              <Link href="/admin/phase1/puzzles/new">
                <Icon.Plus size={14} /> New puzzle
              </Link>
            </Button>
          </>
        }
      />
      <PuzzleList key={version} />
    </PageBody>
  );
}
