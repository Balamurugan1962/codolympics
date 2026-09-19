"use client";

/**
 * One problem, as a pipeline: package uploaded → validated → described →
 * published. The strip at the top says which stage it is at; the tabs below
 * hold the work for each. Publishing mid-contest rejudges, and says so.
 */
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ProblemPreview } from "@/components/admin/problem-preview";
import { ValidationNote } from "@/components/admin/validate-all";
import { HintsEditor, QuestionBasicsFields, detailsIssues, EMPTY_DETAILS, hintIssues, type QuestionDetails } from "@/components/admin/question-details-form";
import { Icon } from "@/components/icons";
import { ReasonAction } from "@/components/reason-action";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileDrop } from "@/components/ui/file-drop";
import { FormGrid } from "@/components/ui/field";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageBody, PageHeader, Section } from "@/components/ui/page";
import { DetailSkeleton } from "@/components/ui/skeleton";
import { Checklist, Summary, SummaryItem } from "@/components/ui/summary";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

import type { P, Q } from "../page";

type Report = { ok: boolean; issues: string[]; reference: { verdict: string; first_fail: number | null; passed: number; max_time_ms: number } | null; wrong_solution: { verdict: string } | null; checker: { compiled: boolean; output: string } | null };
type Tab = "package" | "details" | "preview";

