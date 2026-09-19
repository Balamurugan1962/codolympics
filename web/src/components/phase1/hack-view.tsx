"use client";

/**
 * A Section B question as a participant sees it: the problem, its
 * constraints, and the flawed solution to read. Used by the hacking page and
 * by the administrator's preview.
 *
 * The code is the work here — you are hunting a bug in it, not skimming it —
 * so it gets the larger half and a pane tall enough to hold a real solution.
 * It used to be a 320px box in an even split, which showed sixteen lines of a
 * forty-line program through a letterbox and made the reader scroll in two
 * directions at once.
 *
 * The constraints stay beside it rather than above, because the bug is usually
 * found by reading one against the other. When that is not enough, "Wide" hands
 * the code the whole card.
 */
import dynamic from "next/dynamic";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { Icon } from "../icons";
import { Markdown } from "../markdown";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

const CodeEditor = dynamic(() => import("../editor").then((m) => m.CodeEditor), {
  ssr: false,
  loading: () => <div className="h-full min-h-[420px] animate-pulse bg-[#1e1e1e]" />,
});

export type HackView = { id: number; title: string; statement_md: string; constraints_md: string; given_source: string; given_language: string; hack_points: number; fail_penalty: number };

export function HackQuestionView({ q, index, total, hacked = false, eyebrowExtra }: { q: HackView; index: number; total: number; hacked?: boolean; eyebrowExtra?: React.ReactNode }) {
  const [wide, setWide] = useState(false);
  const lines = q.given_source.split("\n").length;
  /* Fit the program rather than the viewport: a seventeen-line solution in a
   * fixed 62vh box is half a screen of empty dark, and a hundred-line one still
   * needs a cap. ~19px is the line box at font-size 13, plus the editor's own
   * top and bottom padding. */
  const height = `${Math.round(Math.min(wide ? 860 : 680, Math.max(240, lines * 19 + 30)))}px`;

  const code = (
    <div className="flex min-w-0 flex-col">
      <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
        <span className="truncate">
          The given solution · {q.given_language}
          <span className="ml-2 font-normal tracking-normal normal-case text-faint tabular-nums">{lines} lines</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="hidden font-normal tracking-normal normal-case text-faint sm:inline">read only. It is wrong somewhere</span>
          <Button
            variant="outline"
            size="xs"
            onClick={() => setWide((w) => !w)}
            aria-pressed={wide}
            title={wide ? "Put the statement back beside the code" : "Give the code the full width"}
          >
            {wide ? <Icon.Collapse size={12} /> : <Icon.Expand size={12} />}
            {wide ? "Split" : "Wide"}
          </Button>
        </span>
      </div>
      <div className="overflow-hidden rounded-box border border-line">
        <CodeEditor value={q.given_source} language={q.given_language} readOnly height={height} />
      </div>
    </div>
  );

  const statement = (
    <div className={cn("space-y-4", wide && "min-w-0")}>
      {q.statement_md.trim() ? <Markdown>{q.statement_md}</Markdown> : <p className="text-[13px] text-faint">The problem statement goes here.</p>}
      {q.constraints_md.trim() && (
        <div className="rounded-box border border-line bg-muted p-3 text-[13px]">
          <div className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">Constraints</div>
          <Markdown>{q.constraints_md}</Markdown>
        </div>
      )}
    </div>
  );

  return (
    <div className="overflow-hidden rounded-box border border-line bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">
            Solution {index + 1} of {total}
            {eyebrowExtra}
          </div>
          <h2 className="mt-1 text-[17px] leading-snug font-semibold">{q.title || <span className="text-faint">Untitled question</span>}</h2>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <Badge variant="navy">{q.hack_points} pts</Badge>
          {q.fail_penalty > 0 && <Badge variant="warning">−{q.fail_penalty} per miss</Badge>}
          {hacked && <Badge variant="success">hacked</Badge>}
        </div>
      </div>

      {wide ? (
        <div className="space-y-5 p-5">
          {code}
          {statement}
        </div>
      ) : (
        /* The code takes the larger share: reading it is the task, and the
           statement is a paragraph and a constraint box. */
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          {statement}
          {code}
        </div>
      )}
    </div>
  );
}
