"use client";

/**
 * An administrator action that just happens.
 *
 * Most of what an organiser does during a contest is routine and reversible:
 * publish a question, pause the clock, reorder a queue, change a price. Those
 * are still written to the audit log — the log is what makes an organiser's
 * unlimited authority defensible — but the reason is written by the caller,
 * because a box demanding three characters before a queue can be paused is how
 * a required field turns into "asdf" and how a room of thirty people waits.
 *
 * A reason is *asked for* only where it is the point: advancing the contest,
 * changing settings, and anything that moves coins, points or access. Those
 * keep {@link ReasonAction}.
 *
 * `confirm` adds a plain are-you-sure for the few actions nobody can undo —
 * a deletion, a void — without asking anyone to justify it in prose.
 */
import { useState, type ReactNode } from "react";

import { errorMessage } from "@/lib/client";

import { Button } from "./ui/button";
import { Modal } from "./ui/modal";
import { useToast } from "./ui/toast";

type Variant = React.ComponentProps<typeof Button>["variant"];

export type Confirm = {
  title: string;
  /** What the action does, in the words of someone who has to live with it. */
  body?: ReactNode;
  label?: string;
};

export function ActionButton({
  label,
  title,
  icon,
  variant = "outline",
  size = "sm",
  disabled,
  confirm,
  onAct,
}: {
  label: string;
  /** Tooltip for an icon-only button; the label is still its accessible name. */
  title?: string;
  icon?: ReactNode;
  variant?: Variant;
  size?: "xs" | "sm" | "default";
  disabled?: boolean;
  confirm?: Confirm;
  onAct: () => Promise<void>;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);

  async function run() {
    setBusy(true);
    try {
      await onAct();
      setAsking(false);
    } catch (err) {
      toast({ title: "Not done", description: errorMessage(err), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        title={title}
        disabled={disabled}
        loading={busy && !asking}
        onClick={() => (confirm ? setAsking(true) : void run())}
      >
        {icon}
        {label}
      </Button>
      {confirm && (
        <Modal
          open={asking}
          onClose={() => setAsking(false)}
          title={confirm.title}
          size="sm"
          footer={
            <>
              <Button variant="outline" onClick={() => setAsking(false)}>
                Cancel
              </Button>
              <Button variant={variant === "destructive" ? "destructive" : "default"} loading={busy} onClick={run}>
                {confirm.label ?? label}
              </Button>
            </>
          }
        >
          {confirm.body && <p className="text-[13px] leading-relaxed text-muted-foreground">{confirm.body}</p>}
        </Modal>
      )}
    </>
  );
}
