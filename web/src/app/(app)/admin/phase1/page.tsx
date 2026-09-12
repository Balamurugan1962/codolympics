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
import { Alert } from "@/components/ui/alert";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, SearchInput, Select, Textarea } from "@/components/ui/input";
import { Menu } from "@/components/ui/menu";
import { PageBody, PageHeader, Section, Toolbar } from "@/components/ui/page";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Stat, StatRow } from "@/components/ui/stat";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
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
          ? <Link href="/admin/phase1/puzzles/new"><Button icon={<Icon.Plus size={14} />}>New puzzle</Button></Link>
          : tab === "hacking" ? <Link href="/admin/phase1/hacking/new"><Button icon={<Icon.Plus size={14} />}>New hacking question</Button></Link> : undefined}
      />
      <div className="mb-4">
        <Tabs value={tab} onChange={goTab} tabs={[{ value: "puzzles", label: "Section A · Puzzles" }, { value: "hacking", label: "Section B · Hacking" }, { value: "review", label: "Review & advance" }]} />
      </div>
      {tab === "puzzles" && <PuzzleList />}
      {tab === "hacking" && <HackList />}
      {tab === "review" && <Review />}
    </PageBody>
  );
}

const STATE: Record<QuestionState, { label: string; tone: "green" | "amber" | "blue" | "grey" }> = {
  draft: { label: "Draft", tone: "amber" }, ready: { label: "Ready", tone: "blue" }, live: { label: "Live", tone: "green" }, void: { label: "Void", tone: "grey" },
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
    <Dialog open onClose={onClose} title={copy.title}>
      <p className="mb-4 text-[13px] text-muted">{copy.body}</p>
      <Field label="Reason" help="Recorded in the audit log.">
        <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      </Field>
      {error && <div className="mt-3"><Alert tone="error">{error}</Alert></div>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={copy.danger ? "danger" : "primary"} loading={busy} disabled={reason.trim().length < 3}
          onClick={async () => { setBusy(true); setError(null); try { await run(pending.kind, pending.id, reason.trim()); onClose(); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); } }}>
          {copy.label}
        </Button>
      </div>
    </Dialog>
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
          <Stat label="Live" value={live.length} tone="green" icon={<Icon.Check size={13} />} hint="published and in the section" />
          <Stat label="Points available" value={points} icon={<Icon.Trophy size={13} />} hint="across live puzzles, reasoning included" />
          <Stat label="Need an evaluator" value={live.filter((r) => r.grading === "manual" || r.explainPoints > 0).length} icon={<Icon.Users size={13} />} hint="manually graded or with reasoning" />
        </StatRow>
      )}
      {rows.length === 0 ? (
        <Section padded={false}>
          <EmptyState icon={<Icon.Puzzle size={20} />} title="No puzzles yet" body="Section A is logical puzzles: multiple choice, short answers, sequences, lists — or written answers an evaluator marks. Each must pass its self-test before it can be published."
            action={<Link href="/admin/phase1/puzzles/new"><Button size="sm" icon={<Icon.Plus size={14} />}>Create the first puzzle</Button></Link>} />
        </Section>
      ) : (
        <Section padded={false}>
          <Toolbar actions={<span className="text-[12px] text-muted">{shown.length} of {rows.length}</span>}>
            <SearchInput className="w-64" placeholder="Filter by title" value={filter} onChange={(e) => setFilter(e.target.value)} />
            <div className="w-36">
              <Select value={state} onChange={(e) => setState(e.target.value as typeof state)} aria-label="State">
                <option value="all">All states</option><option value="draft">Draft</option><option value="ready">Ready</option><option value="live">Live</option><option value="void">Void</option>
              </Select>
            </div>
          </Toolbar>
          <Table>
            <thead>
              <tr>
                <Th className="w-12" align="right">#</Th>
                <Th>Puzzle</Th>
                <Th className="hidden md:table-cell">Kind</Th>
                <Th className="hidden lg:table-cell">Graded by</Th>
                <Th align="right">Points</Th>
                <Th>State</Th>
                <Th className="w-12"><span className="sr-only">Actions</span></Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const s = stateOf(r);
                return (
                  <Tr key={r.id} className={r.voided ? "opacity-60" : ""}>
                    <Td align="right" className="text-faint">{r.orderIndex}</Td>
                    <Td>
                      <Link href={`/admin/phase1/puzzles/${r.id}`} className="group block">
                        <div className="font-semibold group-hover:text-green-dark">{r.title}</div>
                        <div className="text-[11.5px] text-faint">{CATEGORY_LABEL[r.category]} · {r.bodyMd.replace(/\s+/g, " ").slice(0, 80)}{r.bodyMd.length > 80 ? "…" : ""}</div>
                      </Link>
                    </Td>
                    <Td className="hidden md:table-cell"><Badge tone="outline">{KIND_LABEL[r.kind]}</Badge></Td>
                    <Td className="hidden text-muted lg:table-cell">{GRADING_LABEL[r.grading]}{r.explainPoints > 0 && <span className="text-faint"> + reasoning</span>}</Td>
                    <Td align="right" className="font-medium">{r.points}{r.explainPoints > 0 && <span className="text-faint"> +{r.explainPoints}</span>}</Td>
                    <Td><StatusDot tone={STATE[s].tone}>{STATE[s].label}</StatusDot></Td>
                    <Td>
                      <Menu items={[
                        { label: "Edit", onSelect: () => router.push(`/admin/phase1/puzzles/${r.id}`) },
                        ...(s === "live" ? [{ label: "Unpublish", onSelect: () => setPending({ kind: "unpublish", id: r.id, title: r.title }) }] : []),
                        ...(s === "ready" ? [{ label: "Publish", onSelect: () => setPending({ kind: "publish", id: r.id, title: r.title }) }] : []),
                        ...(s === "draft" ? [{ label: "Publish (run the self-test first)", disabled: true, onSelect: () => undefined }] : []),
                        ...(!r.voided ? [{ label: "Void", danger: true, onSelect: () => setPending({ kind: "void", id: r.id, title: r.title }) }] : []),
                        ...(!r.published ? [{ label: "Delete", danger: true, onSelect: () => setPending({ kind: "remove", id: r.id, title: r.title }) }] : []),
                      ]} />
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
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
          <Stat label="Live" value={live.length} tone="green" icon={<Icon.Check size={13} />} hint="each proven breakable" />
          <Stat label="Points available" value={live.reduce((s, r) => s + r.hackPoints, 0)} icon={<Icon.Trophy size={13} />} hint="one successful hack per solution" />
        </StatRow>
      )}
      {rows.length === 0 ? (
        <Section padded={false}>
          <EmptyState icon={<Icon.Bug size={20} />} title="No hacking questions yet"
            body="Each one is a problem plus a deliberately flawed solution. The judge package (limits, validator, reference) is uploaded under Problems; the question references it."
            action={<Link href="/admin/phase1/hacking/new"><Button size="sm" icon={<Icon.Plus size={14} />}>Create the first hacking question</Button></Link>} />
        </Section>
      ) : (
        <Section padded={false}>
          <Toolbar actions={<span className="text-[12px] text-muted">{shown.length} of {rows.length}</span>}>
            <SearchInput className="w-64" placeholder="Filter by title or problem id" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </Toolbar>
          <Table>
            <thead>
              <tr>
                <Th className="w-12" align="right">#</Th>
                <Th>Question</Th>
                <Th className="hidden md:table-cell">Judge problem</Th>
                <Th className="hidden sm:table-cell">Language</Th>
                <Th align="right">Points</Th>
                <Th className="hidden lg:table-cell" align="right">Penalty</Th>
                <Th>State</Th>
                <Th className="w-12"><span className="sr-only">Actions</span></Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const s = stateOf(r);
                return (
                  <Tr key={r.id} className={r.voided ? "opacity-60" : ""}>
                    <Td align="right" className="text-faint">{r.orderIndex}</Td>
                    <Td>
                      <Link href={`/admin/phase1/hacking/${r.id}`} className="group block">
                        <div className="font-semibold group-hover:text-green-dark">{r.title}</div>
                        <div className="text-[11.5px] text-faint">{r.statementMd.replace(/\s+/g, " ").slice(0, 80)}{r.statementMd.length > 80 ? "…" : ""}</div>
                      </Link>
                    </Td>
                    <Td className="hidden font-mono text-[12px] md:table-cell">{r.problemId}</Td>
                    <Td className="hidden text-muted sm:table-cell">{r.givenLanguage}</Td>
                    <Td align="right" className="font-medium">{r.hackPoints}</Td>
                    <Td align="right" className="hidden text-muted lg:table-cell">{r.failPenalty ? `−${r.failPenalty}` : "0"}</Td>
                    <Td><StatusDot tone={STATE[s].tone}>{STATE[s].label}</StatusDot></Td>
                    <Td>
                      <Menu items={[
                        { label: "Edit", onSelect: () => router.push(`/admin/phase1/hacking/${r.id}`) },
                        ...(s === "live" ? [{ label: "Unpublish", onSelect: () => setPending({ kind: "unpublish", id: r.id, title: r.title }) }] : []),
                        ...(s === "ready" ? [{ label: "Publish", onSelect: () => setPending({ kind: "publish", id: r.id, title: r.title }) }] : []),
                        ...(s === "draft" ? [{ label: "Publish (prove a breaking input first)", disabled: true, onSelect: () => undefined }] : []),
                        ...(!r.voided ? [{ label: "Void", danger: true, onSelect: () => setPending({ kind: "void", id: r.id, title: r.title }) }] : []),
                      ]} />
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
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
        <Stat label="Provisional" value={provisional} tone={provisional ? "amber" : "ink"} icon={<Icon.Clock size={13} />} hint={provisional ? "items still with an evaluator" : "every item graded"} />
        <Stat label="Selected" value={chosen.size} tone="green" icon={<Icon.Check size={13} />} hint={dirty ? "unsaved selection" : `${decided} decided so far`} />
        <Stat label="Top score" value={rows[0]?.points ?? 0} icon={<Icon.Trophy size={13} />} hint={rows[0]?.name} />
      </StatRow>
      {provisional > 0 && <Alert tone="warning" title={`${provisional} participant${provisional === 1 ? " has" : "s have"} ungraded items`}>Their totals are provisional. You may still select; grades can follow and the selection can be revised until Phase 2 opens.</Alert>}
      <Section
        title="Who advances"
        description="Tick the finalists. Everyone is notified when you confirm; the selection can be revised until Phase 2 opens."
        actions={
          <div className="flex items-center gap-2">
            <input type="number" min={1} className="h-8 w-20 rounded-box border border-line-2 px-2 text-[13px]" placeholder="Top N" value={topN} onChange={(e) => setTopN(e.target.value)} aria-label="Select the top N" />
            <Button size="sm" variant="secondary" onClick={pickTop} disabled={!Number(topN)}>Select top {topN || "N"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setChosen(new Set())}>Clear</Button>
          </div>
        }
        padded={false}
        footer={
          <ReasonAction label={`Confirm selection · ${chosen.size}`} variant="primary" size="md" title="Set who advances to Phase 2"
            description={<span><strong>{chosen.size}</strong> participant{chosen.size === 1 ? "" : "s"} will be selected; everyone else is marked not selected. Announce the basis before Phase 1 if you have not.</span>}
            onConfirm={async (reason) => { await api.post("/api/admin/phase1/advance", { participant_ids: [...chosen], reason }); toast({ title: "Selection saved", description: "Participants have been notified.", tone: "success" }); await load(); }} />
        }
      >
        <Table>
          <thead>
            <tr>
              <Th className="w-10"><span className="sr-only">Select</span></Th>
              <Th className="w-16" align="right">Rank</Th>
              <Th>Participant</Th>
              <Th align="right">Points</Th>
              <Th className="hidden sm:table-cell">Submitted</Th>
              <Th>Decision</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <Tr key={s.participant_id} selected={chosen.has(s.participant_id)} className={s.disqualified ? "opacity-50" : ""}>
                <Td><input type="checkbox" className="h-4 w-4 accent-green" disabled={s.disqualified} checked={chosen.has(s.participant_id)} onChange={(e) => toggle(s.participant_id, e.target.checked)} aria-label={`Select ${s.name}`} /></Td>
                <Td align="right" className="font-semibold">{s.rank || "—"}</Td>
                <Td className="font-medium">{s.name}</Td>
                <Td align="right" className="font-semibold">{s.points}{s.provisional && <span className="ml-1 text-faint" title="provisional">*</span>}</Td>
                <Td className="hidden text-faint sm:table-cell">{s.submitted_at ? new Date(s.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "never finished"}</Td>
                <Td>{s.disqualified ? <StatusDot tone="red">Disqualified</StatusDot> : s.advanced === true ? <StatusDot tone="green">Advancing</StatusDot> : s.advanced === false ? <StatusDot tone="grey">Not selected</StatusDot> : <StatusDot tone="amber">Undecided</StatusDot>}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Section>
    </div>
  );
}
