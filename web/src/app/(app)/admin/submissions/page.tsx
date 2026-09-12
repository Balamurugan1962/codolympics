"use client";

/** Every submission with full jury detail, for "my code works" disputes (US-F9-06). */
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { Badge, VerdictBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Table, Td, Th } from "@/components/ui/table";
import { api } from "@/lib/client";

type S = { id: number; name: string; participant_id: string; question_id: string; title: string; language: string; created_at: string; judgement: { state: string; verdict: string | null; firstFail: number | null; passed: number | null; total: number | null; juryDetail: string | null; message: string | null; problemVersion: string | null; attempt: number; maxTimeMs: number | null } };
type Detail = { submission: { source: string; language: string }; judgements: { attempt: number; verdict: string | null; message: string | null; juryDetail: string | null; problemVersion: string | null; supersededAt: string | null; compileOutput: string | null }[]; failing_testcase: { input: string; answer: string; truncated: boolean; version: string } | null };

export default function SubmissionsPage() {
  const [rows, setRows] = useState<S[] | null>(null);
  const [filter, setFilter] = useState("");
  const [onlyIE, setOnlyIE] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  useEffect(() => { void api.get<{ submissions: S[] }>("/api/admin/submissions").then((r) => setRows(r.submissions)); }, []);
  useEffect(() => { if (open) void api.get<Detail>(`/api/admin/submissions/${open}`).then(setDetail); else setDetail(null); }, [open]);
  const shown = (rows ?? []).filter((r) => (!filter || r.name.toLowerCase().includes(filter.toLowerCase()) || r.question_id.includes(filter)) && (!onlyIE || r.judgement.verdict === "IE"));

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Submissions" description="Everything with jury detail — the expected output participants never see. Use it to answer 'my code works'."
        actions={<><label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" className="accent-green" checked={onlyIE} onChange={(e) => setOnlyIE(e.target.checked)} /> Internal errors only</label><Input className="w-56" placeholder="Filter by name or question" value={filter} onChange={(e) => setFilter(e.target.value)} /></>} />
      {!rows ? <CardSkeleton lines={8} /> : shown.length === 0 ? <EmptyState icon={<Icon.Code size={22} />} title="No submissions" body={filter || onlyIE ? "Nothing matches the filter." : "Nothing has been submitted yet."} /> : (
        <Card>
          <Table>
            <thead><tr><Th>#</Th><Th>Time</Th><Th>Participant</Th><Th>Question</Th><Th>Verdict</Th><Th className="hidden md:table-cell">Tests</Th><Th className="hidden lg:table-cell">Jury detail</Th><Th></Th></tr></thead>
            <tbody>{shown.map((s) => (
              <tr key={s.id} className={`${s.judgement.verdict === "IE" ? "bg-red-tint/50" : ""} ${open === s.id ? "bg-green-tint/60" : ""}`}>
                <Td className="text-faint">{s.id}</Td><Td className="whitespace-nowrap text-faint">{new Date(s.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Td><Td>{s.name}</Td><Td>{s.title}</Td>
                <Td><div className="flex items-center gap-1"><VerdictBadge verdict={s.judgement.state === "done" ? s.judgement.verdict : null} />{s.judgement.attempt > 1 && <Badge tone="blue">×{s.judgement.attempt}</Badge>}</div></Td>
                <Td className="hidden tabular-nums md:table-cell">{s.judgement.passed ?? "—"}/{s.judgement.total ?? "—"}{s.judgement.firstFail !== null && <span className="text-faint"> · @{s.judgement.firstFail}</span>}</Td>
                <Td className="hidden max-w-xs truncate font-mono text-xs text-muted lg:table-cell" title={s.judgement.juryDetail ?? ""}>{s.judgement.juryDetail}</Td>
                <Td><Button size="sm" variant="ghost" onClick={() => setOpen(open === s.id ? null : s.id)}>{open === s.id ? "Close" : "Inspect"}</Button></Td>
              </tr>
            ))}</tbody>
          </Table>
        </Card>
      )}
      {open && detail && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardHeader title={`Source · ${detail.submission.language}`} /><pre className="max-h-96 overflow-auto bg-[#1e1e1e] p-3 text-xs text-white">{detail.submission.source}</pre></Card>
          <div className="space-y-4">
            <Card>
              <CardHeader title="Judgements" description="Newest first. Superseded ones are kept for the record." />
              <CardBody className="space-y-2 text-sm">{detail.judgements.map((j) => (
                <div key={j.attempt} className={`rounded-box border border-line p-3 ${j.supersededAt ? "opacity-60" : ""}`}>
                  <div className="flex items-center gap-2"><VerdictBadge verdict={j.verdict} /><span className="text-muted">attempt {j.attempt} · version {j.problemVersion ?? "?"}</span>{j.supersededAt && <Badge tone="grey">superseded</Badge>}</div>
                  <div className="mt-1">{j.message}</div>
                  {j.juryDetail && <div className="mt-1 font-mono text-xs text-red">{j.juryDetail}</div>}
                  {j.compileOutput && <pre className="mt-1 max-h-24 overflow-auto rounded bg-page p-2 text-xs">{j.compileOutput}</pre>}
                </div>
              ))}</CardBody>
            </Card>
            {detail.failing_testcase && (
              <Card>
                <CardHeader title={`Failing testcase · ${detail.failing_testcase.version}`} description={detail.failing_testcase.truncated ? "truncated to 1 MB" : "at the version this submission was judged against"} />
                <CardBody className="grid grid-cols-2 gap-2"><div><div className="mb-1 text-xs font-semibold text-muted">Input</div><pre className="max-h-48 overflow-auto rounded-box bg-page p-2 text-xs">{detail.failing_testcase.input}</pre></div><div><div className="mb-1 text-xs font-semibold text-muted">Expected</div><pre className="max-h-48 overflow-auto rounded-box bg-page p-2 text-xs">{detail.failing_testcase.answer}</pre></div></CardBody>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
