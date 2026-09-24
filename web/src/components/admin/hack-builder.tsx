"use client";

/**
 * Authoring one Section B question: the judge problem that holds the
 * reference and validator, the statement, the deliberately flawed solution in
 * each language it is offered in, a preview, and, once it exists, the proof
 * that a breaking input exists for every one of those copies.
 */
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "../icons";
import { HackQuestionView } from "../phase1/hack-view";
import { ActionButton } from "../action-button";
import { ReasonAction } from "../reason-action";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { StatusDot } from "../ui/badge";
import { Button } from "../ui/button";
import { Field, FormGrid } from "../ui/field";
import { Input } from "../ui/input";
import { SimpleCombobox } from "../ui/combobox";
import { Textarea } from "../ui/textarea";
import { MarkdownEditor } from "../ui/markdown-editor";
import { Section } from "../ui/page";
import { Checklist, Summary, SummaryItem } from "../ui/summary";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { useToast } from "../ui/toast";
import { WizardLayout, WizardNote, type WizardStep } from "../ui/wizard";
import { ApiClientError, api, errorMessage } from "@/lib/client";

import { stateOf, type Hack, type HackSolution } from "./phase1-types";

const CodeEditor = dynamic(() => import("../editor").then((m) => m.CodeEditor), { ssr: false, loading: () => <div className="h-80 bg-[#1e1e1e]" /> });

type JudgeProblem = { problem_id: string; testcases: number; validated: boolean; has_reference: boolean; hack_only: boolean; time_limit_ms: number; memory_limit_mb: number; current: string | null };

/** One copy of the flawed code as edited. `id` names a saved copy, so an unchanged one keeps its proof. */
type Copy = { id?: number; language: string; source: string };
type Form = { title: string; problem_id: string; hack_points: number; fail_penalty: number; order_index: number; statement_md: string; constraints_md: string; solutions: Copy[] };
const EMPTY: Form = { title: "", problem_id: "", hack_points: 20, fail_penalty: 0, order_index: 1, statement_md: "", constraints_md: "", solutions: [{ language: "cpp", source: "" }] };

function fromHack(h: Hack): Form {
  return { title: h.title, problem_id: h.problemId, hack_points: h.hackPoints, fail_penalty: h.failPenalty, order_index: h.orderIndex, statement_md: h.statementMd, constraints_md: h.constraintsMd, solutions: h.solutions.map((x) => ({ id: x.id, language: x.language, source: x.source })) };
}

function basicsIssues(f: Form, problems: JudgeProblem[] | null): string[] {
  const out: string[] = [];
  if (!f.title.trim()) out.push("Give the question a title.");
  if (!f.problem_id) out.push("Choose the judge problem that holds the reference solution.");
  else if (problems && !problems.some((p) => p.problem_id === f.problem_id)) out.push("That judge problem no longer exists.");
  if (!Number.isInteger(f.hack_points) || f.hack_points < 0) out.push("Points must be a whole number, zero or more.");
  if (!Number.isInteger(f.fail_penalty) || f.fail_penalty < 0) out.push("Penalty must be a whole number, zero or more.");
  return out;
}
function statementIssues(f: Form): string[] {
  return f.statement_md.trim() ? [] : ["Write the problem statement. Participants need to know what the solution is supposed to do."];
}
function sourceIssues(f: Form): string[] {
  const out: string[] = [];
  if (f.solutions.length === 0) out.push("Add the flawed solution in at least one language.");
  for (const copy of f.solutions) {
    if (!copy.source.trim()) out.push(`Paste the flawed ${copy.language} solution.`);
    if (copy.source.length > 262_144) out.push(`The ${copy.language} solution is larger than 256 KB.`);
  }
  const languages = f.solutions.map((x) => x.language);
  if (new Set(languages).size !== languages.length) out.push("One solution per language.");
  return out;
}

