"use client";

/**
 * Phase 1: the puzzle set, the hacking set, and the review that decides who
 * advances. Each question moves draft → ready → live; nothing goes live
 * without passing its self-test.
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CATEGORY_LABEL, GRADING_LABEL, KIND_LABEL, stateOf, type Hack, type Puzzle, type QuestionState, type Standing } from "@/components/admin/phase1-types";
import { Icon } from "@/components/icons";
import { ReasonAction } from "@/components/reason-action";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, SearchInput } from "@/components/ui/field";
import { SimpleSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Menu } from "@/components/ui/menu";
import { PageBody, PageHeader, Section, Toolbar } from "@/components/ui/page";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Stat, StatRow } from "@/components/ui/stat";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

type Tab = "puzzles" | "hacking" | "review";

export default function Phase1AdminPage() {
  const search = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>((search.get("tab") as Tab) || "puzzles");
  function goTab(t: Tab) { setTab(t); router.replace(`/admin/phase1?tab=${t}`, { scroll: false }); }
  return (
    <PageBody width="wide">
      <PageHeader
        title="Phase 1"
        description="The qualifying round: Section A puzzles, then Section B hacking. Author each question, prove it works, publish it. After the round, select who advances."
        actions={tab === "puzzles"
          ? <Button asChild><Link href="/admin/phase1/puzzles/new"><Icon.Plus size={14} /> New puzzle</Link></Button>
          : tab === "hacking" ? <Button asChild><Link href="/admin/phase1/hacking/new"><Icon.Plus size={14} /> New hacking question</Link></Button> : undefined}
      />
      <Tabs value={tab} onValueChange={(v) => goTab(v as Tab)}>
        <TabsList variant="line" className="mb-5 w-full justify-start border-b">
          <TabsTrigger value="puzzles">Section A · Puzzles</TabsTrigger>
          <TabsTrigger value="hacking">Section B · Hacking</TabsTrigger>
          <TabsTrigger value="review">Review &amp; advance</TabsTrigger>
        </TabsList>
        <TabsContent value="puzzles">{tab === "puzzles" && <PuzzleList />}</TabsContent>
        <TabsContent value="hacking">{tab === "hacking" && <HackList />}</TabsContent>
        <TabsContent value="review">{tab === "review" && <Review />}</TabsContent>
      </Tabs>
    </PageBody>
  );
}

const STATE: Record<QuestionState, { label: string; tone: "success" | "warning" | "info" | "neutral" }> = {
  draft: { label: "Draft", tone: "warning" }, ready: { label: "Ready", tone: "info" }, live: { label: "Live", tone: "success" }, void: { label: "Void", tone: "neutral" },
};

function useQuestionActions(section: "puzzles" | "hacking", reload: () => Promise<void>) {
  const { toast } = useToast();
  return {
    publish: async (id: number, reason: string) => { await api.post(`/api/admin/phase1/${section}/${id}/publish`, { reason }); toast({ title: "Published", tone: "success" }); await reload(); },
    unpublish: async (id: number, reason: string) => { await api.post(`/api/admin/phase1/${section}/${id}/unpublish`, { reason }); toast({ title: "Unpublished", tone: "success" }); await reload(); },
    void: async (id: number, reason: string) => { await api.post(`/api/admin/phase1/${section}/${id}/void`, { reason }); toast({ title: "Voided", tone: "success" }); await reload(); },
    remove: async (id: number, reason: string) => { await api.del(`/api/admin/phase1/${section}/${id}`, { reason }); toast({ title: "Deleted", tone: "success" }); await reload(); },
  };
}

type Pending = { kind: "publish" | "unpublish" | "void" | "remove"; id: number; title: string };

function ActionDialog({ pending, onClose, run }: { pending: Pending | null; onClose: () => void; run: (kind: Pending["kind"], id: number, reason: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setReason(""); setError(null); }, [pending]);
  if (!pending) return null;
  const copy = {
    publish: { title: `Publish “${pending.title}”?`, body: "Participants see it as soon as the section opens. It has passed its self-test.", label: "Publish", danger: false },
    unpublish: { title: `Unpublish “${pending.title}”?`, body: "It disappears from the section. Answers already saved are kept.", label: "Unpublish", danger: false },
    void: { title: `Void “${pending.title}”?`, body: "It scores for nobody and every total is recomputed. This cannot be undone.", label: "Void", danger: true },
    remove: { title: `Delete “${pending.title}”?`, body: "Only drafts can be deleted. This cannot be undone.", label: "Delete", danger: true },
  }[pending.kind];
  return (
    <Modal open onClose={onClose} title={copy.title}>
      <p className="mb-4 text-[13px] text-muted-foreground">{copy.body}</p>
      <Field label="Reason" help="Recorded in the audit log.">
        <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      </Field>
      {error && <div className="mt-3"><Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert></div>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button variant={copy.danger ? "destructive" : "default"} loading={busy} disabled={reason.trim().length < 3}
          onClick={async () => { setBusy(true); setError(null); try { await run(pending.kind, pending.id, reason.trim()); onClose(); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); } }}>
          {copy.label}
        </Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function PuzzleList() {
  const router = useRouter();
  const [rows, setRows] = useState<Puzzle[] | null>(null);
  const [filter, setFilter] = useState("");
  const [state, setState] = useState<"all" | QuestionState>("all");
  const [pending, setPending] = useState<Pending | null>(null);
  const load = useCallback(async () => setRows((await api.get<{ questions: Puzzle[] }>("/api/admin/phase1/puzzles")).questions), []);
  useEffect(() => { void load(); }, [load]);
  const act = useQuestionActions("puzzles", load);

  if (!rows) return <CardSkeleton lines={8} />;
  const shown = rows.filter((r) => state === "all" || stateOf(r) === state).filter((r) => !filter || r.title.toLowerCase().includes(filter.toLowerCase()));
  const live = rows.filter((r) => stateOf(r) === "live");
  const points = live.reduce((s, r) => s + r.points + r.explainPoints, 0);

  return (
    <div className="space-y-4">
      {rows.length > 0 && (
        <StatRow cols={4}>
          <Stat label="Puzzles" value={rows.length} icon={<Icon.Puzzle size={13} />} hint={`${rows.filter((r) => stateOf(r) === "draft").length} still draft`} />
          <Stat label="Live" value={live.length} tone="success" icon={<Icon.Check size={13} />} hint="published and in the section" />
          <Stat label="Points available" value={points} icon={<Icon.Trophy size={13} />} hint="across live puzzles, reasoning included" />
          <Stat label="Need an evaluator" value={live.filter((r) => r.grading === "manual" || r.explainPoints > 0).length} icon={<Icon.Users size={13} />} hint="manually graded or with reasoning" />
        </StatRow>
      )}
      {rows.length === 0 ? (
        <Section padded={false}>
          <EmptyState icon={<Icon.Puzzle size={20} />} title="No puzzles yet" body="Section A is logical puzzles: multiple choice, short answers, sequences, lists — or written answers an evaluator marks. Each must pass its self-test before it can be published."
            action={<Link href="/admin/phase1/puzzles/new"><Button size="sm"><Icon.Plus size={14} /> Create the first puzzle</Button></Link>} />
        </Section>
      ) : (
        <Section padded={false}>
          <Toolbar actions={<span className="text-[12px] text-muted-foreground">{shown.length} of {rows.length}</span>}>
            <SearchInput className="w-64" placeholder="Filter by title" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <SimpleSelect className="w-36" value={state} onValueChange={setState} aria-label="State"
              options={[{ value: "all", label: "All states" }, { value: "draft", label: "Draft" }, { value: "ready", label: "Ready" }, { value: "live", label: "Live" }, { value: "void", label: "Void" }]} />
          </Toolbar>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-right tabular-nums">#</TableHead>
                <TableHead>Puzzle</TableHead>
                <TableHead className="hidden md:table-cell">Kind</TableHead>
                <TableHead className="hidden lg:table-cell">Graded by</TableHead>
                <TableHead className="text-right tabular-nums">Points</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => {
                const s = stateOf(r);
                return (
                  <TableRow key={r.id} className={r.voided ? "opacity-60" : ""}>
                    <TableCell className="text-faint text-right tabular-nums">{r.orderIndex}</TableCell>
                    <TableCell>
                      <Link href={`/admin/phase1/puzzles/${r.id}`} className="group block">
                        <div className="font-semibold group-hover:text-brand-dark">{r.title}</div>
                        <div className="text-[11.5px] text-faint">{CATEGORY_LABEL[r.category]} · {r.bodyMd.replace(/\s+/g, " ").slice(0, 80)}{r.bodyMd.length > 80 ? "…" : ""}</div>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell"><Badge variant="outline">{KIND_LABEL[r.kind]}</Badge></TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{GRADING_LABEL[r.grading]}{r.explainPoints > 0 && <span className="text-faint"> + reasoning</span>}</TableCell>
                    <TableCell className="font-medium text-right tabular-nums">{r.points}{r.explainPoints > 0 && <span className="text-faint"> +{r.explainPoints}</span>}</TableCell>
                    <TableCell><StatusDot tone={STATE[s].tone}>{STATE[s].label}</StatusDot></TableCell>
                    <TableCell>
                      <Menu items={[
                        { label: "Edit", onSelect: () => router.push(`/admin/phase1/puzzles/${r.id}`) },
                        ...(s === "live" ? [{ label: "Unpublish", onSelect: () => setPending({ kind: "unpublish", id: r.id, title: r.title }) }] : []),
                        ...(s === "ready" ? [{ label: "Publish", onSelect: () => setPending({ kind: "publish", id: r.id, title: r.title }) }] : []),
                        ...(s === "draft" ? [{ label: "Publish (run the self-test first)", disabled: true, onSelect: () => undefined }] : []),
                        ...(!r.voided ? [{ label: "Void", danger: true, onSelect: () => setPending({ kind: "void", id: r.id, title: r.title }) }] : []),
                        ...(!r.published ? [{ label: "Delete", danger: true, onSelect: () => setPending({ kind: "remove", id: r.id, title: r.title }) }] : []),
                      ]} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {shown.length === 0 && <EmptyState compact title="Nothing matches" body="Try another filter." />}
        </Section>
      )}
      <ActionDialog pending={pending} onClose={() => setPending(null)} run={(k, id, reason) => act[k](id, reason)} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function HackList() {
  const router = useRouter();
  const [rows, setRows] = useState<Hack[] | null>(null);
  const [filter, setFilter] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const load = useCallback(async () => setRows((await api.get<{ questions: Hack[] }>("/api/admin/phase1/hacking")).questions), []);
  useEffect(() => { void load(); }, [load]);
  const act = useQuestionActions("hacking", load);

  if (!rows) return <CardSkeleton lines={8} />;
  const shown = rows.filter((r) => !filter || r.title.toLowerCase().includes(filter.toLowerCase()) || r.problemId.includes(filter));
  const live = rows.filter((r) => stateOf(r) === "live");

  return (
    <div className="space-y-4">
      {rows.length > 0 && (
        <StatRow cols={3}>
          <Stat label="Hacking questions" value={rows.length} icon={<Icon.Bug size={13} />} hint={`${rows.filter((r) => stateOf(r) === "draft").length} still draft`} />
          <Stat label="Live" value={live.length} tone="success" icon={<Icon.Check size={13} />} hint="each proven breakable" />
          <Stat label="Points available" value={live.reduce((s, r) => s + r.hackPoints, 0)} icon={<Icon.Trophy size={13} />} hint="one successful hack per solution" />
        </StatRow>
      )}
      {rows.length === 0 ? (
        <Section padded={false}>
          <EmptyState icon={<Icon.Bug size={20} />} title="No hacking questions yet"
            body="Each one is a problem plus a deliberately flawed solution. The judge package (limits, validator, reference) is uploaded under Problems; the question references it."
            action={<Link href="/admin/phase1/hacking/new"><Button size="sm"><Icon.Plus size={14} /> Create the first hacking question</Button></Link>} />
        </Section>
      ) : (
        <Section padded={false}>
          <Toolbar actions={<span className="text-[12px] text-muted-foreground">{shown.length} of {rows.length}</span>}>
            <SearchInput className="w-64" placeholder="Filter by title or problem id" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </Toolbar>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-right tabular-nums">#</TableHead>
                <TableHead>Question</TableHead>
                <TableHead className="hidden md:table-cell">Judge problem</TableHead>
                <TableHead className="hidden sm:table-cell">Language</TableHead>
                <TableHead className="text-right tabular-nums">Points</TableHead>
                <TableHead className="hidden lg:table-cell text-right tabular-nums">Penalty</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => {
                const s = stateOf(r);
                return (
                  <TableRow key={r.id} className={r.voided ? "opacity-60" : ""}>
                    <TableCell className="text-faint text-right tabular-nums">{r.orderIndex}</TableCell>
                    <TableCell>
                      <Link href={`/admin/phase1/hacking/${r.id}`} className="group block">
                        <div className="font-semibold group-hover:text-brand-dark">{r.title}</div>
                        <div className="text-[11.5px] text-faint">{r.statementMd.replace(/\s+/g, " ").slice(0, 80)}{r.statementMd.length > 80 ? "…" : ""}</div>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden font-mono text-[12px] md:table-cell">{r.problemId}</TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">{r.givenLanguage}</TableCell>
                    <TableCell className="font-medium text-right tabular-nums">{r.hackPoints}</TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell text-right tabular-nums">{r.failPenalty ? `−${r.failPenalty}` : "0"}</TableCell>
                    <TableCell><StatusDot tone={STATE[s].tone}>{STATE[s].label}</StatusDot></TableCell>
                    <TableCell>
                      <Menu items={[
                        { label: "Edit", onSelect: () => router.push(`/admin/phase1/hacking/${r.id}`) },
                        ...(s === "live" ? [{ label: "Unpublish", onSelect: () => setPending({ kind: "unpublish", id: r.id, title: r.title }) }] : []),
                        ...(s === "ready" ? [{ label: "Publish", onSelect: () => setPending({ kind: "publish", id: r.id, title: r.title }) }] : []),
                        ...(s === "draft" ? [{ label: "Publish (prove a breaking input first)", disabled: true, onSelect: () => undefined }] : []),
                        ...(!r.voided ? [{ label: "Void", danger: true, onSelect: () => setPending({ kind: "void", id: r.id, title: r.title }) }] : []),
                      ]} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {shown.length === 0 && <EmptyState compact title="Nothing matches" body="Try another filter." />}
        </Section>
      )}
      <ActionDialog pending={pending} onClose={() => setPending(null)} run={(k, id, reason) => act[k](id, reason)} />
    </div>
  );
}

// ---------------------------------------------------------------------------

function Review() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Standing[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [topN, setTopN] = useState("");
  const load = useCallback(async () => {
    const r = await api.get<{ standings: Standing[] }>("/api/admin/phase1/advance");
    setRows(r.standings); setChosen(new Set(r.standings.filter((s) => s.advanced).map((s) => s.participant_id)));
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (!rows) return <CardSkeleton lines={8} />;
  if (rows.length === 0) return <Section padded={false}><EmptyState icon={<Icon.Users size={20} />} title="No participants yet" body="Standings appear once people have registered and Phase 1 has run." /></Section>;

  const provisional = rows.filter((r) => r.provisional).length;
  const decided = rows.filter((r) => r.advanced !== null).length;
  const eligible = rows.filter((r) => !r.disqualified);
  const dirty = JSON.stringify([...chosen].sort()) !== JSON.stringify(rows.filter((s) => s.advanced).map((s) => s.participant_id).sort());
  const toggle = (id: string, on: boolean) => { const n = new Set(chosen); if (on) n.add(id); else n.delete(id); setChosen(n); };
  const pickTop = () => { const n = Number(topN); if (!n) return; setChosen(new Set(eligible.filter((r) => r.rank >= 1 && r.rank <= n).map((r) => r.participant_id))); };

  return (
    <div className="space-y-4">
      <StatRow cols={4}>
        <Stat label="Participants" value={rows.length} icon={<Icon.Users size={13} />} hint={`${rows.filter((r) => r.disqualified).length} disqualified`} />
        <Stat label="Provisional" value={provisional} tone={provisional ? "warning" : "default"} icon={<Icon.Clock size={13} />} hint={provisional ? "items still with an evaluator" : "every item graded"} />
        <Stat label="Selected" value={chosen.size} tone="success" icon={<Icon.Check size={13} />} hint={dirty ? "unsaved selection" : `${decided} decided so far`} />
        <Stat label="Top score" value={rows[0]?.points ?? 0} icon={<Icon.Trophy size={13} />} hint={rows[0]?.name} />
      </StatRow>
      {provisional > 0 && <Alert variant="warning"><AlertTitle>{`${provisional} participant${provisional === 1 ? " has" : "s have"} ungraded items`}</AlertTitle><AlertDescription>Their totals are provisional. You may still select; grades can follow and the selection can be revised until Phase 2 opens.</AlertDescription></Alert>}
      <Section
        title="Who advances"
        description="Tick the finalists. Everyone is notified when you confirm; the selection can be revised until Phase 2 opens."
        actions={
          <div className="flex items-center gap-2">
            <input type="number" min={1} className="h-8 w-20 rounded-box border border-line-2 px-2 text-[13px]" placeholder="Top N" value={topN} onChange={(e) => setTopN(e.target.value)} aria-label="Select the top N" />
            <Button size="sm" variant="outline" onClick={pickTop} disabled={!Number(topN)}>Select top {topN || "N"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setChosen(new Set())}>Clear</Button>
          </div>
        }
        padded={false}
        footer={
          <ReasonAction label={`Confirm selection · ${chosen.size}`} variant="default" size="default" title="Set who advances to Phase 2"
            description={<span><strong>{chosen.size}</strong> participant{chosen.size === 1 ? "" : "s"} will be selected; everyone else is marked not selected. Announce the basis before Phase 1 if you have not.</span>}
            onConfirm={async (reason) => { await api.post("/api/admin/phase1/advance", { participant_ids: [...chosen], reason }); toast({ title: "Selection saved", description: "Participants have been notified.", tone: "success" }); await load(); }} />
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><span className="sr-only">Select</span></TableHead>
              <TableHead className="w-16 text-right tabular-nums">Rank</TableHead>
              <TableHead>Participant</TableHead>
              <TableHead className="text-right tabular-nums">Points</TableHead>
              <TableHead className="hidden sm:table-cell">Submitted</TableHead>
              <TableHead>Decision</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.participant_id} data-state={chosen.has(s.participant_id) ? "selected" : undefined} className={s.disqualified ? "opacity-50" : ""}>
                <TableCell><input type="checkbox" className="h-4 w-4 accent-brand" disabled={s.disqualified} checked={chosen.has(s.participant_id)} onChange={(e) => toggle(s.participant_id, e.target.checked)} aria-label={`Select ${s.name}`} /></TableCell>
                <TableCell className="font-semibold text-right tabular-nums">{s.rank || "—"}</TableCell>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="font-semibold text-right tabular-nums">{s.points}{s.provisional && <span className="ml-1 text-faint" title="provisional">*</span>}</TableCell>
                <TableCell className="hidden text-faint sm:table-cell">{s.submitted_at ? new Date(s.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "never finished"}</TableCell>
                <TableCell>{s.disqualified ? <StatusDot tone="destructive">Disqualified</StatusDot> : s.advanced === true ? <StatusDot tone="success">Advancing</StatusDot> : s.advanced === false ? <StatusDot tone="neutral">Not selected</StatusDot> : <StatusDot tone="warning">Undecided</StatusDot>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
    </div>
  );
}
