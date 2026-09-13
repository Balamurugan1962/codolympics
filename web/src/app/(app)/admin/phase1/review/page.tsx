"use client";

import { Review } from "@/components/admin/phase1-lists";
import { PageBody, PageHeader } from "@/components/ui/page";

export default function ReviewPage() {
  return (
    <PageBody width="wide">
      <PageHeader
        title="Review & advance"
        description="Phase 1 standings, and the selection of who goes through to the auction. Grades can still change afterwards; the selection can be revised until Phase 2 opens."
      />
      <Review />
    </PageBody>
  );
}
