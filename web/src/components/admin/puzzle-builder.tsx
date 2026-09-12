"use client";

/**
 * Authoring one Section A puzzle, in steps: what kind of question it is,
 * the question itself, how it is graded, a preview exactly as a participant
 * will see it, and — once it exists — the self-test that proves it works
 * and the publish switch. The answer key never leaves this page except to
 * the administrator's endpoint.
 */
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "../icons";
import { AnswerInput, PuzzleCard, SequenceInput, defaultAnswer, type PuzzleView } from "../phase1/puzzle-card";
import { ReasonAction } from "../reason-action";
import { Alert } from "../ui/alert";
import { Badge, StatusDot } from "../ui/badge";
import { Button } from "../ui/button";
import { ChoiceCards } from "../ui/choice";
import { FormGrid } from "../ui/form";
import { Checkbox, Field, Input, Textarea } from "../ui/input";
import { StringListEditor } from "../ui/list-editor";
import { MarkdownEditor } from "../ui/markdown-editor";
import { Section } from "../ui/page";
import { Checklist, Summary, SummaryItem } from "../ui/summary";
import { useToast } from "../ui/toast";
import { WizardLayout, WizardNote, type WizardStep } from "../ui/wizard";
import { api, errorMessage } from "@/lib/client";

import { CATEGORY_LABEL, GRADING_LABEL, KIND_LABEL, stateOf, type Puzzle } from "./phase1-types";

const CodeEditor = dynamic(() => import("../editor").then((m) => m.CodeEditor), { ssr: false, loading: () => <div className="h-64 bg-[#1e1e1e]" /> });

type Kind = Puzzle["kind"];
type Grading = Puzzle["grading"];
type Category = Puzzle["category"];

type Form = {
  title: string; category: Category; kind: Kind; grading: Grading; points: number; explain_points: number; order_index: number;
  body_md: string; options: string[]; items: string[]; partial_credit: boolean; tolerance: string; case_sensitive: boolean;
  key_option: number | null; key_options: number[]; key_accepted: string[]; key_value: string; key_order: number[]; key_members: string[];
  model_answer: string; validator_py: string; points_per_entry: number; max_entries: number; format_regex: string; format_hint: string;
};

const VALIDATOR_TEMPLATE = `def check(entry):
    # One submitted entry. Return True to accept it.
    # entry is a reader: .rest(), .int(lo, hi), .word(), .line(), .ints(n)
    s = entry.rest().strip()
    return len(s) == 4 and s.isdigit() and len(set(s)) == 4
`;

const EMPTY: Form = {
  title: "", category: "pattern", kind: "mcq_single", grading: "auto", points: 10, explain_points: 0, order_index: 1,
  body_md: "", options: ["", ""], items: ["", "", ""], partial_credit: false, tolerance: "0", case_sensitive: false,
  key_option: null, key_options: [], key_accepted: [""], key_value: "", key_order: [0, 1, 2], key_members: [""],
  model_answer: "", validator_py: VALIDATOR_TEMPLATE, points_per_entry: 1, max_entries: 100, format_regex: "", format_hint: "",
};

function fromPuzzle(p: Puzzle): Form {
  const c = p.config ?? {}; const k = p.answerKey ?? {};
  const items = c.items ?? [];
  return {
    ...EMPTY, title: p.title, category: p.category, kind: p.kind, grading: p.grading, points: p.points, explain_points: p.explainPoints, order_index: p.orderIndex,
    body_md: p.bodyMd, options: c.options?.length ? c.options : ["", ""], items: items.length ? items : ["", "", ""],
    partial_credit: Boolean(c.partialCredit), tolerance: c.tolerance === undefined ? "0" : String(c.tolerance), case_sensitive: Boolean(c.caseSensitive),
    key_option: k.option ?? null, key_options: k.options ?? [], key_accepted: k.accepted?.length ? k.accepted : [""], key_value: k.value === undefined ? "" : String(k.value),
    key_order: k.order?.length === items.length && items.length ? k.order : items.map((_, i) => i), key_members: k.members?.length ? k.members : [""],
    model_answer: p.modelAnswer ?? "", validator_py: p.validatorPy ?? VALIDATOR_TEMPLATE, points_per_entry: p.pointsPerEntry ?? 1, max_entries: p.maxEntries,
    format_regex: p.formatRegex ?? "", format_hint: p.formatHint ?? "",
  };
}

const clean = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);
const isMcq = (k: Kind) => k === "mcq_single" || k === "mcq_multi";

