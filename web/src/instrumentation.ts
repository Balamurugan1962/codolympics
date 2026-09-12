/** Runs once when the Next.js server starts. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startScheduler } = await import("./lib/scheduler");
  const { ensureAdmin } = await import("./lib/registration");
  const { getContest } = await import("./lib/contest");
  await getContest(); // creates the single contest row on first start
  await ensureAdmin();
  startScheduler();
}