export function HackBuilder({ existing, initialStep, onSaved }: { existing: Hack | null; initialStep?: string; onSaved?: () => Promise<void> }) {
  const router = useRouter();
  const { toast } = useToast();
  const initial = useMemo(() => (existing ? fromHack(existing) : EMPTY), [existing]);
  const [f, setF] = useState<Form>(initial);
  const [problems, setProblems] = useState<JudgeProblem[] | null>(null);
  const [languages, setLanguages] = useState<{ key: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // After a reload the saved values replace the form -- unless the author has unsaved edits, which are kept.
  const prevInitial = useRef(initial);
  useEffect(() => {
    setF((cur) => (JSON.stringify(cur) === JSON.stringify(prevInitial.current) ? initial : cur));
    prevInitial.current = initial;
  }, [initial]);
  useEffect(() => {
    void api.get<{ problems: JudgeProblem[] }>("/api/admin/problems").then((r) => setProblems(r.problems)).catch(() => setProblems([]));
    void api.get<{ languages: { key: string; name: string }[] }>("/api/languages").then((r) => setLanguages(r.languages)).catch(() => undefined);
  }, []);

  const hackProblems = (problems ?? []).filter((p) => p.hack_only);
  const chosen = problems?.find((p) => p.problem_id === f.problem_id) ?? null;
  const [reached, setReached] = useState(existing ? 4 : 0);
  const b = basicsIssues(f, problems), s = statementIssues(f), c = sourceIssues(f);
  const allIssues = [...b, ...s, ...c];
  const st = (issues: string[], visited: boolean) => (visited ? (issues.length ? "error" : "done") : "todo") as WizardStep["state"];
  const steps: WizardStep[] = [
    { key: "basics", label: "Basics", hint: "Judge problem, points", state: st(b, reached > 0) },
    { key: "statement", label: "Statement", hint: "What the code should do", state: st(s, reached > 1) },
    { key: "source", label: "Given solutions", hint: "The code to break, per language", state: st(c, reached > 2) },
    { key: "preview", label: existing ? "Preview" : "Preview & create", hint: "As a participant sees it", state: "todo" },
    ...(existing ? [{ key: "verify", label: "Verify & publish", hint: existing.published ? "Live" : existing.ready ? "Ready to publish" : "Prove every copy breaks", state: (existing.published ? "done" : "todo") as WizardStep["state"] }] : []),
  ];
  const startAt = Math.max(0, steps.findIndex((x) => x.key === initialStep));
  const [step, setStep] = useState(startAt);
  const key = steps[Math.min(step, steps.length - 1)].key;
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  function go(i: number) { setStep(i); setReached((r) => Math.max(r, i)); setError(null); }

  async function save() {
    setBusy(true); setError(null);
    try {
      const payload = { ...f, title: f.title.trim(), reason: `${existing ? "Edited" : "Created"} the hacking question “${f.title.trim()}”.` };
      if (existing) {
        await api.patch(`/api/admin/phase1/hacking/${existing.id}`, payload);
        toast({ title: "Saved", description: "A copy whose code changed needs its breaking input proven again.", tone: "success" });
        await onSaved?.();
      } else {
        const r = await api.post<{ id: number }>("/api/admin/phase1/hacking", payload);
        toast({ title: "Hacking question created", description: "Next: prove a breaking input, then publish.", tone: "success" });
        router.push(`/admin/phase1/hacking/${r.id}?step=verify`);
      }
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }

  const view = { id: existing?.id ?? 0, title: f.title, statement_md: f.statement_md, constraints_md: f.constraints_md, solutions: f.solutions.map((x, i) => ({ id: x.id ?? -(i + 1), language: x.language, source: x.source })), hack_points: f.hack_points, fail_penalty: f.fail_penalty };
  const [previewSolution, setPreviewSolution] = useState<number | undefined>(undefined);
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
            <div className="mb-2">{state === "live" ? <StatusDot tone="success">Live</StatusDot> : state === "ready" ? <StatusDot tone="info">Ready to publish</StatusDot> : state === "void" ? <StatusDot tone="neutral">Void</StatusDot> : <StatusDot tone="warning">Draft</StatusDot>}</div>
            {dirty ? "You have unsaved changes. A copy whose code changes loses its proof." : existing.published ? "Participants see this when Section B is open; every save reaches them at once." : existing.ready ? "Every copy is proven. Publish it under Verify & publish." : "Prove a breaking input for every copy under Verify & publish before it can go live."}
          </WizardNote>
        ) : (
          <WizardNote title="How Section B works">Participants read the flawed code, in whichever language you offer that they know best, and submit an input that breaks it. The judge validates the input, runs that copy and the reference, and compares. The reference never leaves the judge.</WizardNote>
        )
      }
      footer={
        <>
          <Button variant="outline" disabled={step === 0 || busy} onClick={() => go(step - 1)}><Icon.ChevronLeft size={14} /> Back</Button>
          <span className="text-[12px] text-muted-foreground">Step {step + 1} of {steps.length}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {existing && dirty && (
              <>
                <Button variant="ghost" onClick={() => setF(initial)} disabled={busy}>Discard</Button>
                <Button onClick={save} loading={busy} disabled={allIssues.length > 0}><Icon.Check size={14} /> Save changes</Button>
              </>
            )}
            {!existing && <Link href="/admin/phase1?tab=hacking"><Button variant="ghost" disabled={busy}>Cancel</Button></Link>}
            {key === "preview" && !existing
              ? <Button onClick={save} loading={busy} disabled={allIssues.length > 0}><Icon.Plus size={14} /> Create question</Button>
              : step < steps.length - 1 && <Button onClick={() => go(step + 1)} disabled={busy}>Continue <Icon.ChevronRight size={14} /></Button>}
          </div>
        </>
      }
    >
      {key === "basics" && (
        <>
          <Section title="The judge problem" description="A hacking package on the judge: limits, validator.py and the stored reference solution. Upload it under Problems with hack_only set in problem.json.">
            {problems && hackProblems.length === 0 && (
              <Alert variant="warning"><AlertTitle>No hacking packages on the judge</AlertTitle><AlertDescription>
                Create one first: <Link href="/admin/problems/new" className="font-semibold text-brand-deep hover:underline">New problem</Link> with <code className="rounded bg-muted px-1 text-[11.5px]">&quot;hack_only&quot;: true</code> and a <code className="rounded bg-muted px-1 text-[11.5px]">reference</code> in problem.json.
              </AlertDescription></Alert>
            )}
            <div className="mt-3 space-y-4">
              <Field label="Judge problem">
                <SimpleCombobox
                  className="max-w-sm font-mono"
                  size="default"
                  value={f.problem_id}
                  onValueChange={(v) => set("problem_id", v)}
                  placeholder="Choose…"
                  options={[
                    ...hackProblems.map((p) => ({ value: p.problem_id, label: p.problem_id })),
                    ...(f.problem_id && !hackProblems.some((p) => p.problem_id === f.problem_id)
                      ? [{ value: f.problem_id, label: `${f.problem_id} (not a hacking package)` }]
                      : []),
                  ]}
                />
              </Field>
              {chosen && (
                <Checklist items={[
                  { ok: chosen.has_reference, label: chosen.has_reference ? "Reference solution stored" : "No reference solution", detail: chosen.has_reference ? "the judge decides who is right" : "the package needs \"reference\" in problem.json" },
                  { ok: Boolean(chosen.current), label: chosen.current ? `Published (${chosen.current})` : "Not published", detail: chosen.current ? undefined : "publish the package under Problems before Section B opens" },
                  { ok: chosen.validated, label: chosen.validated ? "Validated" : "Not validated", detail: chosen.validated ? undefined : "worth running Validate under Problems" },
                  { ok: true, label: `${chosen.time_limit_ms} ms · ${chosen.memory_limit_mb} MB`, detail: "applies to both the given code and the reference" },
                ]} />
              )}
            </div>
          </Section>
          <Section title="Title and points">
            <div className="space-y-5">
              <Field label="Title"><Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Fast Prime Check" maxLength={200} autoFocus /></Field>
              <FormGrid cols={3}>
                <Field label="Points" help="For the first successful hack on this solution."><Input type="number" min={0} step={1} value={f.hack_points} onChange={(e) => set("hack_points", Number(e.target.value))} /></Field>
                <Field label="Penalty per failed attempt" help="Deducted for a valid input that does not break it. 0 by default."><Input type="number" min={0} step={1} value={f.fail_penalty} onChange={(e) => set("fail_penalty", Number(e.target.value))} /></Field>
                <Field label="Order" help="Position in the section."><Input type="number" min={0} step={1} value={f.order_index} onChange={(e) => set("order_index", Number(e.target.value))} /></Field>
              </FormGrid>
            </div>
          </Section>
          <StepIssues issues={reached > 0 ? b : []} />
        </>
      )}

      {key === "statement" && (
        <>
          <Section title="Statement" description="What a correct solution must do. Participants need this to know what “wrong” means.">
            <MarkdownEditor value={f.statement_md} onChange={(v) => set("statement_md", v)} rows={12} placeholder={"Given `n`, print `YES` if `n` is prime, otherwise `NO`.\n\n### Input\nA single integer `n`."} />
          </Section>
          <Section title="Constraints" description="Shown beside the statement. A submitted input outside these is rejected by the validator and counts as invalid, not as a failed hack.">
            <MarkdownEditor value={f.constraints_md} onChange={(v) => set("constraints_md", v)} rows={5} placeholder={"- 1 ≤ n ≤ 10^12"} />
          </Section>
          <StepIssues issues={reached > 1 ? s : []} />
        </>
      )}

      {key === "source" && (
        <>
          <Section title="The given solutions" description="The same flawed program in every language you want to offer. Each copy is shown read-only; participants pick the language they read best. Every copy must compile, run, and be wrong on at least one valid input, which you prove per copy in the last step.">
            <SolutionsEditor copies={f.solutions} languages={languages} onChange={(v) => set("solutions", v)} />
          </Section>
          <StepIssues issues={reached > 2 ? c : []} />
        </>
      )}

      {key === "preview" && (
        <>
          {allIssues.length > 0 && <Alert variant="destructive"><AlertTitle>{existing ? "Cannot save yet" : "Not ready to create"}</AlertTitle><AlertDescription><ul className="ml-4 list-disc space-y-0.5">{allIssues.map((i) => <li key={i}>{i}</li>)}</ul></AlertDescription></Alert>}
          <Section title="As a participant sees it" description="Statement, constraints and the code to read. Below it they get a box for their input." padded={false}>
            <div className="bg-muted p-4"><HackQuestionView q={view} index={0} total={1} solutionId={previewSolution} onSelectSolution={setPreviewSolution} /></div>
          </Section>
          <Section title="Summary">
            <Summary cols={4}>
              <SummaryItem label="Judge problem" mono>{f.problem_id || "—"}</SummaryItem>
              <SummaryItem label="Languages">{f.solutions.map((x) => x.language).join(", ")}</SummaryItem>
              <SummaryItem label="Points">{f.hack_points}{f.fail_penalty ? ` · −${f.fail_penalty} per miss` : ""}</SummaryItem>
              <SummaryItem label="Source">{f.solutions.map((x) => `${x.source.split("\n").length} lines`).join(" · ")}</SummaryItem>
            </Summary>
          </Section>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        </>
      )}

      {key === "verify" && existing && <Verify hack={existing} dirty={dirty} onChanged={onSaved} />}
    </WizardLayout>
  );
}

