"use client";

/**
 * Phase 1 authoring and review: Section A puzzles, Section B hacking
 * questions, and the leaderboard from which the administrator selects who
 * advances (requirements-phase1.md, Epics P2, P3, P6).
 */
import { useCallback, useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { ReasonAction } from "@/components/reason-action";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

type Puzzle = { id: number; title: string; bodyMd: string; category: string; kind: string; grading: string; points: number; explainPoints: number; orderIndex: number; published: boolean; voided: boolean; ready: boolean; config: Record<string, unknown>; answerKey: Record<string, unknown> | null; modelAnswer: string | null; validatorPy: string | null; pointsPerEntry: number | null; maxEntries: number; formatRegex: string | null; formatHint: string | null };
type Hack = { id: number; title: string; statementMd: string; constraintsMd: string; problemId: string; givenSource: string; givenLanguage: string; hackPoints: number; failPenalty: number; orderIndex: number; published: boolean; voided: boolean; ready: boolean };
type Standing = { participant_id: string; name: string; points: number; provisional: boolean; submitted_at: string | null; disqualified: boolean; advanced: boolean | null; rank: number };

export default function Phase1AdminPage() {
  const [tab, setTab] = useState<"puzzles" | "hacking" | "review">("puzzles");
  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Phase 1" description="Author the puzzles and hacking questions, prove each one works, publish. After the round, grade and select who advances." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "puzzles", label: "Section A — Puzzles" }, { value: "hacking", label: "Section B — Hacking" }, { value: "review", label: "Review & advance" }]} />
      {tab === "puzzles" && <PuzzleAdmin />}
      {tab === "hacking" && <HackAdmin />}
      {tab === "review" && <Review />}
    </div>
  );
}

// ---------------------------------------------------------------------------

const EMPTY_PUZZLE = { title: "", body_md: "", category: "pattern", kind: "fill_blank", grading: "auto", points: 10, explain_points: 0, order_index: 0, options: "", items: "", partial_credit: false, tolerance: "", case_sensitive: false, key_option: "", key_options: "", key_accepted: "", key_value: "", key_order: "", key_members: "", model_answer: "", validator_py: "def check(entry):\n    s = entry.rest().strip()\n    return len(s) == 4 and s.isdigit()\n", points_per_entry: 1, max_entries: 100, format_regex: "", format_hint: "" };

function PuzzleAdmin() {
  const [rows, setRows] = useState<Puzzle[]>([]);
  const [sel, setSel] = useState<number | "new" | null>(null);
  const load = useCallback(async () => setRows((await api.get<{ questions: Puzzle[] }>("/api/admin/phase1/puzzles")).questions), []);
  useEffect(() => { void load(); }, [load]);
  const current = typeof sel === "number" ? rows.find((r) => r.id === sel) ?? null : null;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader title="Puzzles" action={<Button size="sm" onClick={() => setSel("new")}>+ New</Button>} />
        <CardBody className="space-y-1 p-2">{rows.map((r) => (
          <button key={r.id} onClick={() => setSel(r.id)} className={`flex w-full items-center justify-between rounded-box px-3 py-2 text-left text-sm ${sel === r.id ? "bg-green-tint font-semibold" : "hover:bg-page"}`}>
            <span>{r.orderIndex}. {r.title}</span><span className="flex gap-1">{r.voided ? <Badge tone="red">void</Badge> : r.published ? <Badge tone="green">live</Badge> : r.ready ? <Badge tone="blue">ready</Badge> : <Badge tone="amber">draft</Badge>}</span>
          </button>
        ))}</CardBody>
      </Card>
      <div className="lg:col-span-2">{sel === null ? <EmptyState icon={<Icon.Puzzle size={22} />} title={rows.length ? "Pick a puzzle to edit" : "No puzzles yet"} body="Each question must pass its self-test before it can be published." action={<Button size="sm" onClick={() => setSel("new")}>New puzzle</Button>} /> : <PuzzleEditor key={String(sel)} existing={current} onChange={async () => { await load(); }} onCreated={(id) => setSel(id)} />}</div>
    </div>
  );
}