function toPayload(f: Form, reason: string) {
  const config: Record<string, unknown> = {};
  if (isMcq(f.kind)) config.options = clean(f.options);
  if (f.kind === "sequence") config.items = clean(f.items);
  if (f.kind === "mcq_multi" || f.kind === "set") config.partialCredit = f.partial_credit;
  if (f.kind === "numeric" && f.tolerance !== "") config.tolerance = Number(f.tolerance);
  if (f.kind === "fill_blank" || f.kind === "set") config.caseSensitive = f.case_sensitive;
  let answer_key: Record<string, unknown> | null = null;
  if (f.grading === "auto") {
    answer_key = {};
    if (f.kind === "mcq_single") answer_key.option = f.key_option ?? 0;
    if (f.kind === "mcq_multi") answer_key.options = [...f.key_options].sort((a, b) => a - b);
    if (f.kind === "fill_blank") answer_key.accepted = clean(f.key_accepted);
    if (f.kind === "numeric") answer_key.value = Number(f.key_value);
    if (f.kind === "sequence") answer_key.order = f.key_order;
    if (f.kind === "set") answer_key.members = clean(f.key_members);
  }
  return {
    reason, title: f.title.trim(), body_md: f.body_md, category: f.category, kind: f.kind, grading: f.grading, points: f.points, explain_points: f.explain_points,
    order_index: f.order_index, config, answer_key, model_answer: f.model_answer.trim() || null,
    validator_py: f.grading === "validator" ? f.validator_py : null, points_per_entry: f.grading === "validator" ? f.points_per_entry : null,
    max_entries: f.max_entries, format_regex: f.format_regex.trim() || null, format_hint: f.format_hint.trim() || null,
  };
}

function toView(f: Form, id: number): PuzzleView {
  return {
    id, title: f.title, body_md: f.body_md, category: f.category, kind: f.kind, grading: f.grading, points: f.points, explain_points: f.explain_points,
    config: { options: isMcq(f.kind) ? clean(f.options) : undefined, items: f.kind === "sequence" ? clean(f.items) : undefined },
    max_entries: f.max_entries, format_regex: f.format_regex.trim() || null, format_hint: f.format_hint.trim() || null,
  };
}

