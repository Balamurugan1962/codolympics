"use client";

import { Phase1Standings, useStandings } from "@/components/admin/standings";
import { PageBody, PageHeader, Section } from "@/components/ui/page";

export default function Phase1LeaderboardPage() {
  const { data } = useStandings();
  return (
    <PageBody width="wide">
      <PageHeader
        title="Phase 1 standings"
        description="Section A and Section B added together, ranked by points then by the earlier finish time. Everyone is listed, including those on zero."
      />
      <Section padded={false}>
        <Phase1Standings rows={data?.phase1 ?? null} />
      </Section>
    </PageBody>
  );
}