function PuzzleEditor({ existing, onChange, onCreated }: { existing: Puzzle | null; onChange: () => Promise<void>; onCreated: (id: number) => void }) {
  const [f, setF] = useState(() => existing ? fromPuzzle(existing) : EMPTY_PUZZLE);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ tone: "success" | "error" | "warning"; text: string } | null>(null);
  const [trial, setTrial] = useState(""); const [shouldPass, setShouldPass] = useState(""); const [shouldFail, setShouldFail] = useState("");
  const csv = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
  const nums = (s: string) => csv(s.replace(/,/g, "\n")).map(Number);

  function payload() {
    const cfg: Record<string, unknown> = { partialCredit: f.partial_credit, caseSensitive: f.case_sensitive };
    if (f.kind.startsWith("mcq")) cfg.options = csv(f.options);
    if (f.kind === "sequence") cfg.items = csv(f.items);
    if (f.kind === "numeric" && f.tolerance !== "") cfg.tolerance = Number(f.tolerance);
    let key: Record<string, unknown> | null = null;
    if (f.grading === "auto") {
      key = {};
      if (f.kind === "mcq_single") key.option = Number(f.key_option);
      if (f.kind === "mcq_multi") key.options = nums(f.key_options);
      if (f.kind === "fill_blank") key.accepted = csv(f.key_accepted);
      if (f.kind === "numeric") key.value = Number(f.key_value);
      if (f.kind === "sequence") key.order = nums(f.key_order);
      if (f.kind === "set") key.members = csv(f.key_members);
    }
    return { reason, title: f.title, body_md: f.body_md, category: f.category, kind: f.kind, grading: f.grading, points: f.points, explain_points: f.explain_points, order_index: f.order_index, config: cfg, answer_key: key, model_answer: f.model_answer || null, validator_py: f.grading === "validator" ? f.validator_py : null, points_per_entry: f.grading === "validator" ? f.points_per_entry : null, max_entries: f.max_entries, format_regex: f.format_regex || null, format_hint: f.format_hint || null };
  }

  async function save() {
    setMsg(null);
    try {
      if (existing) { await api.patch(`/api/admin/phase1/puzzles/${existing.id}`, payload()); setMsg({ tone: "success", text: "Saved. Re-run the self-test before publishing." }); }
      else { const r = await api.post<{ id: number }>("/api/admin/phase1/puzzles", payload()); onCreated(r.id); }
      await onChange();
    } catch (err) { setMsg({ tone: "error", text: errorMessage(err) }); }
  }
  async function test() {
    if (!existing) return;
    setMsg(null);
    try {
      const body = f.grading === "validator" ? { should_pass: csv(shouldPass), should_fail: csv(shouldFail) } : { answer: parseTrial(f.kind, trial) };
      const r = await api.post<{ ready: boolean; detail: string }>(`/api/admin/phase1/puzzles/${existing.id}/test`, body);
      setMsg({ tone: r.ready ? "success" : "warning", text: r.detail }); await onChange();
    } catch (err) { setMsg({ tone: "error", text: errorMessage(err) }); }
  }

  return (
    <Card>
      <CardHeader title={existing ? `Edit: ${existing.title}` : "New puzzle"} action={existing && <span className="flex gap-2">
        {existing.published
          ? <ReasonAction label="Unpublish" title="Unpublish?" onConfirm={async (reason) => { await api.post(`/api/admin/phase1/puzzles/${existing.id}/unpublish`, { reason }); await onChange(); }} />
          : <ReasonAction label="Publish" variant="primary" title="Publish?" disabled={!existing.ready} onConfirm={async (reason) => { await api.post(`/api/admin/phase1/puzzles/${existing.id}/publish`, { reason }); await onChange(); }} />}
        {!existing.voided && <ReasonAction label="Void" variant="danger" title="Void this question?" description="Scores for nobody; every total is recomputed." onConfirm={async (reason) => { await api.post(`/api/admin/phase1/puzzles/${existing.id}/void`, { reason }); await onChange(); }} />}
      </span>} />
      <CardBody>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}><option value="pattern">pattern</option><option value="detective">detective</option><option value="constraint">constraint</option></Select></Field>
            <Field label="Kind"><Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{["mcq_single", "mcq_multi", "fill_blank", "numeric", "sequence", "set", "long_text"].map((k) => <option key={k}>{k}</option>)}</Select></Field>
            <Field label="Grading"><Select value={f.grading} onChange={(e) => setF({ ...f, grading: e.target.value })}><option value="auto">auto</option><option value="validator">validator</option><option value="manual">manual</option></Select></Field>
          </div>
        </div>
        <Field label="Body (Markdown — tables and code blocks render)"><Textarea rows={6} value={f.body_md} onChange={(e) => setF({ ...f, body_md: e.target.value })} /></Field>
        <div className="grid grid-cols-4 gap-2">
          <Field label="Points"><Input type="number" value={f.points} onChange={(e) => setF({ ...f, points: Number(e.target.value) })} /></Field>
          <Field label="Explanation points" hint="0 = no explanation asked"><Input type="number" value={f.explain_points} onChange={(e) => setF({ ...f, explain_points: Number(e.target.value) })} /></Field>
          <Field label="Order"><Input type="number" value={f.order_index} onChange={(e) => setF({ ...f, order_index: Number(e.target.value) })} /></Field>
          <Field label="Max entries (set/validator)"><Input type="number" value={f.max_entries} onChange={(e) => setF({ ...f, max_entries: Number(e.target.value) })} /></Field>
        </div>
        {f.kind.startsWith("mcq") && <Field label="Options, one per line"><Textarea rows={4} value={f.options} onChange={(e) => setF({ ...f, options: e.target.value })} /></Field>}
        {f.kind === "sequence" && <Field label="Items to order, one per line (in any order)"><Textarea rows={4} value={f.items} onChange={(e) => setF({ ...f, items: e.target.value })} /></Field>}
        <div className="grid grid-cols-3 gap-2">
          <Field label="Format regex (checked in the browser)" hint='e.g. ^\d{4}$'><Input value={f.format_regex} onChange={(e) => setF({ ...f, format_regex: e.target.value })} /></Field>
          <Field label="Format hint" hint="four digits, no spaces"><Input value={f.format_hint} onChange={(e) => setF({ ...f, format_hint: e.target.value })} /></Field>
          <div className="flex items-end gap-4 pb-4 text-sm"><label className="flex items-center gap-1"><input type="checkbox" checked={f.partial_credit} onChange={(e) => setF({ ...f, partial_credit: e.target.checked })} /> partial credit</label><label className="flex items-center gap-1"><input type="checkbox" checked={f.case_sensitive} onChange={(e) => setF({ ...f, case_sensitive: e.target.checked })} /> case-sensitive</label></div>
        </div>

        {f.grading === "auto" && (
          <div className="rounded-box border border-line bg-page p-3">
            <div className="mb-2 text-xs font-semibold uppercase text-muted">Answer key (never sent to participants)</div>
            {f.kind === "mcq_single" && <Field label="Correct option index (0-based)"><Input value={f.key_option} onChange={(e) => setF({ ...f, key_option: e.target.value })} /></Field>}
            {f.kind === "mcq_multi" && <Field label="Correct option indexes, comma-separated"><Input value={f.key_options} onChange={(e) => setF({ ...f, key_options: e.target.value })} /></Field>}
            {f.kind === "fill_blank" && <Field label="Accepted answers, one per line"><Textarea rows={3} value={f.key_accepted} onChange={(e) => setF({ ...f, key_accepted: e.target.value })} /></Field>}
            {f.kind === "numeric" && <div className="grid grid-cols-2 gap-2"><Field label="Value"><Input value={f.key_value} onChange={(e) => setF({ ...f, key_value: e.target.value })} /></Field><Field label="Tolerance"><Input value={f.tolerance} onChange={(e) => setF({ ...f, tolerance: e.target.value })} /></Field></div>}
            {f.kind === "sequence" && <Field label="Correct order as item indexes, comma-separated"><Input value={f.key_order} onChange={(e) => setF({ ...f, key_order: e.target.value })} /></Field>}
            {f.kind === "set" && <Field label="Correct members, one per line"><Textarea rows={3} value={f.key_members} onChange={(e) => setF({ ...f, key_members: e.target.value })} /></Field>}
          </div>
        )}
        {f.grading === "validator" && (
          <div className="rounded-box border border-line bg-page p-3">
            <Field label="Validator: def check(entry) -> bool (runs in the judge sandbox at section close)"><Textarea rows={8} className="font-mono text-xs" value={f.validator_py} onChange={(e) => setF({ ...f, validator_py: e.target.value })} /></Field>
            <Field label="Points per valid distinct entry"><Input type="number" value={f.points_per_entry} onChange={(e) => setF({ ...f, points_per_entry: Number(e.target.value) })} /></Field>
          </div>
        )}
        {f.grading === "manual" && <Field label="Model answer (grading aid, never shown to participants)"><Textarea rows={4} value={f.model_answer} onChange={(e) => setF({ ...f, model_answer: e.target.value })} /></Field>}

        <Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        {msg && <div className="mb-3"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
        <div className="flex flex-wrap items-end gap-2">
          <Button onClick={save} disabled={reason.length < 3 || !f.title}>{existing ? "Save" : "Create"}</Button>
          {existing && f.grading === "auto" && <><Input className="w-56" placeholder="intended answer (JSON for lists)" value={trial} onChange={(e) => setTrial(e.target.value)} /><Button variant="secondary" onClick={test}>Self-test</Button></>}
          {existing && f.grading === "validator" && <><Textarea className="w-48" rows={2} placeholder="should pass, one per line" value={shouldPass} onChange={(e) => setShouldPass(e.target.value)} /><Textarea className="w-48" rows={2} placeholder="should fail, one per line" value={shouldFail} onChange={(e) => setShouldFail(e.target.value)} /><Button variant="secondary" onClick={test}>Self-test</Button></>}
          {existing && f.grading === "manual" && <Button variant="secondary" onClick={test}>Check readiness</Button>}
        </div>
        <p className="mt-2 text-xs text-faint">A question cannot be published until its self-test marks it ready. The intended answer scoring less than full marks usually means a typo in the key — or a puzzle with no valid answer.</p>
      </CardBody>
    </Card>
  );
}