function basicsIssues(f: Form): string[] {
  const out: string[] = [];
  if (!f.title.trim()) out.push("Give the puzzle a title.");
  if (!Number.isInteger(f.points) || f.points < 0) out.push("Points must be a whole number, zero or more.");
  if (!Number.isInteger(f.explain_points) || f.explain_points < 0) out.push("Reasoning points must be a whole number, zero or more.");
  if (!Number.isInteger(f.order_index) || f.order_index < 0) out.push("Order must be a whole number.");
  return out;
}
function contentIssues(f: Form): string[] {
  const out: string[] = [];
  if (!f.body_md.trim()) out.push("Write the question.");
  if (isMcq(f.kind) && clean(f.options).length < 2) out.push("Give at least two options.");
  if (isMcq(f.kind) && new Set(clean(f.options)).size !== clean(f.options).length) out.push("Two options are identical.");
  if (f.kind === "sequence" && clean(f.items).length < 2) out.push("Give at least two items to order.");
  if (f.kind === "numeric" && (f.tolerance === "" || Number.isNaN(Number(f.tolerance)) || Number(f.tolerance) < 0)) out.push("Tolerance must be a number, zero or more.");
  if (f.kind === "set" && (!Number.isInteger(f.max_entries) || f.max_entries < 1)) out.push("Maximum entries must be at least 1.");
  if (f.format_regex.trim()) { try { new RegExp(f.format_regex); } catch { out.push("The format pattern is not a valid regular expression."); } }
  if (f.format_regex.trim() && !f.format_hint.trim()) out.push("Add a format hint — it is what the participant is told when an entry is rejected.");
  return out;
}
function gradingIssues(f: Form): string[] {
  const out: string[] = [];
  if (f.grading === "auto") {
    if (f.kind === "long_text") out.push("A written answer cannot be graded automatically. Choose an evaluator.");
    if (f.kind === "mcq_single" && (f.key_option === null || f.key_option >= clean(f.options).length)) out.push("Mark the correct option.");
    if (f.kind === "mcq_multi" && f.key_options.filter((i) => i < clean(f.options).length).length === 0) out.push("Mark at least one correct option.");
    if (f.kind === "fill_blank" && clean(f.key_accepted).length === 0) out.push("Give at least one accepted answer.");
    if (f.kind === "numeric" && (f.key_value.trim() === "" || Number.isNaN(Number(f.key_value)))) out.push("Give the correct number.");
    if (f.kind === "sequence" && (f.key_order.length !== clean(f.items).length || new Set(f.key_order).size !== f.key_order.length)) out.push("Set the correct order.");
    if (f.kind === "set" && clean(f.key_members).length === 0) out.push("List the correct entries.");
  }
  if (f.grading === "validator") {
    if (!/def\s+check\s*\(/.test(f.validator_py)) out.push("The validator must define check(entry).");
    if (!Number.isInteger(f.points_per_entry) || f.points_per_entry < 1) out.push("Points per entry must be at least 1.");
  }
  if (f.grading === "manual" && !f.model_answer.trim()) out.push("Record a model answer — the evaluator grades against it, and the self-test needs it.");
  return out;
}

// ---------------------------------------------------------------------------

export function PuzzleBuilder({ existing, initialStep, onSaved }: { existing: Puzzle | null; initialStep?: string; onSaved?: () => Promise<void> }) {
  const router = useRouter();
  const { toast } = useToast();
  const initial = useMemo(() => (existing ? fromPuzzle(existing) : EMPTY), [existing]);
  const [f, setF] = useState<Form>(initial);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reached, setReached] = useState(existing ? 4 : 0);
  const steps: WizardStep[] = useMemo(() => {
    const b = basicsIssues(f), c = contentIssues(f), g = gradingIssues(f);
    const st = (issues: string[], visited: boolean) => (visited ? (issues.length ? "error" : "done") : "todo") as WizardStep["state"];
    return [
      { key: "basics", label: "Basics", hint: "Kind, category, points", state: st(b, reached > 0) },
      { key: "content", label: "Question", hint: "Text, options, format", state: st(c, reached > 1) },
      { key: "grading", label: "Grading", hint: "Key, validator or evaluator", state: st(g, reached > 2) },
      { key: "preview", label: existing ? "Preview" : "Preview & create", hint: "As a participant sees it", state: "todo" },
      ...(existing ? [{ key: "verify", label: "Verify & publish", hint: existing.published ? "Live" : existing.ready ? "Ready to publish" : "Self-test needed", state: (existing.published ? "done" : "todo") as WizardStep["state"] }] : []),
    ];
  }, [f, existing, reached]);
  const startAt = Math.max(0, steps.findIndex((s) => s.key === initialStep));
  const [step, setStep] = useState(startAt);
  // After a reload the saved values replace the form -- unless the author has unsaved edits, which are kept.
  const prevInitial = useRef(initial);
  useEffect(() => {
    setF((cur) => (JSON.stringify(cur) === JSON.stringify(prevInitial.current) ? initial : cur));
    prevInitial.current = initial;
  }, [initial]);

  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const key = steps[Math.min(step, steps.length - 1)].key;
  const issuesFor = (k: string, i: number) => (reached > i ? (k === "basics" ? basicsIssues(f) : k === "content" ? contentIssues(f) : k === "grading" ? gradingIssues(f) : []) : []);
  const allIssues = [...basicsIssues(f), ...contentIssues(f), ...gradingIssues(f)];
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  function go(i: number) { setStep(i); setReached((r) => Math.max(r, i)); setError(null); }
  function next() { go(step + 1); }

  async function save() {
    setBusy(true); setError(null);
    try {
      if (existing) {
        await api.patch(`/api/admin/phase1/puzzles/${existing.id}`, toPayload(f, reason.trim()));
        toast({ title: "Saved", description: existing.ready || existing.published ? "Readiness was reset — run the self-test again before it goes live." : undefined, tone: "success" });
        setReason(""); await onSaved?.();
      } else {
        const r = await api.post<{ id: number }>("/api/admin/phase1/puzzles", toPayload(f, reason.trim()));
        toast({ title: "Puzzle created", description: "Next: run the self-test, then publish.", tone: "success" });
        router.push(`/admin/phase1/puzzles/${r.id}?step=verify`);
      }
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }

  const view = toView(f, existing?.id ?? 0);
  const state = existing ? stateOf(existing) : null;

  return (
    <WizardLayout
      steps={steps}
      current={step}
      onSelect={go}
      reachable={(i) => i <= reached}
      aside={
        existing ? (
          <WizardNote title="Status">
            <div className="mb-2">{state === "live" ? <StatusDot tone="green">Live</StatusDot> : state === "ready" ? <StatusDot tone="blue">Ready to publish</StatusDot> : state === "void" ? <StatusDot tone="grey">Void</StatusDot> : <StatusDot tone="amber">Draft</StatusDot>}</div>
            {dirty ? "You have unsaved changes. Saving resets readiness; the self-test must run again." : existing.published ? "Participants see this question when Section A is open." : existing.ready ? "The self-test passed. Publish it under Verify & publish." : "Run the self-test under Verify & publish before it can go live."}
          </WizardNote>
        ) : (
          <WizardNote title="What happens next">Nothing is saved until you create it. Then you run its self-test — the intended answer must score full marks — and publish it.</WizardNote>
        )
      }
      footer={
        <>
          <Button variant="secondary" disabled={step === 0 || busy} icon={<Icon.ChevronLeft size={14} />} onClick={() => go(step - 1)}>Back</Button>
          <span className="text-[12px] text-muted">Step {step + 1} of {steps.length}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {existing && dirty && (
              <>
                <Input className="w-56" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for the change" aria-label="Reason" />
                <Button variant="ghost" onClick={() => setF(initial)} disabled={busy}>Discard</Button>
                <Button onClick={save} loading={busy} disabled={allIssues.length > 0 || reason.trim().length < 3} icon={<Icon.Check size={14} />}>Save changes</Button>
              </>
            )}
            {!existing && <Link href="/admin/phase1"><Button variant="ghost" disabled={busy}>Cancel</Button></Link>}
            {key === "preview" && !existing
              ? <Button onClick={save} loading={busy} disabled={allIssues.length > 0 || reason.trim().length < 3} icon={<Icon.Plus size={14} />}>Create puzzle</Button>
              : step < steps.length - 1 && <Button onClick={next} disabled={busy}>Continue <Icon.ChevronRight size={14} /></Button>}
          </div>
        </>
      }
    >
      {key === "basics" && (
        <>
          <Section title="What kind of puzzle" description="The kind decides how a participant answers and what can be graded automatically.">
            <div className="space-y-5">
              <Field label="Title">
                <Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. The Missing Number" maxLength={200} autoFocus />
              </Field>
              <Field label="Category" help="Shown to participants above the question.">
                <ChoiceCards value={f.category} onChange={(v) => set("category", v)} size="sm" options={[
                  { value: "pattern", label: "Pattern", description: "Find the rule behind a sequence, grid or code." },
                  { value: "detective", label: "Detective", description: "Deduce the answer from clues." },
                  { value: "constraint", label: "Constraint", description: "Find values that satisfy every condition." },
                ]} />
              </Field>
              <Field label="How they answer">
                <ChoiceCards value={f.kind} onChange={(v) => { set("kind", v); if (v === "long_text" && f.grading === "auto") set("grading", "manual"); }} cols={4} size="sm" options={[
                  { value: "mcq_single", label: "Multiple choice", description: "One correct option." },
                  { value: "mcq_multi", label: "Multiple answers", description: "Several options may be correct; partial credit optional." },
                  { value: "fill_blank", label: "Short answer", description: "A word or phrase, matched against accepted spellings." },
                  { value: "numeric", label: "Number", description: "A number, within a tolerance." },
                  { value: "sequence", label: "Put in order", description: "Arrange the given items correctly." },
                  { value: "set", label: "List of entries", description: "As many valid entries as they can find." },
                  { value: "long_text", label: "Written answer", description: "Free text, marked by an evaluator." },
                ]} />
              </Field>
            </div>
          </Section>
          <Section title="Points" description="Ties break on the earlier submission time, so points need not be unique.">
            <FormGrid cols={3}>
              <Field label="Points" help="For the answer itself.">
                <Input type="number" min={0} step={1} value={f.points} onChange={(e) => set("points", Number(e.target.value))} />
              </Field>
              <Field label="Reasoning points" help="0 asks for no explanation. Otherwise an evaluator marks the written reasoning out of this.">
                <Input type="number" min={0} step={1} value={f.explain_points} onChange={(e) => set("explain_points", Number(e.target.value))} />
              </Field>
              <Field label="Order" help="Position in the section. Lower comes first.">
                <Input type="number" min={0} step={1} value={f.order_index} onChange={(e) => set("order_index", Number(e.target.value))} />
              </Field>
            </FormGrid>
          </Section>
          <StepIssues issues={issuesFor("basics", 0)} />
        </>
      )}

      {key === "content" && (
        <>
          <Section title="The question" description="Everything a participant needs to answer. Diagrams as tables or code blocks render fine.">
            <MarkdownEditor value={f.body_md} onChange={(v) => set("body_md", v)} rows={12} placeholder={"What comes next?\n\n```\n1  1  2  3  5  8  ?\n```"} />
          </Section>
          {isMcq(f.kind) && (
            <Section title="Options" description={f.kind === "mcq_single" ? "In the order shown. Mark the correct one under Grading." : "In the order shown. Mark the correct ones under Grading."}>
              <StringListEditor items={f.options} onChange={(v) => set("options", v)} placeholder={(i) => `Option ${i + 1}`} addLabel="Add option" max={12} />
              {f.kind === "mcq_multi" && <div className="mt-4"><Checkbox label="Partial credit" help="Each correct selection earns its share; a wrong selection cancels one. Otherwise all-or-nothing." checked={f.partial_credit} onChange={(e) => set("partial_credit", e.target.checked)} /></div>}
            </Section>
          )}
          {f.kind === "sequence" && (
            <Section title="Items to order" description="Shown to participants in this order — so shuffle them here. The correct order is set under Grading.">
              <StringListEditor items={f.items} onChange={(v) => { set("items", v); set("key_order", v.map((_, i) => i)); }} placeholder={(i) => `Item ${i + 1}`} addLabel="Add item" max={12} />
            </Section>
          )}
          {(f.kind === "fill_blank" || f.kind === "numeric" || f.kind === "set") && (
            <Section title="Answer format" description="Checked in the browser as they type, so a malformed entry is rejected immediately with the hint. Correctness is never revealed until the section closes.">
              <FormGrid cols={2}>
                <Field label="Pattern" hint="regular expression, optional" help={f.kind === "numeric" ? "e.g. ^-?\\d+$ for an integer" : "e.g. ^\\d{4}$ for exactly four digits"}>
                  <Input className="font-mono" value={f.format_regex} onChange={(e) => set("format_regex", e.target.value)} placeholder={f.kind === "numeric" ? "^-?\\d+$" : "^\\d{4}$"} />
                </Field>
                <Field label="Format hint" help="Shown when an entry does not match, and as the placeholder.">
                  <Input value={f.format_hint} onChange={(e) => set("format_hint", e.target.value)} placeholder="four digits, no spaces" />
                </Field>
              </FormGrid>
              <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
                {f.kind !== "numeric" && <Checkbox label="Case-sensitive" help="Otherwise ABC and abc are the same answer." checked={f.case_sensitive} onChange={(e) => set("case_sensitive", e.target.checked)} />}
                {f.kind === "set" && <Checkbox label="Partial credit" help="Each correct entry earns its share; a wrong one cancels one. Only for an answer key; a validator always scores per entry." checked={f.partial_credit} onChange={(e) => set("partial_credit", e.target.checked)} />}
                {f.kind === "numeric" && (
                  <Field label="Tolerance" help="Accepted if within ± this of the correct value.">
                    <Input type="number" min={0} step="any" className="w-32" value={f.tolerance} onChange={(e) => set("tolerance", e.target.value)} />
                  </Field>
                )}
                {f.kind === "set" && (
                  <Field label="Maximum entries" help="A participant cannot add more than this.">
                    <Input type="number" min={1} max={1000} step={1} className="w-32" value={f.max_entries} onChange={(e) => set("max_entries", Number(e.target.value))} />
                  </Field>
                )}
              </div>
            </Section>
          )}
          {f.kind === "long_text" && (
            <Section title="Answer box" description="A free-text box. The evaluator marks it against your model answer.">
              <Field label="Placeholder" hint="optional" help="A nudge shown inside the empty box.">
                <Input value={f.format_hint} onChange={(e) => set("format_hint", e.target.value)} placeholder="Explain your reasoning in a few sentences." />
              </Field>
            </Section>
          )}
          <StepIssues issues={issuesFor("content", 1)} />
        </>
      )}

      {key === "grading" && (
        <>
          <Section title="Who decides the score" description="Automatic grading happens on save and is revealed when the section closes. Validator code runs in the judge sandbox at section close. An evaluator marks by hand.">
            <ChoiceCards value={f.grading} onChange={(v) => set("grading", v)} size="sm" options={[
              { value: "auto", label: "Answer key", description: "Compared against the key below. Instant, consistent.", disabled: f.kind === "long_text" },
              { value: "validator", label: "Validator code", description: "Your Python decides whether each entry is valid. For open-ended questions with many right answers.", disabled: f.kind !== "set" && f.kind !== "fill_blank" && f.kind !== "long_text" },
              { value: "manual", label: "Evaluator", description: "A person marks it against your model answer, out of the points." },
            ]} />
            {f.grading === "validator" && f.kind !== "set" && <div className="mt-3"><Alert tone="info">Validator grading scores each distinct line of the answer. For a list of entries choose the “List of entries” kind, which gives participants an add-entry control.</Alert></div>}
          </Section>

          {f.grading === "auto" && (
            <Section title="Answer key" description="Never sent to a participant. The self-test will confirm this key scores full marks.">
              {f.kind === "mcq_single" && (
                <div className="space-y-1.5">
                  {clean(f.options).map((o, i) => (
                    <label key={i} className={`flex cursor-pointer items-center gap-3 rounded-box border px-3 py-2.5 text-[13px] ${f.key_option === i ? "border-green bg-green-tint" : "border-line hover:border-line-2"}`}>
                      <input type="radio" name="key" className="accent-green" checked={f.key_option === i} onChange={() => set("key_option", i)} /> <span className="flex-1">{o}</span>{f.key_option === i && <Badge tone="green">correct</Badge>}
                    </label>
                  ))}
                  {clean(f.options).length < 2 && <p className="text-[12.5px] text-muted">Add the options first.</p>}
                </div>
              )}
              {f.kind === "mcq_multi" && (
                <div className="space-y-1.5">
                  {clean(f.options).map((o, i) => {
                    const on = f.key_options.includes(i);
                    return (
                      <label key={i} className={`flex cursor-pointer items-center gap-3 rounded-box border px-3 py-2.5 text-[13px] ${on ? "border-green bg-green-tint" : "border-line hover:border-line-2"}`}>
                        <input type="checkbox" className="accent-green" checked={on} onChange={(e) => set("key_options", e.target.checked ? [...f.key_options, i] : f.key_options.filter((x) => x !== i))} /> <span className="flex-1">{o}</span>{on && <Badge tone="green">correct</Badge>}
                      </label>
                    );
                  })}
                </div>
              )}
              {f.kind === "fill_blank" && (
                <Field label="Accepted answers" help={`Any of these scores full marks${f.case_sensitive ? "" : ", ignoring case"}. Add spellings and synonyms you will accept.`}>
                  <StringListEditor items={f.key_accepted} onChange={(v) => set("key_accepted", v)} placeholder={() => "an accepted answer"} addLabel="Add another" numbered={false} />
                </Field>
              )}
              {f.kind === "numeric" && (
                <FormGrid cols={2}>
                  <Field label="Correct value"><Input type="number" step="any" value={f.key_value} onChange={(e) => set("key_value", e.target.value)} /></Field>
                  <Field label="Tolerance" help="Set under Question; repeated here for reference."><Input type="number" step="any" value={f.tolerance} onChange={(e) => set("tolerance", e.target.value)} /></Field>
                </FormGrid>
              )}
              {f.kind === "sequence" && (
                <Field label="Correct order" help="Arrange the items the way a full-marks answer would.">
                  <SequenceInput items={clean(f.items)} value={f.key_order} disabled={false} onChange={(v) => set("key_order", v)} />
                </Field>
              )}
              {f.kind === "set" && (
                <Field label="Correct entries" help={`The complete set. ${f.partial_credit ? "Each correct entry earns its share." : "All-or-nothing: the participant must list exactly these."}`}>
                  <StringListEditor items={f.key_members} onChange={(v) => set("key_members", v)} placeholder={() => "an entry"} addLabel="Add another" numbered={false} mono max={200} />
                </Field>
              )}
            </Section>
          )}

          {f.grading === "validator" && (
            <Section title="Validator" description="Python, run once per distinct entry in the judge sandbox when the section closes. Raising marks that one entry as an error and moves on.">
              <div className="overflow-hidden rounded-box border border-line"><CodeEditor value={f.validator_py} language="python" onChange={(v) => set("validator_py", v)} height="280px" /></div>
              <div className="mt-2 rounded-box bg-page px-3 py-2 font-mono text-[11.5px] text-muted">def check(entry) → bool · entry.rest() entry.int(lo, hi) entry.word() entry.line() entry.ints(n) entry.eof()</div>
              <FormGrid cols={2} className="mt-4">
                <Field label="Points per valid entry" help="Distinct valid entries × this, capped by Maximum entries.">
                  <Input type="number" min={1} step={1} value={f.points_per_entry} onChange={(e) => set("points_per_entry", Number(e.target.value))} />
                </Field>
                <Field label="Maximum entries" help="So the maximum score is this × points per entry.">
                  <Input type="number" min={1} max={1000} step={1} value={f.max_entries} onChange={(e) => set("max_entries", Number(e.target.value))} />
                </Field>
              </FormGrid>
            </Section>
          )}

          {f.grading === "manual" && (
            <Section title="Model answer" description="What full marks looks like. Shown to evaluators beside every answer; never to participants.">
              <MarkdownEditor value={f.model_answer} onChange={(v) => set("model_answer", v)} rows={8} placeholder="The answer is 13, because each term is the sum of the previous two." />
            </Section>
          )}
          <StepIssues issues={issuesFor("grading", 2)} />
        </>
      )}

      {key === "preview" && (
        <>
          {allIssues.length > 0 && <Alert tone="error" title={existing ? "Cannot save yet" : "Not ready to create"}><ul className="ml-4 list-disc space-y-0.5">{allIssues.map((i) => <li key={i}>{i}</li>)}</ul></Alert>}
          <Section title="As a participant sees it" description="Live: the controls work, nothing is saved. What they never see: the key, the validator, the model answer." padded={false}>
            <div className="bg-page p-4"><PreviewCard view={view} /></div>
          </Section>
          <Section title="Summary">
            <Summary cols={4}>
              <SummaryItem label="Kind">{KIND_LABEL[f.kind]}</SummaryItem>
              <SummaryItem label="Category">{CATEGORY_LABEL[f.category]}</SummaryItem>
              <SummaryItem label="Graded by">{GRADING_LABEL[f.grading]}</SummaryItem>
              <SummaryItem label="Points">{f.points}{f.explain_points ? ` + ${f.explain_points} reasoning` : ""}</SummaryItem>
              {f.grading === "auto" && <SummaryItem label="Answer key" span>{describeKey(f)}</SummaryItem>}
              {f.grading === "validator" && <SummaryItem label="Scoring" span>{f.points_per_entry} per valid entry, up to {f.max_entries} entries ({f.points_per_entry * f.max_entries} max)</SummaryItem>}
              {f.grading === "manual" && <SummaryItem label="Model answer" span><span className="line-clamp-2 whitespace-pre-wrap">{f.model_answer}</span></SummaryItem>}
            </Summary>
          </Section>
          {!existing && (
            <Section title="Create" description="Recorded in the audit log with your reason.">
              {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}
              <Field label="Reason"><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Section A question set, puzzle 3" /></Field>
            </Section>
          )}
          {existing && error && <Alert tone="error">{error}</Alert>}
        </>
      )}

      {key === "verify" && existing && <Verify puzzle={existing} view={toView(fromPuzzle(existing), existing.id)} dirty={dirty} onChanged={onSaved} />}
    </WizardLayout>
  );
}

function describeKey(f: Form): string {
  switch (f.kind) {
    case "mcq_single": return f.key_option === null ? "—" : `Option ${f.key_option + 1}: ${clean(f.options)[f.key_option] ?? ""}`;
    case "mcq_multi": return f.key_options.map((i) => `${i + 1}`).join(", ") || "—";
    case "fill_blank": return clean(f.key_accepted).join(" · ") || "—";
    case "numeric": return `${f.key_value} ± ${f.tolerance || 0}`;
    case "sequence": return f.key_order.map((i) => clean(f.items)[i]).join(" → ");
    case "set": return clean(f.key_members).join(", ") || "—";
    default: return "—";
  }
}

function StepIssues({ issues }: { issues: string[] }) {
  if (issues.length === 0) return null;
  return <Alert tone="warning" title="Before this step is complete"><ul className="ml-4 list-disc space-y-0.5">{issues.map((i) => <li key={i}>{i}</li>)}</ul></Alert>;
}

function PreviewCard({ view }: { view: PuzzleView }) {
  const [answer, setAnswer] = useState<unknown>(() => defaultAnswer(view));
  const [explanation, setExplanation] = useState("");
  const [formatError, setFormatError] = useState<string | null>(null);
  useEffect(() => { setAnswer(defaultAnswer(view)); }, [view.kind, view.config.items?.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <PuzzleCard q={view} index={Math.max(0, 0)} total={1} answer={answer} explanation={explanation} status="idle" locked={false} formatError={formatError} preview
      onAnswer={(v, ok) => { setAnswer(v); setFormatError(ok ? null : `Expected: ${view.format_hint ?? "a different format"}`); }} onExplanation={setExplanation} />
  );
}

// ---------------------------------------------------------------------------

function Verify({ puzzle, view, dirty, onChanged }: { puzzle: Puzzle; view: PuzzleView; dirty: boolean; onChanged?: () => Promise<void> }) {
  const router = useRouter();
  const { toast } = useToast();
  const [answer, setAnswer] = useState<unknown>(() => defaultAnswer(view));
  const [shouldPass, setShouldPass] = useState("");
  const [shouldFail, setShouldFail] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ready: boolean; detail: string; score?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const state = stateOf(puzzle);
  const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

  async function test() {
    setBusy(true); setError(null); setResult(null);
    try {
      const body = puzzle.grading === "validator" ? { should_pass: lines(shouldPass), should_fail: lines(shouldFail) } : puzzle.grading === "auto" ? { answer } : {};
      setResult(await api.post<{ ready: boolean; detail: string; score?: number }>(`/api/admin/phase1/puzzles/${puzzle.id}/test`, body));
      await onChanged?.();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <>
      {dirty && <Alert tone="warning" title="Unsaved changes">The self-test runs against the saved version. Save first (the footer) so the test proves what participants will get.</Alert>}
      <Section title="Where it stands">
        <Checklist items={[
          { ok: true, label: "Saved", detail: `Puzzle #${puzzle.id}` },
          { ok: puzzle.ready, label: puzzle.ready ? "Self-test passed" : "Self-test not passed", detail: puzzle.ready ? "the question is proven to work" : "run it below; every save resets this" },
          { ok: puzzle.published, label: puzzle.published ? "Published" : "Not published", detail: puzzle.published ? "participants see it when Section A is open" : puzzle.ready ? "publish below" : "needs the self-test first" },
          ...(puzzle.voided ? [{ ok: false, label: "Voided", detail: "scores for nobody" }] : []),
        ]} />
      </Section>

      <Section
        title="Self-test"
        description={puzzle.grading === "auto" ? "Answer it as a participant would. The intended answer must score full marks — anything less usually means a slip in the key."
          : puzzle.grading === "validator" ? "Give entries that must be accepted and entries that must be rejected. The validator runs in the judge sandbox on each."
          : "Manual grading has nothing to compute; the check confirms a model answer is recorded."}
        footer={<Button onClick={test} loading={busy} icon={<Icon.Play size={14} />}>{puzzle.grading === "manual" ? "Check readiness" : "Run self-test"}</Button>}
      >
        {puzzle.grading === "auto" && (
          <div className="rounded-box border border-line bg-page p-4">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">The intended answer</div>
            <AnswerInput q={view} value={answer} disabled={false} onChange={(v) => setAnswer(v)} />
          </div>
        )}
        {puzzle.grading === "validator" && (
          <FormGrid cols={2}>
            <Field label="Should be accepted" hint="one per line" help="At least one.">
              <Textarea rows={5} className="font-mono text-[12px]" value={shouldPass} onChange={(e) => setShouldPass(e.target.value)} placeholder={"1234\n9876"} />
            </Field>
            <Field label="Should be rejected" hint="one per line">
              <Textarea rows={5} className="font-mono text-[12px]" value={shouldFail} onChange={(e) => setShouldFail(e.target.value)} placeholder={"1123\nabcd"} />
            </Field>
          </FormGrid>
        )}
        {puzzle.grading === "manual" && (
          <div className="rounded-box border border-line bg-page p-4 text-[13px]">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Model answer on record</div>
            {puzzle.modelAnswer?.trim() ? <p className="whitespace-pre-wrap">{puzzle.modelAnswer}</p> : <p className="text-red">None — add one under Grading.</p>}
          </div>
        )}
        {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}
        {result && (
          <div className="mt-4">
            <Alert tone={result.ready ? "success" : "warning"} title={result.ready ? "Ready to publish" : "Not ready"}>
              {result.detail}{result.score !== undefined && <span className="ml-1 text-muted">({result.score} / {puzzle.points})</span>}
            </Alert>
          </div>
        )}
      </Section>

      <Section title="Publish" description={puzzle.published ? "Live. Unpublishing hides it; answers already saved are kept." : "Once published, participants see it as soon as Section A opens."}>
        <div className="flex flex-wrap items-center gap-2">
          {puzzle.published
            ? <ReasonAction label="Unpublish" title="Unpublish this puzzle?" description="It disappears from Section A. Saved answers are kept." onConfirm={async (reason) => { await api.post(`/api/admin/phase1/puzzles/${puzzle.id}/unpublish`, { reason }); toast({ title: "Unpublished", tone: "success" }); await onChanged?.(); }} />
            : <ReasonAction label="Publish" variant="primary" size="md" disabled={!puzzle.ready || puzzle.voided} title="Publish this puzzle?" description="Participants see it when Section A is open. It has passed its self-test." onConfirm={async (reason) => { await api.post(`/api/admin/phase1/puzzles/${puzzle.id}/publish`, { reason }); toast({ title: "Published", tone: "success" }); await onChanged?.(); }} />}
          {!puzzle.ready && !puzzle.published && <span className="text-[12px] text-muted">Publishing unlocks when the self-test passes.</span>}
          <span className="flex-1" />
          {!puzzle.voided && <ReasonAction label="Void" variant="danger" title="Void this puzzle?" description="It scores for nobody and every total is recomputed. This cannot be undone." onConfirm={async (reason) => { await api.post(`/api/admin/phase1/puzzles/${puzzle.id}/void`, { reason }); toast({ title: "Voided", tone: "success" }); await onChanged?.(); }} />}
          {!puzzle.published && <ReasonAction label="Delete" variant="danger" title="Delete this puzzle?" description="Only drafts can be deleted. This cannot be undone." onConfirm={async (reason) => { await api.del(`/api/admin/phase1/puzzles/${puzzle.id}`, { reason }); toast({ title: "Deleted", tone: "success" }); router.push("/admin/phase1"); }} />}
        </div>
        {state === "void" && <p className="mt-3 text-[12.5px] text-muted">This puzzle is void.</p>}
      </Section>
    </>
  );
}
