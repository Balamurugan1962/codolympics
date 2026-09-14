"use client";

/**
 * New problem, in four steps: the judge package, what participants read,
 * the hints they can buy, and a preview of exactly what the owner will see.
 * Nothing is sent until the last step; the package is inspected in the
 * browser first so the obvious mistakes are caught before a round trip.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { HintsEditor, QuestionBasicsFields, detailsIssues, EMPTY_DETAILS, hintIssues, type QuestionDetails } from "@/components/admin/question-details-form";
import { ProblemPreview } from "@/components/admin/problem-preview";
import { Icon } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileDrop } from "@/components/ui/file-drop";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageBody, PageHeader, Section } from "@/components/ui/page";
import { Checklist, Summary, SummaryItem } from "@/components/ui/summary";
import { useToast } from "@/components/ui/toast";
import { WizardLayout, WizardNote, type WizardStep } from "@/components/ui/wizard";
import { api, errorMessage } from "@/lib/client";
import { inspectPackage, type PackageInspection } from "@/lib/package-inspect";

import type { P, Q } from "../page";

const ID = /^[A-Za-z0-9._-]+$/;

export default function NewProblemPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [existing, setExisting] = useState<{ problems: P[]; questions: Q[] } | null>(null);
  const [id, setId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<PackageInspection | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [details, setDetails] = useState<QuestionDetails>(EMPTY_DETAILS);
  const [reason, setReason] = useState("");
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([api.get<{ problems: P[] }>("/api/admin/problems"), api.get<{ questions: Q[] }>("/api/admin/questions")]).then(([p, q]) => {
      setExisting({ problems: p.problems, questions: q.questions });
      const maxOrder = q.questions.reduce((m, x) => Math.max(m, x.auctionOrder), 0);
      setDetails((d) => ({ ...d, auction_order: maxOrder + 1 }));
    });
  }, []);

  useEffect(() => {
    if (!file) { setInspection(null); return; }
    let cancelled = false;
    setInspecting(true);
    void inspectPackage(file, 20).then((r) => { if (!cancelled) { setInspection(r); setInspecting(false); } });
    return () => { cancelled = true; };
  }, [file]);

  const hackOnly = Boolean(inspection?.problem?.hack_only);
  const known = existing?.problems.find((p) => p.problem_id === id.trim()) ?? null;
  const knownQ = existing?.questions.find((q) => q.id === id.trim()) ?? null;
  const testcases = inspection ? inspection.testcases : null;

  // Prefill from an existing question when the id matches one -- adding a version, not replacing details.
  useEffect(() => {
    if (!knownQ) return;
    setDetails({ title: knownQ.title, difficulty: knownQ.difficulty as QuestionDetails["difficulty"], score: knownQ.score, base_price: knownQ.basePrice, auction_order: knownQ.auctionOrder, statement_md: knownQ.statementMd, sample_count: knownQ.sampleCount, hints: knownQ.hints.map((h) => ({ price: h.price, body_md: h.bodyMd })) });
  }, [knownQ]);

  const packageIssues = useMemo(() => {
    const out: string[] = [];
    if (!id.trim()) out.push("Choose a problem id.");
    else if (!ID.test(id.trim())) out.push("The id may only contain letters, digits, dots, dashes and underscores.");
    if (!file) out.push("Choose the package zip.");
    if (inspection) out.push(...inspection.issues);
    return out;
  }, [id, file, inspection]);
  const dIssues = useMemo(() => (hackOnly ? [] : detailsIssues(details, testcases)), [details, testcases, hackOnly]);
  const hIssues = useMemo(() => (hackOnly ? [] : hintIssues(details.hints)), [details.hints, hackOnly]);

  const steps: WizardStep[] = hackOnly
    ? [
      { key: "package", label: "Package", hint: "The zip the judge runs", state: packageIssues.length ? (reached > 0 ? "error" : "todo") : "done" },
      { key: "review", label: "Review & create", hint: "Check, then upload", state: "todo" },
    ]
    : [
      { key: "package", label: "Package", hint: "The zip the judge runs", state: packageIssues.length ? (reached > 0 ? "error" : "todo") : "done" },
      { key: "details", label: "Details", hint: "Title, tier, price, statement", state: reached > 1 ? (dIssues.length ? "error" : "done") : "todo" },
      { key: "hints", label: "Hints", hint: "What the owner can buy", state: reached > 2 ? (hIssues.length ? "error" : "done") : "todo" },
      { key: "review", label: "Preview & create", hint: "See it as the owner will", state: "todo" },
    ];
  const cur = Math.min(step, steps.length - 1);
  const key = steps[cur].key;
  const last = cur === steps.length - 1;
  const stepIssues = key === "package" ? packageIssues : key === "details" ? dIssues : key === "hints" ? hIssues : [];
  const allIssues = [...packageIssues, ...dIssues, ...hIssues];

  function go(i: number) { setStep(i); setReached((r) => Math.max(r, i)); setError(null); }
  function next() { if (stepIssues.length) { setReached((r) => Math.max(r, cur + 1)); return; } go(cur + 1); }

  async function create() {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const form = new FormData(); form.set("id", id.trim()); form.set("reason", reason.trim()); form.set("package", file);
      const r = await api.post<{ version: string }>("/api/admin/problems", form);
      if (!hackOnly) await api.post("/api/admin/questions", { id: id.trim(), reason: reason.trim(), ...details });
      toast({ title: `${id.trim()} uploaded as ${r.version}`, description: "Next: validate the package, then publish it.", tone: "success", duration: 7000 });
      router.push(`/admin/problems/${encodeURIComponent(id.trim())}`);
    } catch (err) { setError(errorMessage(err)); setBusy(false); }
  }

  return (
    <PageBody width="wide">
      <PageHeader
        breadcrumb={<Link href="/admin/problems" className="inline-flex items-center gap-1 hover:text-ink"><Icon.ChevronLeft size={14} /> Problems</Link>}
        title="New problem"
      />

      <WizardLayout
        steps={steps}
        current={cur}
        onSelect={go}
        reachable={(i) => i <= reached}
        aside={
          <WizardNote title="What happens next">
            The package becomes a new, unpublished version. On the problem page you validate it against the judge and publish it — only then can it be auctioned.
          </WizardNote>
        }
        footer={
          <>
            <Button variant="outline" disabled={cur === 0 || busy} onClick={() => go(cur - 1)}><Icon.ChevronLeft size={14} /> Back</Button>
            <span className="text-[12px] text-muted-foreground">Step {cur + 1} of {steps.length}</span>
            <div className="ml-auto flex items-center gap-2">
              <Link href="/admin/problems"><Button variant="ghost" disabled={busy}>Cancel</Button></Link>
              {last
                ? <Button onClick={create} loading={busy} disabled={allIssues.length > 0 || reason.trim().length < 3}><Icon.Upload size={14} /> {known ? `Upload as ${nextVersion(known)}` : "Create problem"}</Button>
                : <Button onClick={next} disabled={inspecting}>Continue <Icon.ChevronRight size={14} /></Button>}
            </div>
          </>
        }
      >
        {key === "package" && (
          <>
            <Section title="Identify the problem" description="The id names the folder on the judge. Reuse an existing id to upload a new version of it.">
              <Field label="Problem id" hint="letters, digits, . _ -" error={id && !ID.test(id.trim()) ? "Only letters, digits, dots, dashes and underscores." : undefined}
                help={known ? undefined : "Short and stable — it appears in the audit log and on the judge, never to participants."}>
                <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="e.g. hard-03" autoFocus className="max-w-xs font-mono" />
              </Field>
              {known && (
                <div className="mt-3">
                  <Alert variant="info"><AlertTitle>{`${known.problem_id} already exists`}</AlertTitle><AlertDescription>
                    This upload adds <strong>{nextVersion(known)}</strong> next to {known.versions.join(", ")}. The live version ({known.current ?? "none"}) is untouched until you publish.
                    {knownQ && " Its details are filled in below; edit them if the new version changes the statement."}
                  </AlertDescription></Alert>
                </div>
              )}
            </Section>

            <Section title="Package" description="A zip with problem.json and tests/ at its root (one enclosing folder is fine). Add checker.py, validator.py or a reference solution when the problem needs them.">
              <FileDrop file={file} onFile={setFile} hint="Up to 200 MB" />
              {inspecting && <p className="mt-3 flex items-center gap-2 text-[12.5px] text-muted-foreground"><Icon.Spinner size={14} /> Reading the package…</p>}
              {inspection && !inspecting && <Inspection r={inspection} />}
            </Section>
          </>
        )}

        {key === "details" && (
          <Section title="What participants see" description="The judge never reads any of this. Bidders see the title and tier before buying; only the owner reads the statement.">
            <QuestionBasicsFields d={details} onChange={setDetails} testcases={testcases} />
            {reached > 1 && dIssues.length > 0 && <div className="mt-5"><IssueList issues={dIssues} /></div>}
          </Section>
        )}

        {key === "hints" && (
          <Section title="Hints" description="Author-written text, unlocked in order, paid for from the owner's balance. Hidden testcases are never for sale, at any price.">
            <HintsEditor hints={details.hints} onChange={(hints) => setDetails({ ...details, hints })} />
            {reached > 2 && hIssues.length > 0 && <div className="mt-5"><IssueList issues={hIssues} /></div>}
          </Section>
        )}

        {key === "review" && inspection && (
          <>
            {allIssues.length > 0 && <Alert variant="destructive"><AlertTitle>Not ready to create</AlertTitle><AlertDescription><ul className="ml-4 list-disc space-y-0.5">{allIssues.map((i) => <li key={i}>{i}</li>)}</ul></AlertDescription></Alert>}
            <Section title="Summary" description={hackOnly ? "A hacking problem: the judge holds the reference solution and validator; the question itself is written under Phase 1." : "Everything below is what will be created."}>
              <Summary cols={4}>
                <SummaryItem label="Id" mono>{id.trim()}</SummaryItem>
                <SummaryItem label="Version" mono>{known ? nextVersion(known) : "v1"}</SummaryItem>
                <SummaryItem label="Testcases">{inspection.testcases}</SummaryItem>
                <SummaryItem label="Limits">{inspection.problem?.time_limit_ms ?? "?"} ms · {inspection.problem?.memory_limit_mb ?? "?"} MB</SummaryItem>
                <SummaryItem label="Comparison">{inspection.problem?.compare ?? "tokens"}{inspection.hasChecker ? " · checker.py" : ""}</SummaryItem>
                <SummaryItem label="Validator">{inspection.hasValidator ? "validator.py" : "none"}</SummaryItem>
                <SummaryItem label="Reference">{inspection.reference ? `${inspection.reference.file} (${inspection.reference.language})` : "none"}</SummaryItem>
                <SummaryItem label="Kind">{hackOnly ? <Badge variant="neutral">Hacking</Badge> : <Badge variant="success">Auction problem</Badge>}</SummaryItem>
                {!hackOnly && (
                  <>
                    <SummaryItem label="Title">{details.title}</SummaryItem>
                    <SummaryItem label="Tier · score · base">{details.difficulty} · {details.score} pts · {details.base_price}</SummaryItem>
                    <SummaryItem label="Auction order">#{details.auction_order}</SummaryItem>
                    <SummaryItem label="Samples · hints">{details.sample_count} shown · {details.hints.length} hint{details.hints.length === 1 ? "" : "s"}</SummaryItem>
                  </>
                )}
              </Summary>
            </Section>

            {!hackOnly && (
              <Section title="As the owner will see it" description="The workspace's problem pane, rendered from what you entered and the package's first testcases." padded={false}>
                <div className="bg-muted p-4">
                  <ProblemPreview
                    title={details.title} difficulty={details.difficulty} score={details.score} statementMd={details.statement_md}
                    timeLimitMs={inspection.problem?.time_limit_ms ?? null} memoryLimitMb={inspection.problem?.memory_limit_mb ?? null}
                    testcases={inspection.testcases} sampleCount={details.sample_count} samples={inspection.samples}
                  />
                </div>
                {details.hints.length > 0 && (
                  <div className="border-t border-line px-5 py-4">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">Hints, in the order they unlock</div>
                    <ol className="space-y-1.5">{details.hints.map((h, i) => <li key={i} className="flex gap-3 text-[13px]"><span className="w-20 shrink-0 font-semibold tabular-nums text-muted-foreground">{h.price} coins</span><span className="min-w-0 truncate">{h.body_md}</span></li>)}</ol>
                  </div>
                )}
              </Section>
            )}

            <Section title="Create" description="Recorded in the audit log with your reason.">
              {error && <div className="mb-4"><Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert></div>}
              <Field label="Reason" help="e.g. initial upload, or what changed in this version.">
                <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Initial upload for the contest set" />
              </Field>
            </Section>
          </>
        )}
      </WizardLayout>
    </PageBody>
  );
}

function nextVersion(p: P): string {
  const last = p.versions.at(-1);
  return `v${last ? Number(last.slice(1)) + 1 : 1}`;
}

function IssueList({ issues }: { issues: string[] }) {
  return <Alert variant="destructive"><AlertTitle>Fix these before continuing</AlertTitle><AlertDescription><ul className="ml-4 list-disc space-y-0.5">{issues.map((i) => <li key={i}>{i}</li>)}</ul></AlertDescription></Alert>;
}

function Inspection({ r }: { r: PackageInspection }) {
  const pj = r.problem;
  return (
    <div className="mt-4 space-y-4">
      {r.issues.length > 0 && <Alert variant="destructive"><AlertTitle>The judge would reject this package</AlertTitle><AlertDescription><ul className="ml-4 list-disc space-y-0.5">{r.issues.map((i) => <li key={i}>{i}</li>)}</ul></AlertDescription></Alert>}
      {r.warnings.length > 0 && <Alert variant="warning"><AlertTitle>Warnings</AlertTitle><AlertDescription><ul className="ml-4 list-disc space-y-0.5">{r.warnings.map((i) => <li key={i}>{i}</li>)}</ul></AlertDescription></Alert>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-box border border-line">
          <div className="border-b border-line bg-muted/60 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">What is in it</div>
          <div className="p-3.5">
            <Checklist items={[
              { ok: Boolean(pj), label: "problem.json", detail: pj ? `${pj.time_limit_ms ?? "?"} ms · ${pj.memory_limit_mb ?? "?"} MB · compare ${pj.compare ?? "tokens"}${pj.early_exit === false ? " · runs every test" : ""}` : "missing at the root" },
              { ok: r.testcases > 0 || Boolean(pj?.hack_only), label: `${r.testcases} testcase${r.testcases === 1 ? "" : "s"}`, detail: r.testcases ? `${r.tests[0].name} … ${r.tests[r.tests.length - 1].name}` : "none under tests/" },
              ...(pj?.compare === "checker" ? [{ ok: r.hasChecker, label: "checker.py", detail: r.hasChecker ? "decides each verdict" : "required by compare: checker" }] : []),
              { ok: true, label: r.hasValidator ? "validator.py" : "no validator.py", detail: r.hasValidator ? "run by Validate; required for hacking" : "optional for auction problems" },
              ...(r.reference ? [{ ok: r.reference.present, label: `reference: ${r.reference.file}`, detail: r.reference.present ? `${r.reference.language}, stored on the judge, never served` : "named in problem.json but not in the zip" }] : []),
              ...(pj?.hack_only ? [{ ok: true, label: "hack_only", detail: "a Phase 1 hacking problem; no auction details are needed" }] : []),
            ]} />
          </div>
        </div>
        <div className="rounded-box border border-line">
          <div className="border-b border-line bg-muted/60 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">Files · {r.files.length}{r.strippedFolder ? ` · inside ${r.strippedFolder}/` : ""}</div>
          <ul className="pane max-h-56 overflow-auto p-2 font-mono text-[11.5px] text-muted-foreground">
            {r.files.slice(0, 200).map((f) => <li key={f} className="truncate px-1.5 py-0.5">{f}</li>)}
            {r.files.length > 200 && <li className="px-1.5 py-0.5 text-faint">… {r.files.length - 200} more</li>}
          </ul>
        </div>
      </div>
      {r.samples[0] && (
        <div className="rounded-box border border-line">
          <div className="border-b border-line bg-muted/60 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">First testcase</div>
          <div className="grid gap-3 p-3.5 sm:grid-cols-2">
            <pre className="max-h-32 overflow-auto rounded-box border border-line bg-muted p-2 text-[12px]">{r.samples[0].input}</pre>
            <pre className="max-h-32 overflow-auto rounded-box border border-line bg-muted p-2 text-[12px]">{r.samples[0].output || <span className="text-faint">(no answer file)</span>}</pre>
          </div>
        </div>
      )}
      <p className="text-[11.5px] text-faint">Checked in this browser; the judge checks it again on upload.</p>
    </div>
  );
}