function fromPuzzle(p: Puzzle) {
  const c = p.config as Record<string, unknown>; const k = (p.answerKey ?? {}) as Record<string, unknown>;
  return { ...EMPTY_PUZZLE, title: p.title, body_md: p.bodyMd, category: p.category, kind: p.kind, grading: p.grading, points: p.points, explain_points: p.explainPoints, order_index: p.orderIndex,
    options: ((c.options as string[]) ?? []).join("\n"), items: ((c.items as string[]) ?? []).join("\n"), partial_credit: Boolean(c.partialCredit), tolerance: c.tolerance === undefined ? "" : String(c.tolerance), case_sensitive: Boolean(c.caseSensitive),
    key_option: k.option === undefined ? "" : String(k.option), key_options: ((k.options as number[]) ?? []).join(","), key_accepted: ((k.accepted as string[]) ?? []).join("\n"), key_value: k.value === undefined ? "" : String(k.value), key_order: ((k.order as number[]) ?? []).join(","), key_members: ((k.members as string[]) ?? []).join("\n"),
    model_answer: p.modelAnswer ?? "", validator_py: p.validatorPy ?? EMPTY_PUZZLE.validator_py, points_per_entry: p.pointsPerEntry ?? 1, max_entries: p.maxEntries, format_regex: p.formatRegex ?? "", format_hint: p.formatHint ?? "" };
}

