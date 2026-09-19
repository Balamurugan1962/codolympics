"use client";

import { useParams } from "next/navigation";

import { PowerupDetail } from "@/components/admin/powerups";
import { BackLink, PageBody } from "@/components/ui/page";

export default function PowerupPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <PageBody width="narrow">
      <BackLink href="/admin/powerups">Powerups</BackLink>
      <PowerupDetail id={Number(id)} />
    </PageBody>
  );
}
