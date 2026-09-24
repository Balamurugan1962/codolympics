"use client";

/** One puzzle wired to autosave. Phase 1 puts it beside the hacking questions. */
import { useRef, useState } from "react";

import { PuzzleCard, defaultAnswer, type PuzzleView, type SaveStatus } from "@/components/phase1/puzzle-card";
import { api, errorMessage } from "@/lib/client";

export function LiveQuestion({ index, total, q, saved, locked, onSaved }: { index: number; total: number; q: PuzzleView; saved?: { answer: unknown; explanation: string | null }; locked: boolean; onSaved: () => void }) {
  const [answer, setAnswer] = useState<unknown>(saved?.answer ?? defaultAnswer(q));
  const [explanation, setExplanation] = useState(saved?.explanation ?? "");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [formatError, setFormatError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = (next: { answer?: unknown; explanation?: string }) => {
    if (locked) return;
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try { await api.put(`/api/phase1/puzzles/${q.id}/answer`, next); setStatus("saved"); setFormatError(null); onSaved(); }
      catch (err) { setStatus("failed"); setFormatError(errorMessage(err)); }
    }, 700);
  };

  return (
    <PuzzleCard
      q={q} index={index} total={total} answer={answer} explanation={explanation} status={status} locked={locked} formatError={formatError}
      onAnswer={(v, ok) => { setAnswer(v); if (ok) { setFormatError(null); schedule({ answer: v }); } else setFormatError(`Expected: ${q.format_hint ?? "a different format"}`); }}
      onExplanation={(v) => { setExplanation(v); schedule({ explanation: v }); }}
    />
  );
}
