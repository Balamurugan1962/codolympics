"use client";

/**
 * Submissions, with the jury detail participants never see. Inspecting one
 * opens a drawer so the list stays where it was — you are usually comparing
 * several when someone says "my code works".
 */
import { useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { Badge, VerdictBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox, SearchInput } from "@/components/ui/input";
import { PageBody, PageHeader, Section, Toolbar } from "@/components/ui/page";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { api } from "@/lib/client";

type S = { id: number; name: string; participant_id: string; question_id: string; title: string; language: string; created_at: string; judgement: { state: string; verdict: string | null; firstFail: number | null; passed: number | null; total: number | null; juryDetail: string | null; message: string | null; problemVersion: string | null; attempt: number; maxTimeMs: number | null } };
type Detail = { submission: { source: string; language: string }; judgements: { attempt: number; verdict: string | null; message: string | null; juryDetail: string | null; problemVersion: string | null; supersededAt: string | null; compileOutput: string | null }[]; failing_testcase: { input: string; answer: string; truncated: boolean; version: string } | null };

export default function SubmissionsPage() {
  const [rows, setRows] = useState<S[] | null>(null);
  const [filter, setFilter] = useState("");
  const [onlyIE, setOnlyIE] = useState(false);
  const [open, setOpen] = useState<S | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

  useEffect(() => { void api.get<{ submissions: S[] }>("/api/admin/submissions").then((r) => setRows(r.submissions)); }, []);
  useEffect(() => { setDetail(null); if (open) void api.get<Detail>(`/api/admin/submissions/${open.id}`).then(setDetail); }, [open]);

  const all = rows ?? [];
  const shown = all.filter((r) =>
    (!filter || r.name.toLowerCase().includes(filter.toLowerCase()) || r.question_id.includes(filter.toLowerCase())) &&
    (!onlyIE || r.judgement.verdict === "IE"));
  const ieCount = all.filter((r) => r.judgement.verdict === "IE").length;

  return (
    <PageBody width="wide">
      <PageHeader title="Submissions" description={`${all.length} submission${all.length === 1 ? "" : "s"}${ieCount ? ` · ${ieCount} internal error${ieCount === 1 ? "" : "s"} to investigate` : ""}.`} />

      {!rows ? <CardSkeleton lines={8} /> : (
        <Section padded={false}>
          <Toolbar actions={<Checkbox label="Internal errors only" checked={onlyIE} onChange={(e) => setOnlyIE(e.target.checked)} />}>
            <SearchInput className="w-64" placeholder="Filter by participant or problem" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </Toolbar>
          {shown.length === 0 ? (
            <EmptyState icon={<Icon.Code size={20} />} title={all.length === 0 ? "Nothing submitted yet" : "Nothing matches"} body={all.length === 0 ? "Submissions appear here as soon as the coding rounds begin." : "Try a different filter."} />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th className="w-14" align="right">#</Th>
                  <Th className="hidden sm:table-cell">Time</Th>
                  <Th>Participant</Th>
                  <Th>Problem</Th>
                  <Th>Verdict</Th>
                  <Th className="hidden md:table-cell" align="right">Tests</Th>
                  <Th className="hidden xl:table-cell">Jury detail</Th>
                  <Th className="w-24"><span className="sr-only">Inspect</span></Th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => (
                  <Tr key={s.id} selected={open?.id === s.id} className={s.judgement.verdict === "IE" ? "bg-red-tint/40" : ""}>
                    <Td align="right" className="text-faint">{s.id}</Td>
                    <Td className="hidden whitespace-nowrap text-muted sm:table-cell">{new Date(s.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Td>
                    <Td className="font-medium">{s.name}</Td>
                    <Td>{s.title}<span className="ml-1.5 font-mono text-[11px] text-faint">{s.language}</span></Td>
                    <Td><div className="flex items-center gap-1.5"><VerdictBadge verdict={s.judgement.state === "done" ? s.judgement.verdict : null} />{s.judgement.attempt > 1 && <Badge tone="blue">rejudged ×{s.judgement.attempt - 1}</Badge>}</div></Td>
                    <Td align="right" className="hidden md:table-cell">{s.judgement.passed ?? "—"}<span className="text-faint">/{s.judgement.total ?? "—"}</span>{s.judgement.firstFail !== null && <span className="text-faint"> @{s.judgement.firstFail}</span>}</Td>
                    <Td className="hidden max-w-[22ch] truncate font-mono text-[11.5px] text-muted xl:table-cell" title={s.judgement.juryDetail ?? ""}>{s.judgement.juryDetail}</Td>
                    <Td><Button size="sm" variant="ghost" onClick={() => setOpen(s)}>Inspect</Button></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Section>
      )}

      <Drawer open={Boolean(open)} onClose={() => setOpen(null)} width="xl"
        title={open ? `Submission ${open.id} — ${open.name}` : ""}
        description={open ? `${open.title} · ${open.language} · ${new Date(open.created_at).toLocaleString()}` : undefined}>
        {!detail ? <CardSkeleton lines={8} /> : (
          <div className="space-y-4">
            <Section title="Judgements" description="Newest first. A rejudge keeps the superseded verdict for the record." padded={false}>
              <ul className="divide-y divide-line">
                {detail.judgements.map((j) => (
                  <li key={j.attempt} className={`px-4 py-3 ${j.supersededAt ? "opacity-60" : ""}`}>
                    <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                      <VerdictBadge verdict={j.verdict} />
                      <span className="text-muted">attempt {j.attempt}</span>
                      <span className="font-mono text-[11.5px] text-faint">{j.problemVersion ?? "?"}</span>
                      {j.supersededAt && <Badge tone="grey">superseded</Badge>}
                    </div>
                    {j.message && <p className="mt-1.5 text-[13px]">{j.message}</p>}
                    {j.juryDetail && <p className="mt-1 font-mono text-[11.5px] text-red">{j.juryDetail}</p>}
                    {j.compileOutput && <pre className="mt-2 max-h-32 overflow-auto rounded-box bg-page p-2 text-[11px]">{j.compileOutput}</pre>}
                  </li>
                ))}
              </ul>
            </Section>

            {detail.failing_testcase && (
              <Section title="The failing testcase" description={`At version ${detail.failing_testcase.version}${detail.failing_testcase.truncated ? ", truncated to 1 MB" : ""} — the version this submission was judged against.`}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">Input</div><pre className="max-h-56 overflow-auto rounded-box border border-line bg-page p-2.5 text-[11.5px]">{detail.failing_testcase.input}</pre></div>
                  <div><div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">Expected output</div><pre className="max-h-56 overflow-auto rounded-box border border-line bg-page p-2.5 text-[11.5px]">{detail.failing_testcase.answer}</pre></div>
                </div>
              </Section>
            )}

            <Section title={`Source · ${detail.submission.language}`} padded={false}>
              <pre className="max-h-[28rem] overflow-auto bg-[#1e1e1e] p-4 text-[12px] leading-relaxed text-white">{detail.submission.source}</pre>
            </Section>
          </div>
        )}
      </Drawer>
    </PageBody>
  );
}
