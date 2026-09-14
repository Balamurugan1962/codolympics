/**
 * Refuse to run the database tests against anything but a test database.
 *
 * The suites here begin by truncating every table a contest run writes to —
 * bids, lots, ownership, the ledger, submissions, judgements and the audit log.
 * That is correct for a scratch database and catastrophic for a live one, and
 * the only thing that stood between the two was remembering to set
 * DATABASE_URL. It was not remembered, and a live contest lost its auction.
 *
 * So the check is here instead of in anyone's memory. The name must say it is
 * for testing, and "contest" does not count merely because the word ends in
 * "test" — that near-miss is exactly how this goes wrong.
 */
const url = process.env.DATABASE_URL ?? "postgres://contest:contest@localhost:5432/contest";
const dbName = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));

const allowed = /(^|[_-])test([_-]|$)|^test/i.test(dbName) || dbName.endsWith("_scratch") || dbName.endsWith("_ci");

if (!allowed && process.env.I_KNOW_THIS_DESTROYS_DATA !== "yes") {
  throw new Error(
    [
      "",
      `Refusing to run the database tests against "${dbName}".`,
      "",
      "These tests truncate bid, lot, ownership, ledger, submission, judgement,",
      "draft, notification, hint_purchase and audit_log. Point them at a database",
      "whose name says it is for testing:",
      "",
      "  createdb contest_test   # or: docker exec web-postgres-1 createdb -U contest contest_test",
      "  DATABASE_URL=postgres://contest:contest@localhost:5432/contest_test pnpm db:migrate",
      "  pnpm test",
      "",
      'Accepted names contain "test" as a word (contest_test, test_contest), or end',
      'in "_scratch" or "_ci". Set I_KNOW_THIS_DESTROYS_DATA=yes to override.',
      "",
    ].join("\n"),
  );
}
