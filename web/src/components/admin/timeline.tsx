"use client";

/**
 * Events in the order they happened, for the page that settles "what did they
 * actually do". Time on the left, one line per event, the ones with something
 * to show opening in place.
 */
import { useState, type ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

import { Icon } from "@/components/icons";
import { LocalTime } from "@/components/local-time";
import { cn } from "@/lib/utils";

const CodeEditor = dynamic(() => import("@/components/editor").then((m) => m.CodeEditor), { ssr: false, loading: () => <div className="h-64 rounded-md bg-muted" /> });

export type Tone = "neutral" | "success" | "warning" | "destructive" | "info";

const DOT: Record<Tone, string> = {
  neutral: "border-line-2 bg-card",
  success: "border-green bg-green",
  warning: "border-amber bg-amber",
  destructive: "border-red bg-red",
  info: "border-blue bg-blue",
};

/** Whether a set of times crosses midnight, so every one of them needs its date. */
export function spansDays(isos: string[]): boolean {
  const days = new Set(isos.map((iso) => new Date(iso).toDateString()));
  return days.size > 1;
}

export function Timeline({ children }: { children: ReactNode }) {
  return <ol className="relative divide-y divide-line/70">{children}</ol>;
}

export function Event({ at, withDate = false, tone = "neutral", title, href, chips, summary, children }: {
  at: string;
  withDate?: boolean;
  /** The event's own page, when it has one. */
  href?: string;
  tone?: Tone;
  title: ReactNode;
  chips?: ReactNode;
  /** One line under the title; the whole story when there is nothing to open. */
  summary?: ReactNode;
  /** What opens: the code, the input, the compiler's output. */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const openable = Boolean(children);
  const cols = withDate ? "grid-cols-[8.5rem_1rem_minmax(0,1fr)_auto]" : "grid-cols-[5.5rem_1rem_minmax(0,1fr)_auto]";
  return (
    <li className={cn(open && "bg-muted/30")}>
      <div className={cn("grid w-full items-start gap-x-3 px-4 py-3", cols, openable && "transition-colors hover:bg-muted/50")}>
        <span className="pt-0.5 text-[12px] text-muted-foreground tabular-nums"><LocalTime iso={at} withDate={withDate} /></span>
        <span className="flex justify-center pt-[7px]"><span className={cn("size-2.5 rounded-full border-2", DOT[tone])} /></span>
        {/* The toggle is the whole text block, so the row reads as one target; the link sits beside it. */}
        <button
          type="button"
          onClick={openable ? () => setOpen((o) => !o) : undefined}
          aria-expanded={openable ? open : undefined}
          disabled={!openable}
          className="min-w-0 text-left disabled:cursor-default"
        >
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-medium">{title}</span>
            {chips}
          </span>
          {summary && <span className="mt-0.5 block text-[12.5px] text-muted-foreground">{summary}</span>}
        </button>
        <span className="flex items-center gap-2 pt-0.5">
          {href && (
            <Link href={href} className="inline-flex items-center gap-1 text-[12px] font-medium text-brand hover:underline">
              Open <Icon.ArrowRight size={12} />
            </Link>
          )}
          {openable && (
            <button type="button" onClick={() => setOpen((o) => !o)} aria-label={open ? "Hide" : "Show"} className="rounded p-0.5 text-faint hover:bg-muted">
              <Icon.ChevronDown size={14} className={cn("transition-transform", open ? "" : "-rotate-90")} />
            </button>
          )}
        </span>
      </div>
      {open && children && <div className={cn("border-t border-line/70 px-4 py-3", withDate ? "pl-[calc(8.5rem+1rem+1.5rem)]" : "pl-[calc(5.5rem+1rem+1.5rem)]")}>{children}</div>}
    </li>
  );
}

/** Source as they wrote it, read only, in the language it was sent in, as tall as it is. */
export function Code({ source, language, maxLines = 28 }: { source: string; language: string; maxLines?: number }) {
  const lines = Math.min(maxLines, Math.max(4, source.split("\n").length));
  return (
    <div className="overflow-hidden rounded-md border border-line">
      <CodeEditor value={source} language={language} readOnly height={`${lines * 19 + 20}px`} />
    </div>
  );
}

export function Plain({ children, tone }: { children: string; tone?: string }) {
  return <pre className={cn("pane max-h-56 overflow-auto rounded-md border border-line bg-muted/50 px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap", tone)}>{children}</pre>;
}
