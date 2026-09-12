"use client";

/**
 * A Section B question as a participant sees it: the problem, its
 * constraints, and the flawed solution to read. Used by the hacking page and
 * by the administrator's preview.
 */
import dynamic from "next/dynamic";

import { Markdown } from "../markdown";
import { Badge } from "../ui/badge";

const CodeEditor = dynamic(() => import("../editor").then((m) => m.CodeEditor), { ssr: false, loading: () => <div className="h-80 bg-[#1e1e1e]" /> });

export type HackView = { id: number; title: string; statement_md: string; constraints_md: string; given_source: string; given_language: string; hack_points: number; fail_penalty: number };

export function HackQuestionView({ q, index, total, hacked = false, eyebrowExtra }: { q: HackView; index: number; total: number; hacked?: boolean; eyebrowExtra?: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-box border border-line bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">Solution {index + 1} of {total}{eyebrowExtra}</div>
          <h2 className="mt-1 text-[17px] font-semibold leading-snug">{q.title || <span className="text-faint">Untitled question</span>}</h2>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <Badge tone="navy">{q.hack_points} pts</Badge>
          {q.fail_penalty > 0 && <Badge tone="amber">−{q.fail_penalty} per miss</Badge>}
          {hacked && <Badge tone="green">hacked</Badge>}
        </div>
      </div>
      <div className="grid gap-5 p-5 lg:grid-cols-2">
        <div className="space-y-4">
          {q.statement_md.trim() ? <Markdown>{q.statement_md}</Markdown> : <p className="text-[13px] text-faint">The problem statement goes here.</p>}
          {q.constraints_md.trim() && (
            <div className="rounded-box border border-line bg-page p-3 text-[13px]">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Constraints</div>
              <Markdown>{q.constraints_md}</Markdown>
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
            <span>The given solution · {q.given_language}</span>
            <span className="font-normal normal-case tracking-normal text-faint">read only — it is wrong somewhere</span>
          </div>
          <div className="overflow-hidden rounded-box border border-line"><CodeEditor value={q.given_source} language={q.given_language} readOnly height="320px" /></div>
        </div>
      </div>
    </div>
  );
}
