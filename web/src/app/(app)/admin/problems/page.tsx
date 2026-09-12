"use client";

/** The problem set at a glance, and where to upload a new package. Each row opens its own page. */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/skeleton";
import { Table, Td, Th } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

export type P = { problem_id: string; testcases: number; bytes: number; version: string; validated: boolean; compare: string; time_limit_ms: number; memory_limit_mb: number; has_reference: boolean; hack_only: boolean; modified_at: string | null; versions: string[]; current: string | null };
export type Q = { id: string; title: string; difficulty: string; score: number; basePrice: number; statementMd: string; sampleCount: number; auctionOrder: number; status: string; validated: boolean; hints: { idx: number; price: number; bodyMd: string }[] };

export default function ProblemsPage() {
  const [problems, setProblems] = useState<P[] | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const load = useCallback(async () => {
    const [p, q] = await Promise.all([api.get<{ problems: P[] }>("/api/admin/problems"), api.get<{ questions: Q[] }>("/api/admin/questions")]);
    setProblems(p.problems); setQuestions(q.questions);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const ids = [...new Set([...(problems ?? []).map((p) => p.problem_id), ...questions.map((q) => q.id)])].sort();

  return (
    <div className="space-y-4 animate-fade-in">
      <PageHeader title="Problems" description="Upload a package, validate it, publish it, then add what participants see. Each problem has its own page." />
      <Upload onDone={load} />
      {!problems ? <CardSkeleton lines={6} /> : ids.length === 0 ? <EmptyState icon={<Icon.Upload size={22} />} title="No problems yet" body="Upload a package above to create the first one." /> : (
        <Card>
          <Table>
            <thead><tr><Th>Problem</Th><Th className="hidden sm:table-cell">Tests</Th><Th className="hidden md:table-cell">Live version</Th><Th>State</Th><Th className="hidden lg:table-cell">Auction</Th><Th></Th></tr></thead>
            <tbody>{ids.map((id) => {
              const p = problems.find((x) => x.problem_id === id); const q = questions.find((x) => x.id === id);
              return (
                <tr key={id} className="hover:bg-page">
                  <Td><Link href={`/admin/problems/${id}`} className="block"><div className="font-semibold">{q?.title ?? <span className="text-faint">untitled</span>}</div><div className="font-mono text-xs text-faint">{id}</div></Link></Td>
                  <Td className="hidden sm:table-cell">{p ? `${p.testcases} · ${(p.bytes / 1024 / 1024).toFixed(1)} MB` : "—"}</Td>
                  <Td className="hidden md:table-cell">{p?.current ?? <span className="text-faint">unpublished</span>}</Td>
                  <Td><div className="flex flex-wrap gap-1">
                    {!p && <Badge tone="red">no package</Badge>}{p && !q && <Badge tone="amber">no details</Badge>}
                    {p && (p.validated || q?.validated ? <Badge tone="green">validated</Badge> : <Badge tone="amber">not validated</Badge>)}
                    {p?.hack_only && <Badge tone="blue">hacking</Badge>}{q?.status === "void" && <Badge tone="red">void</Badge>}
                  </div></Td>
                  <Td className="hidden lg:table-cell">{q ? `#${q.auctionOrder} · ${q.difficulty} · ${q.score} pts · base ${q.basePrice}` : "—"}</Td>
                  <Td><Link href={`/admin/problems/${id}`}><Button size="sm" variant="ghost">Open <Icon.ChevronRight /></Button></Link></Td>
                </tr>
              );
            })}</tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function Upload({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [id, setId] = useState(""); const [reason, setReason] = useState(""); const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!file) return;
    setBusy(true);
    const form = new FormData(); form.set("id", id.trim()); form.set("reason", reason); form.set("package", file);
    try { const r = await api.post<{ version: string }>("/api/admin/problems", form); toast({ title: `Uploaded ${id} as ${r.version}`, description: "Open it to validate and publish.", tone: "success" }); setFile(null); setId(""); setReason(""); onDone(); }
    catch (err) { toast({ title: "Upload failed", description: errorMessage(err), tone: "error" }); } finally { setBusy(false); }
  }
  return (
    <Card>
      <CardHeader title="Upload a package" description="A zip with problem.json and tests/ — plus checker.py, validator.py or a reference solution if the problem needs them. It becomes a new version; the live one is untouched until you publish." />
      <CardBody className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
        <Input placeholder="problem id, e.g. hard-03" value={id} onChange={(e) => setId(e.target.value)} aria-label="Problem id" />
        <label className="flex h-9 cursor-pointer items-center gap-2 rounded-box border border-dashed border-line-2 px-3 text-sm text-muted hover:border-green"><Icon.Upload /><span className="truncate">{file ? file.name : "Choose a .zip"}</span><input type="file" accept=".zip" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        <Input placeholder="reason (audit log)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason" />
        <Button onClick={submit} loading={busy} disabled={!id.trim() || !file || reason.length < 3}>Upload</Button>
      </CardBody>
    </Card>
  );
}
