"use client";

/**
 * An announcement takes the screen.
 *
 * A toast in the corner is the wrong shape for this: announcements carry the
 * things a competitor must not miss — the selection basis, a round being
 * extended, a break — and a corner toast that fades after five seconds is
 * exactly how someone misses one while staring at their editor. So it blocks,
 * renders the Markdown properly, and stays until acknowledged.
 *
 * Only announcements that arrive while you are here interrupt. The ones sent
 * before you opened the page are on the home page, and reading them there is a
 * choice; being ambushed by six of them on sign-in is not.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { Markdown } from "./markdown";
import { useContest } from "./contest-provider";
import { Icon } from "./icons";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { LocalTime } from "./local-time";

type Announcement = { id: number; bodyMd: string; createdAt: string };

const key = (userId: string) => `announce:seen:${userId}`;

function readSeen(userId: string): number | null {
  try {
    const v = localStorage.getItem(key(userId));
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}
function writeSeen(userId: string, id: number) {
  try {
    localStorage.setItem(key(userId), String(id));
  } catch {
    /* private browsing; the worst case is seeing one twice */
  }
}

export function AnnouncementOverlay() {
  const { state } = useContest();
  const userId = state?.viewer.id;
  const announcements = state?.announcements;
  const [queue, setQueue] = useState<Announcement[]>([]);
  const seen = useRef<number | null>(null);

  useEffect(() => {
    if (!userId || !announcements) return;
    const newest = announcements.reduce((m, a) => Math.max(m, a.id), 0);

    if (seen.current === null) {
      // First render of this session. Anything already sent is history: catch
      // up silently so a reload does not replay the whole contest.
      const stored = readSeen(userId);
      seen.current = stored === null ? newest : Math.max(stored, newest);
      writeSeen(userId, seen.current);
      return;
    }

    const fresh = announcements.filter((a) => a.id > (seen.current ?? 0)).sort((a, b) => a.id - b.id);
    if (fresh.length === 0) return;
    seen.current = newest;
    writeSeen(userId, newest);
    setQueue((q) => [...q, ...fresh]);
  }, [announcements, userId]);

  const dismiss = useCallback(() => setQueue((q) => q.slice(1)), []);
  const current = queue[0];

  return (
    /*
     * Announcements are acknowledged, not escaped. The button at the bottom is
     * the only way out, so every other dismissal request is ignored: the dialog
     * is controlled, `onOpenChange` does nothing, and pointer dismissal is off.
     * Radix needed two events cancelled individually; this says it once.
     */
    <Dialog open={Boolean(current)} onOpenChange={() => {}} disablePointerDismissal>
      <DialogContent showCloseButton={false} className="w-[min(46rem,calc(100vw-2rem))] gap-0 p-0 sm:max-w-3xl">
        <div className="flex items-center gap-2.5 rounded-t-lg bg-navy px-5 py-3 text-white">
          <span className="flex size-7 items-center justify-center rounded-full bg-brand-bright text-navy">
            <Icon.Megaphone size={15} />
          </span>
          <DialogTitle className="text-[15px] font-semibold text-white">Announcement</DialogTitle>
          {current && (
            <span className="ml-auto text-[12px] text-white/60">
              <LocalTime iso={current.createdAt} />
            </span>
          )}
          {queue.length > 1 && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold">+{queue.length - 1} more</span>
          )}
        </div>

        <div className="pane max-h-[60vh] overflow-y-auto px-6 py-5">
          {current && <Markdown className="text-[14.5px]">{current.bodyMd}</Markdown>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t bg-muted/40 px-5 py-3">
          <Button size="lg" onClick={dismiss} autoFocus>
            {queue.length > 1 ? "Next announcement" : "Got it"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