/** The flawed code, one tab per language. Adding a language starts from an empty copy. */
function SolutionsEditor({ copies, languages, onChange }: { copies: Copy[]; languages: { key: string; name: string }[]; onChange: (copies: Copy[]) => void }) {
  const [open, setOpen] = useState(0);
  const current = copies[Math.min(open, copies.length - 1)];
  const taken = new Set(copies.map((x) => x.language));
  const spare = languages.filter((l) => !taken.has(l.key));
  const options = languages.length === 0 ? copies.map((x) => ({ value: x.language, label: x.language })) : languages.map((l) => ({ value: l.key, label: l.name }));
  const update = (i: number, patch: Partial<Copy>) => onChange(copies.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const name = (key: string) => languages.find((l) => l.key === key)?.name ?? key;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {copies.length > 0 && (
          <Tabs value={String(Math.min(open, copies.length - 1))} onValueChange={(v) => setOpen(Number(v))}>
            <TabsList>{copies.map((x, i) => <TabsTrigger key={x.id ?? `new-${i}`} value={String(i)}>{name(x.language)}</TabsTrigger>)}</TabsList>
          </Tabs>
        )}
        <Button variant="outline" size="sm" disabled={spare.length === 0} onClick={() => { onChange([...copies, { language: spare[0].key, source: "" }]); setOpen(copies.length); }}>
          <Icon.Plus size={14} /> Add a language
        </Button>
        {copies.length > 1 && current && (
          <Button variant="ghost" size="sm" className="text-red" onClick={() => { onChange(copies.filter((x) => x !== current)); setOpen((o) => Math.max(0, o - 1)); }}>
            <Icon.Trash size={14} /> Remove {name(current.language)}
          </Button>
        )}
      </div>
      {current && (
        <>
          <div className="max-w-xs">
            <Field label="Language">
              <SimpleCombobox
                className="w-full"
                size="default"
                value={current.language}
                onValueChange={(v) => update(copies.indexOf(current), { language: v })}
                options={options.filter((o) => o.value === current.language || !taken.has(o.value))}
              />
            </Field>
          </div>
          <div className="overflow-hidden rounded-box border border-line">
            <CodeEditor key={current.id ?? `new-${copies.indexOf(current)}`} value={current.source} language={current.language} onChange={(v) => update(copies.indexOf(current), { source: v })} height="420px" />
          </div>
        </>
      )}
    </div>
  );
}

