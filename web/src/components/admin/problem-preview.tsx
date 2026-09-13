"use client";

/**
 * The owner's view of a problem, framed the way the workspace frames it,
 * for the administrator to check before anything goes live.
 */
import { Icon } from "../icons";
import { StatementView } from "../problems/statement-view";
import { Badge } from "../ui/badge";

import { DifficultyBadge } from "./question-details-form";

export function ProblemPreview({ title, difficulty, score, statementMd, timeLimitMs, memoryLimitMb, testcases, sampleCount, samples }: {
  title: string; difficulty: string; score: number; statementMd: string; timeLimitMs: number | null; memoryLimitMb: number | null;
  testcases: number | null; sampleCount: number; samples: { input: string; output: string }[];
}) {
  return (
    <div className="overflow-hidden rounded-box border border-line bg-card">
      <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <span className="text-faint"><Icon.ChevronLeft size={16} /></span>
        <h3 className="truncate text-[15px] font-semibold">{title || <span className="text-faint">Untitled problem</span>}</h3>
        <DifficultyBadge d={difficulty} />
        <Badge variant="neutral">{score} pts</Badge>
      </div>
      <div className="flex gap-1 border-b border-line px-4">
        {["Problem", "Submissions", "Hints"].map((t, i) => (
          <span key={t} className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-semibold ${i === 0 ? "border-green text-ink" : "border-transparent text-faint"}`}>{t}</span>
        ))}
      </div>
      <div className="p-4">
        <StatementView
          statementMd={statementMd}
          timeLimitMs={timeLimitMs}
          memoryLimitMb={memoryLimitMb}
          hiddenTestcases={testcases === null ? null : Math.max(0, testcases - sampleCount)}
          samples={samples.slice(0, sampleCount)}
        />
      </div>
    </div>
  );
}