function parseTrial(kind: string, s: string): unknown {
  if (["mcq_multi", "sequence", "set"].includes(kind)) { try { return JSON.parse(s); } catch { return s.split(",").map((x) => x.trim()).map((x) => (kind === "set" ? x : Number(x))); } }
  if (kind === "mcq_single") return Number(s);
  return s;
}

// ---------------------------------------------------------------------------

function HackAdmin() {
  const [rows, setRows] = useState<Hack[]>([]);
  const [sel, setSel] = useState<number | "new" | null>(null);
  const load = useCallback(async () => setRows((await api.get<{ questions: Hack[] }>("/api/admin/phase1/hacking")).questions), []);
  useEffect(() => { void load(); }, [load]);
  const current = typeof sel === "number" ? rows.find((r) => r.id === sel) ?? null : null;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader title="Hacking questions" action={<Button size="sm" onClick={() => setSel("new")}>+ New</Button>} />
        <CardBody className="space-y-1 p-2">{rows.map((r) => (
          <button key={r.id} onClick={() => setSel(r.id)} className={`flex w-full items-center justify-between rounded-box px-3 py-2 text-left text-sm ${sel === r.id ? "bg-green-tint font-semibold" : "hover:bg-page"}`}>
            <span>{r.orderIndex}. {r.title}</span>{r.voided ? <Badge tone="red">void</Badge> : r.published ? <Badge tone="green">live</Badge> : r.ready ? <Badge tone="blue">ready</Badge> : <Badge tone="amber">draft</Badge>}
          </button>
        ))}</CardBody>
      </Card>
      <div className="lg:col-span-2">{sel === null ? <EmptyState icon={<Icon.Bug size={22} />} title={rows.length ? "Pick a hacking question" : "No hacking questions yet"} body="Upload the judge package (with a stored reference and validator) on the Problems page first, then reference it here." action={<Button size="sm" onClick={() => setSel("new")}>New hacking question</Button>} /> : <HackEditor key={String(sel)} existing={current} onChange={load} onCreated={setSel} />}</div>
    </div>
  );
}

