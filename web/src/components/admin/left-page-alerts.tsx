"use client";

/**
 * What an administrator hears the moment a competitor leaves the page: a
 * toast naming them, how they left and where their count stands, and a
 * louder one when the count locks them, with the way to the unlock.
 */
import { useRouter } from "next/navigation";

import { useEngineEvent } from "../contest-provider";
import { useToast } from "../ui/toast";

type LeftPage = {
  participant_id: string;
  name: string;
  kind?: "fullscreen" | "blur" | "hidden";
  alerts?: number;
  warnings?: number;
  locked?: boolean;
  unlocked?: boolean;
};

export const LEFT_HOW: Record<NonNullable<LeftPage["kind"]>, string> = {
  fullscreen: "left full screen",
  blur: "switched away from the window",
  hidden: "hid the tab",
};

export function LeftPageAlerts() {
  const { toast } = useToast();
  const router = useRouter();

  useEngineEvent("proctor", (event) => {
    const d = event.data as unknown as LeftPage;
    // An unlock was this administrator's own doing, or another's; either way, not news.
    if (d.unlocked || !d.kind) return;
    const open = { label: "Open", onClick: () => router.push(`/admin/participants/${d.participant_id}`) };
    if (d.locked) {
      toast({
        title: `${d.name} is locked out`,
        description: `They left the page ${d.alerts} times. Only you can unlock them, from their page.`,
        tone: "error",
        duration: 0,
        action: open,
      });
      return;
    }
    const lastWarning = (d.alerts ?? 0) >= (d.warnings ?? 0);
    toast({
      title: `${d.name} ${LEFT_HOW[d.kind]}`,
      description: `Alert ${d.alerts} of ${d.warnings}.${lastWarning ? " The next one locks them." : ""}`,
      tone: "warning",
      duration: 9000,
      action: open,
    });
  });

  return null;
}
