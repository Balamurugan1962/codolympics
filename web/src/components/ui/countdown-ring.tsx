"use client";

/** A ring that drains as the deadline approaches and visibly refills when it moves. */
import { useEffect, useState } from "react";

import { useContest } from "../contest-provider";

export function CountdownRing({ until, totalSeconds, size = 120, label }: { until: string | null; totalSeconds: number; size?: number; label?: string }) {
  const { serverNow } = useContest();
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 100); return () => clearInterval(id); }, []);

  const ms = until ? Math.max(0, Date.parse(until) - serverNow()) : 0;
  const frac = totalSeconds > 0 ? Math.min(1, ms / (totalSeconds * 1000)) : 0;
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const s = Math.ceil(ms / 1000);
  const urgent = ms > 0 && ms < 5000;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="timer" aria-live="off" aria-label={`${s} seconds remaining`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#E3E6EA" strokeWidth="8" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={urgent ? "#D0342C" : "#1BA94C"} strokeWidth="8" fill="none"
          strokeDasharray={c} strokeDashoffset={c * (1 - frac)} strokeLinecap="round" style={{ transition: "stroke-dashoffset .1s linear, stroke .2s" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className={`text-3xl font-semibold num ${urgent ? "text-red" : "text-ink"}`}>{until ? s : "—"}</div>
        {label && <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">{label}</div>}
      </div>
    </div>
  );
}