function StepIssues({ issues }: { issues: string[] }) {
  if (issues.length === 0) return null;
  return <Alert variant="warning"><AlertTitle>Before this step is complete</AlertTitle><AlertDescription><ul className="ml-4 list-disc space-y-0.5">{issues.map((i) => <li key={i}>{i}</li>)}</ul></AlertDescription></Alert>;
}

type Proof = { ready: boolean; proven: boolean; detail: string; result: { valid_input: boolean; invalid_reason: string; hacked: boolean | null; verdict: string | null; message: string } };

/** One copy's proof: an input that obeys the constraints and on which this copy is wrong. */
function ProveCopy({ hack, copy, onChanged }: { hack: Hack; copy: HackSolution; onChanged?: () => Promise<void> }) {
  // The input that proved it is kept with the copy, so the proof can be
  // repeated after an edit, after an import, or on a different machine;
  // nobody should have to remember it.
  const [input, setInput] = useState(copy.breakingInput ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Proof | null>(null);
  const [needsPublish, setNeedsPublish] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function test() {
    setBusy(true); setError(null); setResult(null); setNeedsPublish(false);
    try { setResult(await api.post(`/api/admin/phase1/hacking/${hack.id}/test`, { solution_id: copy.id, breaking_input: input })); await onChanged?.(); }
    catch (err) {
      setError(errorMessage(err));
      // The one failure with a fix somewhere else entirely.
      setNeedsPublish(err instanceof ApiClientError && err.code === "package_not_published");
    } finally { setBusy(false); }
  }

  return (
    <Section
      title={<span className="flex items-center gap-2">Prove the {copy.language} copy breaks {copy.proven ? <StatusDot tone="success">Proven</StatusDot> : <StatusDot tone="warning">Not proven</StatusDot>}</span>}
      description="An input that obeys the constraints and on which this copy is wrong. The judge validates it, runs this copy and the reference, and compares, exactly what happens to a participant's attempt."
      footer={<Button onClick={test} loading={busy} disabled={!input.trim()}><Icon.Bug size={14} /> Run the hack</Button>}
    >
      <Field label="Breaking input" help="Never shown to participants.">
        <Textarea rows={5} className="font-mono text-[12px]" value={input} onChange={(e) => setInput(e.target.value)} placeholder={"e.g.\n1000000007"} />
      </Field>
      {error && (
        <div className="mt-4">
          <Alert variant={needsPublish ? "warning" : "destructive"}>
            <Icon.Alert />
            {needsPublish && <AlertTitle>The judge cannot see this package yet</AlertTitle>}
            <AlertDescription>
              <p>{error}</p>
              {needsPublish && (
                <Button size="sm" variant="outline" className="mt-2" asChild>
                  <Link href={`/admin/problems/${encodeURIComponent(hack.problemId)}`}>
                    <Icon.External size={14} /> Open {hack.problemId}
                  </Link>
                </Button>
              )}
            </AlertDescription>
          </Alert>
        </div>
      )}
      {result && (
        <div className="mt-4">
          <Alert variant={result.proven ? "success" : "warning"}><AlertTitle>{result.proven ? (result.ready ? "It breaks; every copy is proven, ready to publish" : "It breaks; prove the other copies too") : "Not proven"}</AlertTitle><AlertDescription>
            <p>{result.detail}</p>
            <Summary cols={3} className="mt-3">
              <SummaryItem label="Input valid">{result.result.valid_input ? "yes" : `no: ${result.result.invalid_reason}`}</SummaryItem>
              <SummaryItem label="This copy">{result.result.verdict ?? "-"}</SummaryItem>
              <SummaryItem label="Hacked">{result.result.hacked === null ? "-" : result.result.hacked ? "yes" : "no"}</SummaryItem>
            </Summary>
          </AlertDescription></Alert>
        </div>
      )}
    </Section>
  );
}

function Verify({ hack, dirty, onChanged }: { hack: Hack; dirty: boolean; onChanged?: () => Promise<void> }) {
  const { toast } = useToast();
  const router = useRouter();
  const proven = hack.solutions.filter((x) => x.proven).length;

  return (
    <>
      {dirty && <Alert variant="warning"><AlertTitle>Unsaved changes</AlertTitle><AlertDescription>The proofs run against the saved version. Save first (the footer).</AlertDescription></Alert>}
      <Section title="Where it stands">
        <Checklist items={[
          { ok: true, label: "Saved", detail: `Question #${hack.id} · judge problem ${hack.problemId}` },
          { ok: hack.ready, label: hack.ready ? "Every copy proven to break" : `${proven} of ${hack.solutions.length} copies proven`, detail: hack.ready ? (hack.verifiedElsewhere ? "proven on the install this was imported from; the inputs below are the ones that broke them" : "each copy fails on its input where the reference does not") : "prove each copy below; a copy whose code changes needs proving again" },
          { ok: hack.published, label: hack.published ? "Published" : "Not published", detail: hack.published ? "participants see it when Section B is open" : hack.ready ? "publish below" : "needs every proof first" },
          ...(hack.voided ? [{ ok: false, label: "Voided", detail: "scores for nobody" }] : []),
        ]} />
      </Section>
      {hack.solutions.map((copy) => <ProveCopy key={copy.id} hack={hack} copy={copy} onChanged={onChanged} />)}
      <Section title="Publish" description={hack.published ? "Live. Unpublishing hides it; attempts already judged are kept." : "Once published, participants see it as soon as Section B opens."}>
        <div className="flex flex-wrap items-center gap-2">
          {hack.published
            ? <ActionButton label="Unpublish" confirm={{ title: "Unpublish this question?", body: "It disappears from Section B. Judged attempts are kept." }} onAct={async () => { await api.post(`/api/admin/phase1/hacking/${hack.id}/unpublish`, { reason: `Unpublished “${hack.title}”.` }); toast({ title: "Unpublished", tone: "success" }); await onChanged?.(); }} />
            : <ActionButton label="Publish" variant="default" size="default" disabled={!hack.ready || hack.voided} onAct={async () => { await api.post(`/api/admin/phase1/hacking/${hack.id}/publish`, { reason: `Published “${hack.title}” to Section B.` }); toast({ title: "Published", description: "Participants see it when Section B is open.", tone: "success" }); await onChanged?.(); }} />}
          {!hack.ready && !hack.published && <span className="text-[12px] text-muted-foreground">Publishing unlocks once every copy has a proven breaking input.</span>}
          <span className="flex-1" />
          {!hack.voided && <ReasonAction label="Void" variant="destructive" title="Void this question?" description="It scores for nobody and every total is recomputed. This cannot be undone." onConfirm={async (reason) => { await api.post(`/api/admin/phase1/hacking/${hack.id}/void`, { reason }); toast({ title: "Voided", tone: "success" }); await onChanged?.(); }} />}
          <ActionButton label="Delete" variant="destructive" confirm={{ title: "Delete this question?", body: "Removes it completely. It only works while nobody has attempted it; once someone has, void it instead. This cannot be undone.", label: "Delete" }} onAct={async () => { await api.del(`/api/admin/phase1/hacking/${hack.id}`, { reason: `Deleted “${hack.title}”.` }); toast({ title: "Deleted", tone: "success" }); router.push("/admin/phase1"); }} />
        </div>
      </Section>
    </>
  );
}
