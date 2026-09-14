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
import { CheckField, SearchInput } from "@/components/ui/field";
import { PageBody, PageHeader, Section, Toolbar } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/client";

type S = {
  id: number;
  name: string;
  participant_id: string;
  question_id: string;
  title: string;
  language: string;
  created_at: string;
  judgement: {
    state: string;
    verdict: string | null;
    firstFail: number | null;
    passed: number | null;
    total: number | null;
    juryDetail: string | null;
    message: string | null;
    problemVersion: string | null;
    attempt: number;
    maxTimeMs: number | null;
  };
};
type Detail = {
  submission: { source: string; language: string };
  judgements: {
    attempt: number;
    verdict: string | null;
    message: string | null;
    juryDetail: string | null;
    problemVersion: string | null;
    supersededAt: string | null;
    compileOutput: string | null;
  }[];
  failing_testcase: { input: string; answer: string; truncated: boolean; version: string } | null;
};

export default function SubmissionsPage() {
  const [rows, setRows] = useState<S[] | null>(null);
  const [filter, setFilter] = useState("");
  const [onlyIE, setOnlyIE] = useState(false);
  const [open, setOpen] = useState<S | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

  useEffect(() => {
    void api.get<{ submissions: S[] }>("/api/admin/submissions").then((r) => setRows(r.submissions));
  }, []);
  useEffect(() => {
    setDetail(null);
    if (open) void api.get<Detail>(`/api/admin/submissions/${open.id}`).then(setDetail);
  }, [open]);

  const all = rows ?? [];
  const shown = all.filter(
    (r) =>
      (!filter || r.name.toLowerCase().includes(filter.toLowerCase()) || r.question_id.includes(filter.toLowerCase())) &&
      (!onlyIE || r.judgement.verdict === "IE"),
  );
  const ieCount = all.filter((r) => r.judgement.verdict === "IE").length;

  return (
    <PageBody width="wide">
      <PageHeader
        title="Submissions"
        description={`${all.length} submission${all.length === 1 ? "" : "s"}${
          ieCount ? ` · ${ieCount} internal error${ieCount === 1 ? "" : "s"} to investigate` : ""
        }.`}
      />

      {!rows ? (
        <PageSkeleton rows={9} cols={5} />
      ) : (
        <Section padded={false}>
          <Toolbar actions={<CheckField label="Internal errors only" checked={onlyIE} onChange={(e) => setOnlyIE(e.target.checked)} />}>
            <SearchInput
              className="w-full sm:w-72"
              placeholder="Filter by participant or problem"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onClear={() => setFilter("")}
            />
          </Toolbar>
          {shown.length === 0 ? (
            <EmptyState
              icon={<Icon.Code />}
              title={all.length === 0 ? "Nothing submitted yet" : "Nothing matches"}
              body={all.length === 0 ? "Submissions appear here as soon as the coding rounds begin." : "Try a different filter."}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14 text-right">#</TableHead>
                  <TableHead className="hidden sm:table-cell">Time</TableHead>
                  <TableHead>Participant</TableHead>
                  <TableHead>Problem</TableHead>
                  <TableHead>Verdict</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Tests</TableHead>
                  <TableHead className="hidden xl:table-cell">Jury detail</TableHead>
                  <TableHead className="w-24">
                    <span className="sr-only">Inspect</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((s) => (
                  <TableRow
                    key={s.id}
                    data-state={open?.id === s.id ? "selected" : undefined}
                    className={s.judgement.verdict === "IE" ? "bg-red-tint/40" : ""}
                  >
                    <TableCell className="text-right text-faint num">{s.id}</TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                      {new Date(s.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>
                      {s.title}
                      <span className="ml-1.5 font-mono text-[11px] text-faint">{s.language}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <VerdictBadge verdict={s.judgement.state === "done" ? s.judgement.verdict : null} />
                        {s.judgement.attempt > 1 && <Badge variant="info">rejudged ×{s.judgement.attempt - 1}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-right num md:table-cell">
                      {s.judgement.passed ?? "—"}
                      <span className="text-faint">/{s.judgement.total ?? "—"}</span>
                      {s.judgement.firstFail !== null && <span className="text-faint"> @{s.judgement.firstFail}</span>}
                    </TableCell>
                    <TableCell
                      className="hidden max-w-[22ch] truncate font-mono text-[11.5px] text-muted-foreground xl:table-cell"
                      title={s.judgement.juryDetail ?? ""}
                    >
                      {s.judgement.juryDetail}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setOpen(s)}>
                        Inspect
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
      )}

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        width="xl"
        title={open ? `Submission ${open.id} — ${open.name}` : ""}
        description={open ? `${open.title} · ${open.language} · ${new Date(open.created_at).toLocaleString()}` : undefined}
      >
        {!detail ? (
          <PageSkeleton rows={9} cols={5} />
        ) : (
          <div className="space-y-4">
            <Section title="Judgements" description="Newest first. A rejudge keeps the superseded verdict for the record." padded={false}>
              <ul className="divide-y">
                {detail.judgements.map((j) => (
                  <li key={j.attempt} className={`px-5 py-3 ${j.supersededAt ? "opacity-60" : ""}`}>
                    <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                      <VerdictBadge verdict={j.verdict} />
                      <span className="text-muted-foreground">attempt {j.attempt}</span>
                      <span className="font-mono text-[11.5px] text-faint">{j.problemVersion ?? "?"}</span>
                      {j.supersededAt && <Badge variant="neutral">superseded</Badge>}
                    </div>
                    {j.message && <p className="mt-1.5 text-[13px]">{j.message}</p>}
                    {j.juryDetail && <p className="mt-1 font-mono text-[11.5px] text-red">{j.juryDetail}</p>}
                    {j.compileOutput && <pre className="pane mt-2 max-h-32 overflow-auto rounded-md bg-muted p-2 text-[11px]">{j.compileOutput}</pre>}
                  </li>
                ))}
              </ul>
            </Section>

            {detail.failing_testcase && (
              <Section
                title="The failing testcase"
                description={`At version ${detail.failing_testcase.version}${
                  detail.failing_testcase.truncated ? ", truncated to 1 MB" : ""
                } — the version this submission was judged against.`}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">Input</div>
                    <pre className="pane max-h-56 overflow-auto rounded-md border bg-muted p-2.5 text-[11.5px]">{detail.failing_testcase.input}</pre>
                  </div>
                  <div>
                    <div className="mb-1 text-[11px] font-semibold tracking-[0.06em] text-faint uppercase">Expected output</div>
                    <pre className="pane max-h-56 overflow-auto rounded-md border bg-muted p-2.5 text-[11.5px]">{detail.failing_testcase.answer}</pre>
                  </div>
                </div>
              </Section>
            )}

            <Section title={`Source · ${detail.submission.language}`} padded={false}>
              <pre className="pane max-h-[28rem] overflow-auto bg-navy p-4 text-[12px] leading-relaxed text-white">{detail.submission.source}</pre>
            </Section>
          </div>
        )}
      </Drawer>
    </PageBody>
  );
}
