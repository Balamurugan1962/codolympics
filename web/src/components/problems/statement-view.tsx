"use client";

/**
 * A problem as a participant reads it: limits, the statement, the samples.
 * The workspace renders this for the owner; the administrator's preview
 * renders the same component, so what is checked is what is shown.
 */
import { Icon } from "../icons";
import { Markdown } from "../markdown";
import { EmptyState } from "../ui/empty-state";

export function StatementView({ statementMd, timeLimitMs, memoryLimitMb, hiddenTestcases, samples, onCopied }: {
  statementMd: string; timeLimitMs: number | null; memoryLimitMb: number | null; hiddenTestcases: number | null;
  samples: { input: string; output: string }[]; onCopied?: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-muted">
        <span>Time limit <strong className="text-ink">{timeLimitMs ? `${timeLimitMs / 1000} s` : "—"}</strong></span>
        <span>Memory <strong className="text-ink">{memoryLimitMb ? `${memoryLimitMb} MB` : "—"}</strong></span>
        <span>Hidden tests <strong className="text-ink">{hiddenTestcases ?? "—"}</strong></span>
        <span>Input via <strong className="text-ink">stdin</strong>, output to <strong className="text-ink">stdout</strong></span>
      </div>
      {statementMd.trim() ? <Markdown>{statementMd}</Markdown> : <EmptyState compact icon={<Icon.Code size={18} />} title="No statement yet" body="Participants would see nothing here." />}
      {samples.length > 0 && (
        <section>
          <h3 className="mb-2 text-[13px] font-semibold">Samples</h3>
          <div className="space-y-3">
            {samples.map((s, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                <SampleBox label={`Input ${i + 1}`} text={s.input} onCopied={onCopied} />
                <SampleBox label={`Output ${i + 1}`} text={s.output} onCopied={onCopied} />
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-faint">Hidden tests are never shown, for free or for payment. Failing a sample usually means an output-format mistake.</p>
        </section>
      )}
    </div>
  );
}

export function SampleBox({ label, text, onCopied }: { label: string; text: string; onCopied?: () => void }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between text-[11.5px] font-semibold text-muted">
        {label}
        <button type="button" className="flex items-center gap-1 text-green-dark hover:underline" onClick={() => { void navigator.clipboard?.writeText(text); onCopied?.(); }}><Icon.Copy size={12} /> Copy</button>
      </div>
      <pre className="max-h-40 overflow-auto rounded-box border border-line bg-page p-2 text-[12px]">{text || <span className="text-faint">(empty)</span>}</pre>
    </div>
  );
}