export default function ProblemPage() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const [problem, setProblem] = useState<P | null | undefined>(undefined);
  const [question, setQuestion] = useState<Q | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>((search.get("tab") as Tab) || "package");

  const load = useCallback(async () => {
    const [p, q] = await Promise.all([api.get<{ problems: P[] }>("/api/admin/problems"), api.get<{ questions: Q[] }>("/api/admin/questions")]);
    setProblem(p.problems.find((x) => x.problem_id === id) ?? null);
    setQuestion(q.questions.find((x) => x.id === id) ?? null);
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  function goTab(t: Tab) { setTab(t); router.replace(`/admin/problems/${encodeURIComponent(id)}?tab=${t}`, { scroll: false }); }

  if (problem === undefined || question === undefined) return <PageBody width="wide"><DetailSkeleton tabs={3} /></PageBody>;
  const hackOnly = Boolean(problem?.hack_only);
  // A passing validation counts wherever it ran; where it ran is said out loud
  // rather than being the difference between "Validated" and "Not validated".
  const validated = Boolean(problem?.validated || question?.validated || problem?.last_validation?.ok);
  const elsewhere = Boolean(problem?.last_validation?.imported) && !problem?.validated && !question?.validated;
  const stages = [
    { key: "package", label: "Package", done: Boolean(problem), detail: problem ? `${problem.versions.length} version${problem.versions.length === 1 ? "" : "s"} · latest ${problem.versions.at(-1)}` : "no package on the judge" },
    { key: "validate", label: "Validated", done: validated, detail: validated ? (elsewhere ? "the reference passed where this was exported" : "the reference passes every test") : "not yet proven" },
    ...(hackOnly ? [] : [{ key: "details", label: "Details", done: Boolean(question), detail: question ? `${question.hints.length} hint${question.hints.length === 1 ? "" : "s"} · ${question.sampleCount} sample${question.sampleCount === 1 ? "" : "s"}` : "nothing for participants yet" }]),
    { key: "publish", label: "Published", done: Boolean(problem?.current), detail: problem?.current ? `${problem.current} is live` : "no live version" },
  ];
  const currentStage = stages.findIndex((s) => !s.done);

  return (
    <PageBody width="wide">
      <PageHeader
        breadcrumb={<Link href="/admin/problems" className="inline-flex items-center gap-1 hover:text-ink"><Icon.ChevronLeft size={14} /> Problems</Link>}
        title={<span className="flex flex-wrap items-center gap-2">{question?.title ?? id}{hackOnly && <Badge variant="info">Hacking</Badge>}{question?.status === "void" && <Badge variant="destructive">Void</Badge>}{question?.status === "sold" && <Badge variant="neutral">Sold</Badge>}</span>}
        description={<span className="font-mono text-[12px]">{id}</span>}
        actions={
          <div className="flex items-center gap-3">
            {problem && (validated ? <StatusDot tone="success">Validated</StatusDot> : <StatusDot tone="warning">Not validated</StatusDot>)}
            {problem?.current ? <StatusDot tone="success">Live {problem.current}</StatusDot> : <StatusDot tone="neutral">Not published</StatusDot>}
          </div>
        }
      />

      <ol className="mb-5 grid gap-px overflow-hidden rounded-box border border-line bg-line sm:grid-cols-2 lg:grid-cols-4" aria-label="Stages">
        {stages.map((s, i) => {
          const now = i === currentStage;
          const target: Tab = s.key === "details" ? "details" : "package";
          return (
            <li key={s.key}>
              <button type="button" onClick={() => goTab(target)} className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted ${now ? "bg-brand-tint/60" : "bg-card"}`}>
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${s.done ? "bg-brand text-white" : now ? "bg-navy text-white" : "border border-line-2 text-faint"}`}>
                  {s.done ? <Icon.Check size={11} strokeWidth={3} /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold">{s.label}</span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">{s.detail}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <Tabs value={tab} onValueChange={(v) => goTab(v as Tab)}>
        <TabsList variant="line" className="mb-5 w-full justify-start border-b">
          <TabsTrigger value="package">Package</TabsTrigger>
          {!hackOnly && <TabsTrigger value="details">Details &amp; hints</TabsTrigger>}
          {!hackOnly && <TabsTrigger value="preview">Preview</TabsTrigger>}
        </TabsList>
      </Tabs>

      {tab === "package" && (problem
        ? <Package id={id} problem={problem} question={question} onChange={load} />
        : <NoPackage id={id} onChange={load} />)}
      {tab === "details" && <Details id={id} question={question} testcases={problem?.testcases ?? null} onChange={load} />}
      {tab === "preview" && <Preview id={id} problem={problem} question={question} />}
    </PageBody>
  );
}

// ---------------------------------------------------------------------------

function NoPackage({ id, onChange }: { id: string; onChange: () => void }) {
  return (
    <Section title="No package on the judge" description="Details exist for this id but the judge has nothing to run. Upload the package to continue.">
      <UploadVersion id={id} onChange={onChange} />
    </Section>
  );
}

function UploadVersion({ id, onChange, next }: { id: string; onChange: () => void; next?: string }) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function upload() {
    if (!file) return;
    setBusy(true);
    const form = new FormData(); form.set("id", id); form.set("reason", note.trim() || `Uploaded ${file.name}.`); form.set("package", file);
    try {
      const r = await api.post<{ version: string }>("/api/admin/problems", form);
      toast({ title: `Uploaded as ${r.version}`, description: "Validate it, then publish.", tone: "success" });
      setFile(null); setNote(""); onChange();
    } catch (err) { toast({ title: "Upload failed", description: errorMessage(err), tone: "error" }); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-4">
      <FileDrop file={file} onFile={setFile} label={next ? `Drop a zip to add ${next}` : "Drop the package zip here, or browse"} hint="problem.json and tests/ at the root" />
      {file && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="What changed" className="flex-1" hint="optional" help="Goes into the audit log. Left blank, the log records the file name.">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. fixed testcase 7's answer" />
          </Field>
          <Button onClick={upload} loading={busy}><Icon.Upload size={14} /> Upload</Button>
        </div>
      )}
    </div>
  );
}

function Package({ id, problem, question, onChange }: { id: string; problem: P; question: Q | null; onChange: () => void }) {
  const { toast } = useToast();
  const [version, setVersion] = useState(problem.versions.at(-1) ?? "");
  const [report, setReport] = useState<Report | null>(null);
  const [reference, setReference] = useState(""); const [wrong, setWrong] = useState(""); const [lang, setLang] = useState("cpp");
  const [languages, setLanguages] = useState<{ key: string; name: string }[]>([]);
  const [blast, setBlast] = useState(0);
  const [busy, setBusy] = useState(false);
  const nextVersion = `v${Number(problem.versions.at(-1)?.slice(1) ?? 0) + 1}`;
  useEffect(() => {
    void api.post<{ submissions: number }>(`/api/admin/problems/${id}/blast-radius`, {}).then((r) => setBlast(r.submissions)).catch(() => setBlast(0));
    void api.get<{ languages: { key: string; name: string }[] }>("/api/languages").then((r) => setLanguages(r.languages)).catch(() => undefined);
  }, [id]);
  useEffect(() => { setVersion((v) => (problem.versions.includes(v) ? v : problem.versions.at(-1) ?? "")); }, [problem.versions]);

  async function validate() {
    setBusy(true);
    try {
      setReport(await api.post<Report>(`/api/admin/problems/${id}/validate`, { version, reference_source: reference || undefined, wrong_source: wrong || undefined, language: reference || wrong ? lang : undefined }));
      onChange();
    } catch (err) { toast({ title: "Validation could not run", description: errorMessage(err), tone: "error" }); } finally { setBusy(false); }
  }

  const validated = problem.validated || question?.validated || problem.last_validation?.ok;
  const stale = problem.current && version !== problem.current;

  return (
    <div className="space-y-4">
      <Section title="Versions" description="Each upload is a complete package. Only the live one is judged; the others wait." padded={false}>
        <Table>
          <TableHeader><TableRow><TableHead>Version</TableHead><TableHead>Status</TableHead><TableHead className="hidden sm:table-cell">Notes</TableHead><TableHead className="w-32"><span className="sr-only">Select</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {[...problem.versions].reverse().map((v) => (
              <TableRow key={v} data-state={v === version ? "selected" : undefined}>
                <TableCell className="font-mono text-[12.5px] font-semibold">{v}</TableCell>
                <TableCell>{v === problem.current ? <StatusDot tone="success">Live</StatusDot> : <StatusDot tone="neutral">Not live</StatusDot>}</TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">{v === problem.versions.at(-1) ? "latest upload" : ""}</TableCell>
                <TableCell className="text-right tabular-nums">{v === version ? <span className="text-[12px] font-semibold text-brand-deep">Selected</span> : <Button size="sm" variant="ghost" onClick={() => { setVersion(v); setReport(null); }}>Select</Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="border-t border-line px-5 py-4">
          <div className="mb-2 text-[12px] font-semibold text-muted-foreground">Add a version</div>
          <UploadVersion id={id} onChange={onChange} next={nextVersion} />
        </div>
      </Section>

      <Section
        title={<span className="flex items-center gap-2">Validate <span className="font-mono text-[12px] font-normal text-faint">{version}</span></span>}
        description="Prove the package before it goes live. The reference solution is the part that matters — it must pass every test within the limits. A wrong solution should fail, proving the tests bite."
        footer={<Button onClick={validate} loading={busy} disabled={!version}><Icon.Play size={14} /> Run validation</Button>}
      >
        <Summary cols={4} className="mb-5">
          <SummaryItem label="Testcases">{problem.testcases}</SummaryItem>
          <SummaryItem label="Limits">{problem.time_limit_ms} ms · {problem.memory_limit_mb} MB</SummaryItem>
          <SummaryItem label="Comparison">{problem.compare}</SummaryItem>
          <SummaryItem label="Reference">{problem.has_reference ? "stored in the package" : "supply one below"}</SummaryItem>
        </Summary>
        {problem.has_reference && !reference && <div className="mb-4"><Alert variant="info"><AlertDescription>This package carries its own reference solution; validation uses it unless you paste another one below.</AlertDescription></Alert></div>}
        <FormGrid cols={2}>
          <Field label={problem.has_reference ? "Reference solution (optional override)" : "Reference solution"} help="Must be accepted on every test.">
            <Textarea rows={7} className="font-mono text-[12px]" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Paste source…" />
          </Field>
          <Field label="Wrong solution" hint="optional" help="Should fail at least one test; otherwise the tests are too weak.">
            <Textarea rows={7} className="font-mono text-[12px]" value={wrong} onChange={(e) => setWrong(e.target.value)} placeholder="Paste a deliberately wrong source…" />
          </Field>
        </FormGrid>
        {(reference || wrong) && (
          <div className="mt-4 max-w-xs">
            <Field label="Language of the pasted sources">
              <SimpleSelect
                className="w-full"
                size="default"
                value={lang}
                onValueChange={setLang}
                options={languages.length === 0 ? [{ value: lang, label: lang }] : languages.map((l) => ({ value: l.key, label: l.name }))}
              />
            </Field>
          </div>
        )}
        {report && (
          <div className="mt-5">
            <Alert variant={report.ok ? "success" : "destructive"}><AlertTitle>{report.ok ? `${version} is valid` : `${version} has problems`}</AlertTitle><AlertDescription>
              <Checklist items={[
                ...(report.reference ? [{ ok: report.reference.verdict === "AC", label: `Reference: ${report.reference.verdict}`, detail: `${report.reference.passed} passed · slowest ${report.reference.max_time_ms} ms${report.reference.first_fail !== null ? ` · first failure on test ${report.reference.first_fail}` : ""}` }] : []),
                ...(report.wrong_solution ? [{ ok: report.wrong_solution.verdict !== "AC", label: `Wrong solution: ${report.wrong_solution.verdict}`, detail: report.wrong_solution.verdict === "AC" ? "it passed everything — the tests do not catch it" : "rejected, as it should be" }] : []),
                ...(report.checker ? [{ ok: report.checker.compiled, label: report.checker.compiled ? "Checker compiles" : "Checker does not compile", detail: report.checker.output || undefined }] : []),
                ...report.issues.map((i) => ({ ok: false, label: i })),
              ]} />
            </AlertDescription></Alert>
          </div>
        )}
      </Section>

      <Section
        title="Publish"
        description={problem.current ? `${problem.current} is live. Publishing ${version} swaps it atomically.` : "Nothing is live yet. Publishing makes this version the one the judge runs."}
        footer={
          <ReasonAction
            label={problem.current === version ? `${version} is live` : `Publish ${version}`} variant="default" size="default" disabled={!version || problem.current === version}
            title={`Publish ${version}?`}
            defaultReason={problem.current ? `Replacing ${problem.current} with ${version}.` : `Making ${version} the live package.`}
            description={blast > 0
              ? <span>This rejudges <strong>{blast}</strong> submission{blast === 1 ? "" : "s"} already made on this question. Verdicts may change; you will be asked what to do with the outcome.</span>
              : "No submissions exist for this question yet, so nothing is rejudged."}
            onConfirm={async (reason) => {
              const r = await api.post<{ rejudged: number }>(`/api/admin/problems/${id}/publish`, { version, reason, confirmed_rejudge: blast });
              toast({ title: `${version} is live`, description: r.rejudged ? `${r.rejudged} submission(s) are being rejudged.` : undefined, tone: "success" });
              onChange();
            }}
          />
        }
      >
        <Checklist items={[
          { ok: Boolean(validated) && !stale, label: validated ? "Validated" : "Not validated", detail: validated ? (problem.last_validation?.imported ? "the reference passed on the install that exported this" : "the reference passed") : "publishing without validation is allowed but unwise" },
          { ok: blast === 0, label: blast === 0 ? "No submissions affected" : `${blast} submission${blast === 1 ? "" : "s"} would be rejudged`, detail: blast ? "the number you confirm must match this" : undefined },
        ]} />
        {problem.last_validation && (
          <div className="mt-3 border-t pt-3">
            <ValidationNote record={problem.last_validation} />
          </div>
        )}
        {blast > 0 && question && question.status !== "void" && (
          <div className="mt-5 border-t border-line pt-4">
            <div className="mb-2 text-[12px] font-semibold text-muted-foreground">After a rejudge</div>
            <p className="mb-3 text-[12.5px] text-muted-foreground">If verdicts changed and someone was disadvantaged, choose what happens. Every choice is audit-logged.</p>
            <div className="flex flex-wrap gap-2">
              {(["stand", "refund", "void"] as const).map((o) => (
                <ReasonAction key={o} label={o === "stand" ? "Let verdicts stand" : o === "refund" ? "Refund the owner" : "Void the question"} variant={o === "void" ? "destructive" : "outline"}
                  defaultReason={o === "stand" ? "The rejudge changed nothing material; the new verdicts stand." : o === "refund" ? "The rejudge disadvantaged the owner; refunding what they paid." : "The package was wrong; this question scores for nobody."}
                  title={o === "stand" ? "Let the new verdicts stand?" : o === "refund" ? "Refund the owner?" : "Void this question?"}
                  description={o === "stand" ? "The rejudged verdicts count as they are." : o === "refund" ? "The owner keeps the question and gets the price back." : "Scores for nobody; the owner is refunded the price and every hint bought."}
                  onConfirm={async (reason) => { await api.post(`/api/admin/questions/${id}/rejudge-outcome`, { reason, outcome: o }); toast({ title: "Recorded", tone: "success" }); onChange(); }} />
              ))}
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Details({ id, question, testcases, onChange }: { id: string; question: Q | null; testcases: number | null; onChange: () => void }) {
  const { toast } = useToast();
  const initial: QuestionDetails = question
    ? { title: question.title, difficulty: question.difficulty as QuestionDetails["difficulty"], score: question.score, base_price: question.basePrice, auction_order: question.auctionOrder, statement_md: question.statementMd, sample_count: question.sampleCount, hints: question.hints.map((h) => ({ price: h.price, body_md: h.bodyMd })) }
    : EMPTY_DETAILS;
  const [d, setD] = useState<QuestionDetails>(initial);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);
  const issues = [...detailsIssues(d, testcases), ...hintIssues(d.hints)];

  async function save() {
    setBusy(true);
    try { await api.post("/api/admin/questions", { id, reason: `${question ? "Edited" : "Wrote"} the contest details for ${id}.`, ...d }); toast({ title: "Details saved", tone: "success" }); onChange(); }
    catch (err) { toast({ title: "Not saved", description: errorMessage(err), tone: "error" }); } finally { setBusy(false); }
  }

  return (
    <div className={`space-y-4 ${dirty ? "pb-20" : ""}`}>
      {!question && <Alert variant="info"><AlertTitle>No details yet</AlertTitle><AlertDescription>Participants would see nothing for this problem. Fill these in and save.</AlertDescription></Alert>}
      <Section title="Question" description="What participants see when they win it. The judge never reads any of this.">
        <QuestionBasicsFields d={d} onChange={setD} testcases={testcases} />
      </Section>
      <Section title="Hints" description="Author-written text, unlocked in order. Hidden testcases are never for sale, at any price.">
        <HintsEditor hints={d.hints} onChange={(hints) => setD({ ...d, hints })} />
      </Section>
      {question && question.status !== "void" && (
        <Section title="Void" description="Removes the question from play. It scores for nobody; the owner is refunded the price and every hint bought for it.">
          <ReasonAction label="Void this question" variant="destructive" title={`Void ${id}?`} description="This cannot be undone."
            defaultReason={`${id} is unusable as set; removing it from play.`}
            onConfirm={async (reason) => { await api.post(`/api/admin/questions/${id}/void`, { reason }); toast({ title: "Question voided", tone: "success" }); onChange(); }} />
        </Section>
      )}

      {(dirty || !question) && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 backdrop-blur lg:left-60">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-6 lg:px-8">
            <span className="text-[13px] font-semibold">{question ? "Unsaved changes" : "Save the details"}</span>
            {issues.length > 0 && <span className="text-[12px] text-red">{issues[0]}</span>}
            <div className="flex flex-1 items-center gap-2 sm:justify-end">
              {question && <Button variant="ghost" onClick={() => setD(initial)}>Discard</Button>}
              <Button onClick={save} loading={busy} disabled={issues.length > 0}><Icon.Check size={14} /> Save</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Preview({ id, problem, question }: { id: string; problem: P | null; question: Q | null }) {
  const [samples, setSamples] = useState<{ input: string; output: string }[] | null>(null);
  const count = question?.sampleCount ?? 0;
  useEffect(() => {
    if (!problem) { setSamples([]); return; }
    void api.post<{ samples: { input: string; output: string }[] }>(`/api/admin/problems/${id}/samples`, { count, version: problem.current ?? problem.versions.at(-1) }).then((r) => setSamples(r.samples)).catch(() => setSamples([]));
  }, [id, problem, count]);

  if (!question) return <Section padded={false}><div className="p-8 text-center text-[13px] text-muted-foreground">No details to preview yet — add them under Details & hints.</div></Section>;
  return (
    <div className="space-y-4">
      <Alert variant="info"><AlertDescription>This is the workspace's problem pane, rendered from the saved details and the {problem?.current ? "live" : "latest"} package.</AlertDescription></Alert>
      <ProblemPreview
        title={question.title} difficulty={question.difficulty} score={question.score} statementMd={question.statementMd}
        timeLimitMs={problem?.time_limit_ms ?? null} memoryLimitMb={problem?.memory_limit_mb ?? null}
        testcases={problem?.testcases ?? null} sampleCount={question.sampleCount} samples={samples ?? []}
      />
      <Section title="Hints, in the order they unlock" description="The owner sees only the next price until it is bought.">
        {question.hints.length === 0 ? <p className="text-[13px] text-muted-foreground">None.</p> : (
          <ol className="divide-y divide-line">
            {question.hints.map((h) => (
              <li key={h.idx} className="flex gap-4 py-2.5 text-[13px]">
                <span className="w-24 shrink-0 font-semibold tabular-nums text-muted-foreground">Hint {h.idx + 1} · {h.price}</span>
                <span className="min-w-0 flex-1 whitespace-pre-wrap">{h.bodyMd}</span>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
