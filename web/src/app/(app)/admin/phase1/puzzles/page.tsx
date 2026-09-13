"use client";

import Link from "next/link";

import { PuzzleList } from "@/components/admin/phase1-lists";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { PageBody, PageHeader } from "@/components/ui/page";

export default function PuzzlesPage() {
  return (
    <PageBody width="wide">
      <PageHeader
        title="Section A · Puzzles"
        description="Logical puzzles: multiple choice, short answers, sequences, lists — or written answers an evaluator marks. Each must pass its self-test before it can go live."
        actions={
          <Button asChild>
            <Link href="/admin/phase1/puzzles/new">
              <Icon.Plus size={14} /> New puzzle
            </Link>
          </Button>
        }
      />
      <PuzzleList />
    </PageBody>
  );
}
