"use client";

/**
 * A problem as a participant reads it, set the way LeetCode sets one: a title with
 * the limits as chips, the statement, then the examples. The workspace renders
 * this for the owner and the administrator's preview renders the same component,
 * so what is checked is what is shown.
 */
import { Icon } from "../icons";
import { Markdown } from "../markdown";
import { EmptyState } from "../ui/empty-state";
import { copyText } from "@/lib/clipboard";

const seconds = (ms: number) => `${ms / 1000} ${ms === 1000 ? "second" : "seconds"}`;

export function StatementView({ title, statementMd, timeLimitMs, memoryLimitMb, hiddenTestcases, samples, onCopied }: {
  title?: string; statementMd: string; timeLimitMs: number | null; memoryLimitMb: number | null; hiddenTestcases: number | null;
  samples: { input: string; output: string }[]; onCopied?: () => void;
}) {
  return (
    <article>
      <header className="problem-statement-header">
        {title && <h2 className="title">{title}</h2>}
        <div className="chips">
          <span className="chip"><Icon.Clock size={12} />Time limit <b>{timeLimitMs ? seconds(timeLimitMs) : "—"}</b></span>
          <span className="chip"><Icon.Cpu size={12} />Memory limit <b>{memoryLimitMb ? `${memoryLimitMb} MB` : "—"}</b></span>
          <span className="chip">Standard input / output</span>
        </div>
      </header>
      {statementMd.trim()
        ? <Markdown className="problem-statement">{statementMd}</Markdown>
        : <EmptyState compact icon={<Icon.Code size={18} />} title="No statement yet" body="Participants would see nothing here." />}
      {samples.length > 0 && (
        <section className="problem-examples">
          <h3>{samples.length === 1 ? "Example" : "Examples"}</h3>
          {samples.map((s, i) => (
            <div key={i} className="problem-example">
              <SampleBox label={samples.length > 1 ? `Sample Input ${i + 1}` : "Sample Input"} text={s.input} onCopied={onCopied} />
              <SampleBox label={samples.length > 1 ? `Sample Output ${i + 1}` : "Sample Output"} text={s.output} onCopied={onCopied} />
            </div>
          ))}
          <p className="mt-3 text-[12px] text-muted-foreground">
            {hiddenTestcases ? `${hiddenTestcases} more test${hiddenTestcases === 1 ? "" : "s"}` : "Other tests"} stay hidden. Failing an example usually means an output-format mistake.
          </p>
        </section>
      )}
    </article>
  );
}

export function SampleBox({ label, text, onCopied }: { label: string; text: string; onCopied?: () => void }) {
  return (
    <div className="problem-io">
      <div className="problem-io-title">
        {label}
        <button type="button" className="flex items-center gap-1 text-[12px] font-medium text-brand-deep hover:underline" onClick={async () => { if (await copyText(text)) onCopied?.(); }}>
          <Icon.Copy size={12} /> Copy
        </button>
      </div>
      <pre>{text || <span className="text-faint">(empty)</span>}</pre>
    </div>
  );
}
