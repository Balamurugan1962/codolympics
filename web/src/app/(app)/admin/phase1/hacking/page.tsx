"use client";

import Link from "next/link";
import { useState } from "react";

import { HackList } from "@/components/admin/phase1-lists";
import { TransferActions } from "@/components/admin/phase1-transfer";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { PageBody, PageHeader } from "@/components/ui/page";

export default function HackingPage() {
  const [version, setVersion] = useState(0);

  return (
    <PageBody width="wide">
      <PageHeader
        title="Hacking questions"
        description="Each one needs a proven breaking input before it can go live."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/admin/phase1/hacking/order">
                <Icon.Sort size={14} /> Order
              </Link>
            </Button>
            <TransferActions section="hacking" onImported={async () => setVersion((v) => v + 1)} />
            <Button asChild>
              <Link href="/admin/phase1/hacking/new">
                <Icon.Plus size={14} /> New hacking question
              </Link>
            </Button>
          </>
        }
      />
      <HackList key={version} />
    </PageBody>
  );
}
