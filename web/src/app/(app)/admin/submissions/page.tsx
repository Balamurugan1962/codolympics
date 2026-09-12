"use client";

/** Every submission with full jury detail, for "my code works" disputes (US-F9-06). */
import { useEffect, useState } from "react";

import { Badge, VerdictBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { api } from "@/lib/client";

type S = { id: number; name: string; participant_id: string; question_id: string; title: string; language: string; created_at: string; judgement: { state: string; verdict: string | null; firstFail: number | null; passed: number | null; total: number | null; juryDetail: string | null; message: string | null; problemVersion: string | null; attempt: number; maxTimeMs: number | null } };
type Detail = { submission: { source: string; language: string }; judgements: { attempt: number; verdict: string | null; message: string | null; juryDetail: string | null; problemVersion: string | null; supersededAt: string | null; compileOutput: string | null }[]; failing_testcase: { input: string; answer: string; truncated: boolean; version: string } | null };

export default function SubmissionsPage() {
  const [rows, setRows] = useState<S[]>([]);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  useEffect(() => { void api.get<{ submissions: S[] }>("/api/admin/submissions").then((r) => setRows(r.submissions)); }, []);
  useEffect(() => { if (open) void api.get<Detail>(`/api/admin/submissions/${open}`).then(setDetail); else setDetail(null); }, [open]);
  const shown = rows.filter((r) => !filter || r.name.toLowerCase().includes(filter.toLowerCase()) || r.question_id.includes(filter));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Submissions" action={<Input className="w-64" placeholder="filter by name or question" value={filter} onChange={(e) => setFilter(e.target.value)} />} />
        <Table>
          <thead><tr><Th>#</Th><Th>Time</Th><Th>Participant</Th><Th>Question</Th><Th>Verdict</Th><Th>Tests</Th><Th>Jury detail</Th><Th></Th></tr></thead>
          <tbody>{shown.map((s) => (
            <tr key={s.id} className={s.judgement.verdict === "IE" ? "bg-red-tint" : ""}>
              <Td>{s.id}</Td><Td className="text-faint">{new Date(s.created_at).toLocaleTimeString()}</Td><Td>{s.name}</Td><Td>{s.title}</Td>
              <Td><VerdictBadge verdict={s.judgement.state === "done" ? s.judgement.verdict : null} />{s.judgement.attempt > 1 && <Badge tone="blue" className="ml-1">rejudged ×{s.judgement.attempt - 1}</Badge>}</Td>
              <Td className="tabular-nums">{s.judgement.passed ?? "—"}/{s.judgement.total ?? "—"}{s.judgement.firstFail !== null && <span className="text-faint"> · fail @{s.judgement.firstFail}</span>}</Td>
              <Td className="max-w-xs truncate font-mono text-xs text-muted" title={s.judgement.juryDetail ?? ""}>{s.judgement.juryDetail}</Td>
              <Td><Button size="sm" variant="ghost" onClick={() => setOpen(open === s.id ? null : s.id)}>{open === s.id ? "Close" : "Inspect"}</Button></Td>
            </tr>
          ))}</tbody>
        </Table>
      </Card>
      {open && detail && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardHeader title={`Source (${detail.submission.language})`} /><pre className="max-h-96 overflow-auto bg-navy p-3 text-xs text-white">{detail.submission.source}</pre></Card>
          <div className="space-y-4">
            <Card>
              <CardHeader title="Judgements (newest first; history kept)" />
              <CardBody className="space-y-2 text-sm">{detail.judgements.map((j) => (
                <div key={j.attempt} className={`rounded-box border border-line p-2 ${j.supersededAt ? "opacity-60" : ""}`}>
                  <div className="flex items-center gap-2"><VerdictBadge verdict={j.verdict} /><span>attempt {j.attempt} · version {j.problemVersion ?? "?"}</span>{j.supersededAt && <Badge tone="grey">superseded</Badge>}</div>
                  <div className="mt-1 text-muted">{j.message}</div>
                  {j.juryDetail && <div className="mt-1 font-mono text-xs text-red">{j.juryDetail}</div>}
                  {j.compileOutput && <pre className="mt-1 max-h-24 overflow-auto text-xs">{j.compileOutput}</pre>}
                </div>
              ))}</CardBody>
            </Card>
            {detail.failing_testcase && (
              <Card>
                <CardHeader title={`Failing testcase at ${detail.failing_testcase.version}${detail.failing_testcase.truncated ? " (truncated)" : ""}`} />
                <CardBody className="grid grid-cols-2 gap-2"><pre className="max-h-48 overflow-auto rounded-box bg-page p-2 text-xs">{detail.failing_testcase.input}</pre><pre className="max-h-48 overflow-auto rounded-box bg-page p-2 text-xs">{detail.failing_testcase.answer}</pre></CardBody>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
