"use client";

/**
 * Where a competitor lands after registering.
 *
 * The screen itself is shared with the dashboard's registration hold — see
 * WelcomeScreen. What this page adds is the forward: when the organisers start
 * the contest, it takes the competitor into it rather than leaving a hall of
 * people on a rules page waiting to be told to click something.
 *
 * The forward fires on a *change* of phase rather than on arrival, because the
 * account menu links here mid-contest: someone opening the rules during the
 * auction wants to read them, not be bounced out of them.
 */
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { useContest } from "@/components/contest-provider";
import { WelcomeScreen } from "@/components/contest/welcome-screen";

export default function WelcomePage() {
  const { state } = useContest();
  const router = useRouter();
  const phase = state?.contest.phase ?? "registration";
  const arrivedIn = useRef(phase);
  const started = arrivedIn.current === "registration" && phase !== "registration";

  useEffect(() => {
    if (!started || state?.viewer.role !== "participant") return;
    // A beat so the status line can be read before the screen changes.
    const t = setTimeout(() => router.replace("/dashboard"), 1200);
    return () => clearTimeout(t);
  }, [started, router, state?.viewer.role]);

  return <WelcomeScreen forwarding={started} />;
}