function HackEditor({ existing, onChange, onCreated }: { existing: Hack | null; onChange: () => Promise<void>; onCreated: (id: number) => void }) {
  const [f, setF] = useState({ title: existing?.title ?? "", statement_md: existing?.statementMd ?? "", constraints_md: existing?.constraintsMd ?? "", problem_id: existing?.problemId ?? "", given_source: existing?.givenSource ?? "", given_language: existing?.givenLanguage ?? "cpp", hack_points: existing?.hackPoints ?? 20, fail_penalty: existing?.failPenalty ?? 0, order_index: existing?.orderIndex ?? 0 });
  const [reason, setReason] = useState(""); const [breaking, setBreaking] = useState("");
  const [msg, setMsg] = useState<{ tone: "success" | "error" | "warning"; text: string } | null>(null);
  async function save() {
    setMsg(null);
    try {
      if (existing) { await api.patch(`/api/admin/phase1/hacking/${existing.id}`, { ...f, reason }); setMsg({ tone: "success", text: "Saved. Prove a breaking input before publishing." }); }
      else { const r = await api.post<{ id: number }>("/api/admin/phase1/hacking", { ...f, reason }); onCreated(r.id); }
      await onChange();
    } catch (err) { setMsg({ tone: "error", text: errorMessage(err) }); }
  }
  async function test() {
    if (!existing) return;
    setMsg(null);
    try { const r = await api.post<{ ready: boolean; detail: string }>(`/api/admin/phase1/hacking/${existing.id}/test`, { breaking_input: breaking }); setMsg({ tone: r.ready ? "success" : "warning", text: r.detail }); await onChange(); }
    catch (err) { setMsg({ tone: "error", text: errorMessage(err) }); }
  }
  return (
    <Card>
      <CardHeader title={existing ? `Edit: ${existing.title}` : "New hacking question"} action={existing && <span className="flex gap-2">
        {existing.published ? <ReasonAction label="Unpublish" title="Unpublish?" onConfirm={async (reason) => { await api.post(`/api/admin/phase1/hacking/${existing.id}/unpublish`, { reason }); await onChange(); }} />
          : <ReasonAction label="Publish" variant="primary" title="Publish?" disabled={!existing.ready} onConfirm={async (reason) => { await api.post(`/api/admin/phase1/hacking/${existing.id}/publish`, { reason }); await onChange(); }} />}
        {!existing.voided && <ReasonAction label="Void" variant="danger" title="Void?" onConfirm={async (reason) => { await api.post(`/api/admin/phase1/hacking/${existing.id}/void`, { reason }); await onChange(); }} />}
      </span>} />
      <CardBody>
        <Alert tone="info">Upload the judge package for this question on the Problems page first: <code>problem.json</code> with <code>hack_only: true</code>, limits, a stored <code>reference</code> solution and a <code>validator.py</code>. Then reference its id here. The reference solution is never in this database.</Alert>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Judge problem id"><Input value={f.problem_id} onChange={(e) => setF({ ...f, problem_id: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Points"><Input type="number" value={f.hack_points} onChange={(e) => setF({ ...f, hack_points: Number(e.target.value) })} /></Field>
            <Field label="Fail penalty"><Input type="number" value={f.fail_penalty} onChange={(e) => setF({ ...f, fail_penalty: Number(e.target.value) })} /></Field>
            <Field label="Order"><Input type="number" value={f.order_index} onChange={(e) => setF({ ...f, order_index: Number(e.target.value) })} /></Field>
          </div>
        </div>
        <Field label="Statement (Markdown)"><Textarea rows={5} value={f.statement_md} onChange={(e) => setF({ ...f, statement_md: e.target.value })} /></Field>
        <Field label="Constraints (Markdown, shown to participants)"><Textarea rows={3} value={f.constraints_md} onChange={(e) => setF({ ...f, constraints_md: e.target.value })} /></Field>
        <div className="grid grid-cols-4 gap-3">
          <Field label="Given solution language"><Select value={f.given_language} onChange={(e) => setF({ ...f, given_language: e.target.value })}>{["cpp", "c", "python", "pypy", "java", "javascript"].map((l) => <option key={l}>{l}</option>)}</Select></Field>
          <div className="col-span-3"><Field label="The given (flawed) solution — shown in full to participants"><Textarea rows={10} className="font-mono text-xs" value={f.given_source} onChange={(e) => setF({ ...f, given_source: e.target.value })} /></Field></div>
        </div>
        <Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        {msg && <div className="mb-3"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
        <div className="flex flex-wrap items-end gap-2">
          <Button onClick={save} disabled={reason.length < 3 || !f.title || !f.problem_id}>{existing ? "Save" : "Create"}</Button>
          {existing && <><Textarea className="w-64" rows={2} placeholder="a known breaking input" value={breaking} onChange={(e) => setBreaking(e.target.value)} /><Button variant="secondary" onClick={test} disabled={!breaking.trim()}>Prove it breaks</Button></>}
        </div>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function Review() {
  const [rows, setRows] = useState<Standing[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const load = useCallback(async () => {
    const r = await api.get<{ standings: Standing[] }>("/api/admin/phase1/advance");
    setRows(r.standings); setChosen(new Set(r.standings.filter((s) => s.advanced).map((s) => s.participant_id)));
  }, []);
  useEffect(() => { void load(); }, [load]);
  const provisional = rows.filter((r) => r.provisional).length;
  if (rows.length === 0) return <EmptyState icon={<Icon.Users size={22} />} title="No participants yet" body="Standings appear once people have registered and Phase 1 has run." />;
  return (
    <div className="space-y-4">
      {provisional > 0 && <Alert tone="warning">{provisional} participant(s) have ungraded items — their totals are provisional. You may still select; grades can follow.</Alert>}
      <Card>
        <CardHeader title="Phase 1 leaderboard — tick who advances" action={<ReasonAction label={`Confirm selection (${chosen.size})`} variant="primary" title="Set who advances to Phase 2" description="Everyone is notified. You can revise this until Phase 2 opens. Announce the basis before Phase 1 if you have not." onConfirm={async (reason) => { await api.post("/api/admin/phase1/advance", { participant_ids: [...chosen], reason }); await load(); }} />} />
        <Table>
          <thead><tr><Th></Th><Th>Rank</Th><Th>Participant</Th><Th>Points</Th><Th>Submitted</Th><Th>Status</Th></tr></thead>
          <tbody>{rows.map((s) => (
            <tr key={s.participant_id} className={s.disqualified ? "opacity-50" : chosen.has(s.participant_id) ? "bg-green-tint" : ""}>
              <Td><input type="checkbox" disabled={s.disqualified} checked={chosen.has(s.participant_id)} onChange={(e) => { const n = new Set(chosen); if (e.target.checked) n.add(s.participant_id); else n.delete(s.participant_id); setChosen(n); }} /></Td>
              <Td className="font-semibold">{s.rank || "—"}</Td><Td>{s.name}</Td>
              <Td className="tabular-nums">{s.points}{s.provisional && "*"}</Td>
              <Td className="text-faint">{s.submitted_at ? new Date(s.submitted_at).toLocaleTimeString() : "never finished"}</Td>
              <Td>{s.disqualified ? <Badge tone="red">disqualified</Badge> : s.advanced === true ? <Badge tone="green">advancing</Badge> : s.advanced === false ? <Badge tone="grey">not selected</Badge> : <Badge tone="amber">undecided</Badge>}</Td>
            </tr>
          ))}</tbody>
        </Table>
      </Card>
    </div>
  );
}
