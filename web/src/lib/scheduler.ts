/**
 * The one background loop (LLD §5, §6). Every tick:
 *   - settles auction lots whose deadline has passed
 *   - sends pending work to the judge and polls what is in flight
 *
 * Deadlines and job states are all database rows, so a restart resumes
 * exactly where it left off. Started once from instrumentation.ts.
 */
import { tickAuction } from "./auction";
import { tickHacking } from "./phase1-hacking";
import { tickPuzzles } from "./phase1-puzzles";
import { pollInFlight, sendPending } from "./submissions";

const g = globalThis as unknown as { __schedulerStarted?: boolean };
let running = false;

export function startScheduler(intervalMs = 1000): void {
  if (g.__schedulerStarted) return;
  g.__schedulerStarted = true;
  setInterval(async () => {
    if (running) return; // never overlap ticks
    running = true;
    try {
      await tickAuction();
      await sendPending();
      await pollInFlight();
      await tickHacking();
      await tickPuzzles();
    } catch (err) {
      console.error("[scheduler]", err);
    } finally {
      running = false;
    }
  }, intervalMs);
  console.log(`[contest] scheduler running every ${intervalMs} ms`);
}
