"use client";

/**
 * The screen that holds a competitor on the page while a round runs.
 *
 * Full screen, focused, tab visible: the three things the browser can vouch
 * for. Leaving any of them is an alert. The page reports it, shows this
 * screen, and the only way back is the button, which asks the browser for
 * full screen again (that needs a click; nothing can do it on its own, which
 * is also why signing in lands on the gate rather than straight in full
 * screen). After the contest's number of warnings the next alert locks the
 * account, the server refuses every write, and the screen waits for an
 * organiser to unlock it.
 *
 * One alert per episode: leaving full screen also blurs the window, and one
 * slip must not count twice. The gate on first load counts for nothing; a
 * reload is not leaving.
 *
 * Like the blackout, this is an overlay and never a navigation, so the work
 * underneath is still there when it lifts.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { useContest, useEngineEvent } from "@/components/contest-provider";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";

export type ProctorState = { enabled: boolean; alerts: number; warnings: number; locked: boolean };
type Kind = "fullscreen" | "blur" | "hidden";
type Screen = "gate" | "ok" | "alert" | "locked";

/** The phases in which a competitor is working, and so is held on the page. */
const HELD = ["p1_puzzles", "p1_hacking", "auction1", "coding1", "auction2", "final"];

const LEFT: Record<Kind, string> = {
  fullscreen: "You left full screen.",
  blur: "The contest window lost focus.",
  hidden: "The contest tab was hidden.",
};

const TITLE: Record<Exclude<Screen, "ok">, string> = {
  gate: "The contest runs in full screen",
  alert: "You left the contest page",
  locked: "Your account is locked",
};

/** Full screen is asked of every browser that can do it; the rest are watched for focus alone. */
const canFullscreen = () => typeof document !== "undefined" && document.fullscreenEnabled;

/**
 * Esc leaves full screen in every browser, and Esc is a key a coder presses
 * all day (closing the editor's suggestions, closing a dialog). Where the
 * browser allows it (Chrome and its relatives, over https or on localhost)
 * the key is locked, so leaving takes a press-and-hold and a slip of the
 * finger is not an alert. Firefox has no such thing; there Esc is a real exit.
 */
type KeyboardLock = { lock?: (keys?: string[]) => Promise<void>; unlock?: () => void };
const keyboard = () => (navigator as Navigator & { keyboard?: KeyboardLock }).keyboard;
const held = () => (!canFullscreen() || !!document.fullscreenElement) && document.hasFocus() && !document.hidden;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function Proctor() {
  const hold = useHeldOnPage();
  if (!hold) return null;
  const { screen } = hold;
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={TITLE[screen]}
      className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-navy px-6 text-center text-white"
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-white/10">
        {screen === "locked" ? <Icon.Lock size={26} /> : screen === "alert" ? <Icon.Alert size={26} /> : <Icon.Expand size={26} />}
      </div>
      <h1 className="mt-6 text-[26px] leading-tight font-semibold tracking-[-0.02em] sm:text-[32px]">{TITLE[screen]}</h1>
      {screen === "locked" ? <LockedBody standing={hold.standing} /> : <HoldBody {...hold} screen={screen} />}
    </div>
  );
}

function LockedBody({ standing }: { standing: ProctorState }) {
  return (
    <>
      <p className="mt-2.5 max-w-md text-[14px] leading-relaxed text-white/70">
        You left the contest page {standing.alerts} times, more than the {plural(standing.warnings, "warning")} allowed. The
        organisers have been told. Only an organiser can unlock you: ask one, and this screen lifts on its own.
      </p>
      <p className="mt-8 max-w-sm text-[12.5px] leading-relaxed text-white/50">
        Nothing is lost. Your work is saved and you will come back to exactly where you were. Refreshing or opening another tab
        will not clear this.
      </p>
    </>
  );
}

