"use client";

/**
 * Publishing a whole set in one go.
 *
 * Going through each question to publish it is how one gets forgotten, so this is one
 * button: it publishes everything that can go live unattended and names what it left
 * (a question that is not ready, a package with no passing validation, a publish that
 * would rejudge submissions and so needs a person to confirm the count).
 */
import { useState } from "react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/client";

type Skipped = { id: string | number; title?: string; why?: string };
type Result = { published: number; skipped: Skipped[] };

export function PublishAllButton({
  url, what, onDone, disabled,
}: { url: string; what: string; onDone: () => Promise<void> | void; disabled?: boolean }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const r = await api.post<Result>(url, { reason: `Published every ${what} that was ready.` });
      const left = r.skipped.length;
      toast({
        title: `Published ${r.published}`,
        description: left ? `${left} left as they are: ${r.skipped.slice(0, 4).map((s) => s.title ?? s.id).join(", ")}${left > 4 ? "…" : ""}` : undefined,
        tone: left ? "info" : "success",
      });
      setOpen(false);
      await onDone();
    } catch (err) {
      toast({ title: "Could not publish", description: errorMessage(err), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        <Icon.Check size={14} /> Publish all
      </Button>
      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={`Publish every ${what}?`}
          description="Everything that is ready goes live now. Anything that is not ready, not validated, or would need a rejudge confirmed stays as it is, and is named afterwards."
          footer={
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button loading={busy} onClick={run}>Publish all</Button>
            </>
          }
        >
          <p className="text-[13px] text-muted-foreground">Individual questions can still be unpublished one at a time.</p>
        </Modal>
      )}
    </>
  );
}
