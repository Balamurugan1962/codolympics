"use client";

/**
 * Announcements. One box, Markdown with a preview, one Send button. What is
 * sent appears on every screen at once as a toast and stays on every
 * participant's home page for the rest of the contest — so the history is
 * here too, newest first.
 */
import { useCallback, useEffect, useState } from "react";

import { useContest } from "@/components/contest-provider";
import { Icon } from "@/components/icons";
import { Markdown } from "@/components/markdown";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { PageBody, PageHeader, Section } from "@/components/ui/page";
import { CardSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

type A = { id: number; bodyMd: string; createdAt: string };
const MAX = 5000;

const TEMPLATES: { label: string; text: string }[] = [
  { label: "Selection basis", text: "**How selection to Phase 2 works.** Roughly the top half by Phase 1 points advance, at the organisers' discretion. Ties go to the earlier submission time." },
  { label: "Leaderboard mode", text: "**The Phase 2 leaderboard is live.** Everyone can see the standings throughout the auction and coding rounds." },
  { label: "Round extended", text: "**This round has been extended by 10 minutes.** The countdown at the top of your screen is already updated." },
  { label: "Break", text: "**Ten-minute break.** Nothing is running. The next phase opens when we are back — watch the timeline." },
];

export default function AnnouncementsPage() {
  const { toast } = useToast();
  const { state, refresh } = useContest();
  const [rows, setRows] = useState<A[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => setRows((await api.get<{ announcements: A[] }>("/api/admin/announcements")).announcements), []);
  useEffect(() => { void load(); }, [load]);

  async function send() {
    setBusy(true);
    try {
      await api.post("/api/admin/announcements", { body_md: text.trim() });
      setText("");
      toast({ title: "Announced to everyone", description: "It is on every screen now.", tone: "success" });
      await Promise.all([load(), refresh()]);
    } catch (err) { toast({ title: "Not sent", description: errorMessage(err), tone: "error" }); } finally { setBusy(false); }
  }

  const participants = state?.viewer.role === "admin" ? undefined : undefined;
  void participants;

  return (
    <PageBody>
      <PageHeader title="Announcements" description="Reaches every signed-in screen at once as a notification, and stays on every participant's home page for the rest of the contest." />
      <div className="space-y-4">
        <Section
          title="New announcement"
          description="Markdown renders: bold, lists, code. Keep it to what people need to act on."
          footer={
            <>
              <span className={`mr-auto text-[12px] ${text.length > MAX ? "font-semibold text-red" : "text-faint"}`}>{text.length.toLocaleString()} / {MAX.toLocaleString()}</span>
              <Button variant="ghost" disabled={!text || busy} onClick={() => setText("")}>Clear</Button>
              <Button onClick={send} loading={busy} disabled={!text.trim() || text.length > MAX} icon={<Icon.Send size={14} />}>Send to everyone</Button>
            </>
          }
        >
          <MarkdownEditor value={text} onChange={setText} rows={7} placeholder="**Section B opens at 11:30.** Finish your puzzle answers before then." />
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11.5px] text-faint">Start from:</span>
            {TEMPLATES.map((t) => (
              <button key={t.label} type="button" onClick={() => setText(t.text)}
                className="rounded-full border border-line bg-card px-2.5 py-1 text-[11.5px] font-medium text-muted transition-colors hover:border-line-2 hover:text-ink">
                {t.label}
              </button>
            ))}
          </div>
        </Section>

        {rows && rows.length === 0 && (
          <Alert tone="info" title="Two announcements every contest needs">
            The selection basis for Phase 2, before Phase 1 starts. The leaderboard mode, before the first auction. Both change how people play.
          </Alert>
        )}

        <Section title="Sent" description={rows ? `${rows.length} announcement${rows.length === 1 ? "" : "s"}, newest first.` : undefined} padded={false}>
          {!rows ? <div className="p-4"><CardSkeleton lines={4} /></div> : rows.length === 0 ? (
            <EmptyState compact icon={<Icon.Bell size={18} />} title="Nothing announced yet" />
          ) : (
            <ol className="divide-y divide-line">
              {rows.map((a, i) => (
                <li key={a.id} className="flex gap-4 px-5 py-3.5">
                  <div className="w-24 shrink-0 pt-0.5 text-[11.5px] leading-snug text-faint">
                    <div>{new Date(a.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                    <div>{new Date(a.createdAt).toLocaleDateString([], { day: "numeric", month: "short" })}</div>
                    {i === 0 && <div className="mt-1 font-semibold text-green-dark">latest</div>}
                  </div>
                  <div className="min-w-0 flex-1 text-[13px]"><Markdown>{a.bodyMd}</Markdown></div>
                  <Button size="sm" variant="ghost" aria-label="Reuse this text" title="Reuse this text" onClick={() => { setText(a.bodyMd); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Icon.Copy size={14} /></Button>
                </li>
              ))}
            </ol>
          )}
        </Section>
      </div>
    </PageBody>
  );
}