function HoldBody({ screen, standing, last, resume, busy }: Hold & { screen: "gate" | "alert" }) {
  // Decided after mount: the server has no browser to ask, and the text must match on both sides.
  const [fullscreen, setFullscreen] = useState(true);
  useEffect(() => setFullscreen(canFullscreen()), []);
  const left = Math.max(0, standing.warnings - standing.alerts);
  return (
    <>
      <p className="mt-2.5 max-w-md text-[14px] leading-relaxed text-white/70">
        {screen === "alert" ? `${last ? LEFT[last] : "You left the page."} The organisers have been told. ` : ""}
        Stay in full screen with this window focused until the round ends.
        {screen === "gate" &&
          ` Leaving full screen, switching to another window or hiding this tab is an alert, and after ${plural(standing.warnings, "alert")} your account is locked until an organiser unlocks it.`}
      </p>
      {screen === "alert" && (
        <p className="mt-6 rounded-full bg-white/10 px-3 py-1 text-[12.5px] font-medium" aria-live="polite">
          Warning {Math.min(standing.alerts, standing.warnings)} of {standing.warnings} ·{" "}
          {left === 0 ? "the next alert locks your account" : `${left} left before your account is locked`}
        </p>
      )}
      <Button size="lg" className="mt-8" onClick={resume} loading={busy}>
        <Icon.Expand size={15} /> {screen === "alert" ? "Return to the contest" : "Enter full screen and continue"}
      </Button>
      <p className="mt-4 max-w-sm text-[12.5px] leading-relaxed text-white/50">
        {fullscreen
          ? "Your browser asks before going full screen. Allow it and you are back where you were."
          : "This browser cannot go full screen, so only the window's focus is watched."}
      </p>
    </>
  );
}

type Hold = { screen: Exclude<Screen, "ok">; standing: ProctorState; last: Kind | null; resume: () => Promise<void>; busy: boolean };

/**
 * Watches the three ways out while a round runs and reports each one.
 * Returns what the screen must show, or null while the page is held and the
 * competitor may work.
 */
function useHeldOnPage(): Hold | null {
  const { state, refresh } = useContest();
  const me = state?.me;
  const fromServer = me?.proctor ?? null;
  const enforced = !!fromServer?.enabled && HELD.includes(state?.contest.phase ?? "") && !!me && !me.disqualified;

  const [screen, setScreen] = useState<Screen>("gate");
  // Two events can arrive in one tick; the ref is what the second one reads.
  const screenRef = useRef<Screen>("gate");
  const show = (s: Screen) => {
    screenRef.current = s;
    setScreen(s);
  };
  // The answer to the last report, fresher than the page state until the next re-read.
  const [reported, setReported] = useState<ProctorState | null>(null);
  useEffect(() => setReported(null), [fromServer]);
  const standing = reported ?? fromServer;
  const [last, setLast] = useState<Kind | null>(null);
  const [busy, setBusy] = useState(false);

  // The server's lock wins over anything local; its unlock reopens the gate.
  const locked = !!standing?.locked;
  useEffect(() => {
    if (locked) show("locked");
    else if (screenRef.current === "locked") show("gate");
  }, [locked]);

  const report = useCallback(async (kind: Kind) => {
    if (screenRef.current !== "ok") return;
    show("alert");
    setLast(kind);
    try {
      const answer = await api.post<ProctorState>("/api/proctor/alert", { kind });
      setReported(answer);
      if (answer.locked) show("locked");
    } catch {
      /* The screen is already up; the server hears about it on the next slip
         or the next full read. Staying up is the safe way to be wrong. */
    }
  }, []);

  useEffect(() => {
    if (enforced) return watchWaysOut(report);
    // Between rounds the screen is theirs again; the next round starts at the gate.
    keyboard()?.unlock?.();
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    show("gate");
  }, [enforced, report]);

  // An organiser unlocking (or locking) this account arrives as an event.
  useEngineEvent("proctor", () => void refresh().catch(() => undefined));

  const resume = async () => {
    setBusy(true);
    try {
      if (canFullscreen() && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen({ navigationUI: "hide" });
        await keyboard()?.lock?.(["Escape"]).catch(() => undefined);
      }
      window.focus();
      // Checked now, not assumed from the click: a refused request leaves the screen up.
      if (held()) show("ok");
    } catch {
      /* Full screen refused: the button is still there to try again. */
    } finally {
      setBusy(false);
    }
  };

  if (!enforced || screen === "ok" || !standing) return null;
  return { screen, standing, last, resume, busy };
}

/** Listen for the three ways out until the returned function is called. */
function watchWaysOut(report: (kind: Kind) => Promise<void>): () => void {
  const onFullscreen = () => {
    if (!document.fullscreenElement) void report("fullscreen");
  };
  const onBlur = () => void report("blur");
  const onVisibility = () => {
    if (document.hidden) void report("hidden");
  };
  document.addEventListener("fullscreenchange", onFullscreen);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    document.removeEventListener("fullscreenchange", onFullscreen);
    window.removeEventListener("blur", onBlur);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
