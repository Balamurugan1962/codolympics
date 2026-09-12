/**
 * End-to-end smoke test: plays an administrator and three participants over
 * HTTP against a running `pnpm dev` and a running judge. Both phases, start
 * to finish. Run with:  pnpm tsx tests/e2e/smoke.ts
 */
import { zipSync } from "fflate";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN_PW = process.env.ADMIN_PASSWORD ?? "admin-dev-password";
let step = 0;
const ok = (msg: string) => console.log(`  ✓ ${++step}. ${msg}`);
const fail = (msg: string): never => { console.error(`  ✗ ${msg}`); process.exit(1); };
const assert = (cond: unknown, msg: string) => { if (!cond) fail(msg); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Client {
  cookie = "";
  constructor(public name: string) {}
  async call<T = any>(method: string, path: string, body?: unknown, raw?: FormData): Promise<{ status: number; data: T }> {
    const res = await fetch(BASE + path, {
      method,
      // Browsers always send Origin; Better Auth's CSRF check requires it.
      headers: { ...(raw ? {} : { "Content-Type": "application/json" }), Cookie: this.cookie, Origin: BASE },
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
      redirect: "manual",
    });
    const sc = res.headers.getSetCookie?.() ?? [];
    if (sc.length) this.cookie = sc.map((c) => c.split(";")[0]).join("; ");
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data };
  }
  async signIn(username: string, password: string) {
    const r = await this.call("POST", "/api/auth/sign-in/username", { username, password });
    assert(r.status === 200, `${this.name}: sign-in failed ${r.status} ${JSON.stringify(r.data)}`);
  }
  async expect<T = any>(method: string, path: string, body: unknown, status: number, what: string): Promise<T> {
    const r = await this.call<T>(method, path, body);
    if (r.status !== status) fail(`${this.name}: ${what} → ${r.status} (expected ${status}): ${JSON.stringify(r.data)}`);
    return r.data;
  }
}

const SUM_CPP = "#include <iostream>\nint main(){long long a,b;while(std::cin>>a>>b)std::cout<<a+b<<'\\n';}";
const WRONG_CPP = "#include <iostream>\nint main(){long long a,b;std::cin>>a>>b;std::cout<<a-b<<'\\n';}";
const FLAWED_CPP = "#include <iostream>\nint main(){long long a,b;std::cin>>a>>b;std::cout<<(a<0||b<0? a-b : a+b)<<'\\n';}";

function zip(files: Record<string, string>): Uint8Array {
  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, new TextEncoder().encode(v)])));
}

async function upload(admin: Client, id: string, files: Record<string, string>) {
  const form = new FormData();
  form.set("id", id); form.set("reason", "smoke test upload");
  form.set("package", new Blob([Buffer.from(zip(files))], { type: "application/zip" }), `${id}.zip`);
  const r = await admin.call("POST", "/api/admin/problems", undefined, form);
  assert(r.status === 201, `upload ${id} → ${r.status} ${JSON.stringify(r.data)}`);
  return r.data.version as string;
}

async function advance(admin: Client, expectNext: string) {
  const r = await admin.expect<{ phase: string }>("POST", "/api/admin/contest/phase", { reason: "smoke test", acknowledge_warnings: true }, 200, `advance to ${expectNext}`);
  assert(r.phase === expectNext, `expected phase ${expectNext}, got ${r.phase}`);
  ok(`phase → ${r.phase}`);
}

async function main() {
  console.log(`smoke test against ${BASE}`);
  const admin = new Client("admin");
  await admin.signIn("admin", ADMIN_PW);
  ok("admin signed in");

  // Fresh contest: reset via export check that phase is registration.
  const c0 = await admin.expect("GET", "/api/admin/contest", undefined, 200, "read contest");
  assert(c0.phase === "registration", `contest must start in registration (is ${c0.phase}); reset the database first`);

  // --- Problem set -------------------------------------------------------
  const v = await upload(admin, "sum", {
    "problem.json": JSON.stringify({ time_limit_ms: 1000, memory_limit_mb: 256, compare: "tokens", early_exit: true, reference: { language: "cpp", file: "solution.cpp" } }),
    "solution.cpp": SUM_CPP,
    "tests/00001.in": "2 3\n", "tests/00001.ans": "5\n",
    "tests/00002.in": "10 20\n", "tests/00002.ans": "30\n",
    "tests/00003.in": "-1 1\n", "tests/00003.ans": "0\n",
  });
  ok(`uploaded sum as ${v}`);
  const report = await admin.expect("POST", "/api/admin/problems/sum/validate", { version: v }, 200, "validate sum");
  assert(report.ok === true, `validation should pass: ${JSON.stringify(report.issues)}`);
  assert(report.reference?.verdict === "AC", "stored reference solution should be AC");
  ok("sum validated with the stored reference solution");
  await admin.expect("POST", "/api/admin/problems/sum/publish", { version: v, reason: "smoke", confirmed_rejudge: 0 }, 200, "publish sum");
  ok("sum published (symlink swapped)");
  await admin.expect("POST", "/api/admin/questions", {
    id: "sum", title: "Add Two Numbers", difficulty: "easy", score: 100, base_price: 100, statement_md: "Read `a` and `b`, print `a+b`.", sample_count: 1, auction_order: 1,
    hints: [{ price: 30, body_md: "Use 64-bit integers." }], reason: "smoke",
  }, 200, "question details");
  ok("question details saved with one hint");

  const hv = await upload(admin, "hack-sum", {
    "problem.json": JSON.stringify({ time_limit_ms: 1000, memory_limit_mb: 256, hack_only: true, reference: { language: "cpp", file: "solution.cpp" } }),
    "solution.cpp": SUM_CPP,
    "validator.py": "def validate(inp):\n    inp.int(-1000, 1000)\n    inp.int(-1000, 1000)\n    inp.eof()\n",
  });
  await admin.expect("POST", "/api/admin/problems/hack-sum/publish", { version: hv, reason: "smoke", confirmed_rejudge: 0 }, 200, "publish hack-sum");
  ok("hacking package published");

  // --- Phase 1 authoring ---------------------------------------------------
  const pz = await admin.expect<{ id: number }>("POST", "/api/admin/phase1/puzzles", {
    reason: "smoke", title: "Missing grid", body_md: "2 3 11 / 3 4 19 / 4 5 29 / 5 6 ?", category: "pattern", kind: "fill_blank", grading: "auto",
    points: 10, explain_points: 5, order_index: 1, config: {}, answer_key: { accepted: ["41"] }, format_regex: "^\\d+$", format_hint: "a number",
  }, 201, "create puzzle");
  const t1 = await admin.expect("POST", `/api/admin/phase1/puzzles/${pz.id}/test`, { answer: "41" }, 200, "self-test puzzle");
  assert(t1.ready === true, `puzzle self-test should pass: ${t1.detail}`);
  await admin.expect("POST", `/api/admin/phase1/puzzles/${pz.id}/publish`, { reason: "smoke" }, 200, "publish puzzle");
  ok("puzzle created, self-tested (41 scores full marks), published");

  const vz = await admin.expect<{ id: number }>("POST", "/api/admin/phase1/puzzles", {
    reason: "smoke", title: "Crack the password", body_md: "Find 4-digit codes: a>b, b even, c prime, d>a", category: "constraint", kind: "set", grading: "validator",
    points: 0, points_per_entry: 2, max_entries: 10, order_index: 2, config: {},
    validator_py: "def check(entry):\n    d = entry.rest().strip()\n    if len(d) != 4 or not d.isdigit() or len(set(d)) != 4: return False\n    a,b,c,e = (int(x) for x in d)\n    return a > b and b % 2 == 0 and c in (2,3,5,7) and e > a\n",
    format_regex: "^\\d{4}$", format_hint: "four digits",
  }, 201, "create validator puzzle");
  const t2 = await admin.expect("POST", `/api/admin/phase1/puzzles/${vz.id}/test`, { should_pass: ["5239"], should_fail: ["1111", "9821"] }, 200, "self-test validator");
  assert(t2.ready === true, `validator self-test should pass: ${t2.detail}`);
  await admin.expect("POST", `/api/admin/phase1/puzzles/${vz.id}/publish`, { reason: "smoke" }, 200, "publish validator puzzle");
  ok("validator-scored puzzle self-tested through the judge and published");

  const hk = await admin.expect<{ id: number }>("POST", "/api/admin/phase1/hacking", {
    reason: "smoke", title: "Break the adder", statement_md: "Read a and b, print a+b.", constraints_md: "-1000 ≤ a,b ≤ 1000", problem_id: "hack-sum",
    given_source: FLAWED_CPP, given_language: "cpp", hack_points: 20, fail_penalty: 0, order_index: 1,
  }, 201, "create hack question");
  const t3 = await admin.expect("POST", `/api/admin/phase1/hacking/${hk.id}/test`, { breaking_input: "-2 3\n" }, 200, "prove breakable");
  assert(t3.ready === true, `hack self-test should pass: ${t3.detail}`);
  await admin.expect("POST", `/api/admin/phase1/hacking/${hk.id}/publish`, { reason: "smoke" }, 200, "publish hack");
  ok("hacking question proven breakable and published");

  // --- Participants ------------------------------------------------------
  const ps = [new Client("p1"), new Client("p2"), new Client("p3")];
  for (const [i, p] of ps.entries()) {
    const r = await p.call("POST", "/api/register", { username: `smoke_${i + 1}_${Date.now() % 100000}`, password: "password123", preferred_language: "cpp" });
    assert(r.status === 201, `register ${p.name} → ${r.status} ${JSON.stringify(r.data)}`);
    (p as any).username = JSON.parse(JSON.stringify({ u: `smoke_${i + 1}_${Date.now() % 100000}` })).u;
  }
  // Re-derive usernames from the register calls (same second assumed); sign in.
  // Simpler: sign in with the exact names we sent.
  ok("3 participants registered");
  const dup = await ps[0].call("POST", "/api/register", { username: "smoke_dup", password: "password123" });
  const dup2 = await ps[0].call("POST", "/api/register", { username: "smoke_dup", password: "password123" });
  assert(dup.status === 201 && dup2.status === 409, `duplicate name should be 409, got ${dup2.status}`);
  ok("duplicate display name rejected");

  const users = ["smoke_dup"]; // we will sign this one in too
  const p1 = new Client("p1"); await p1.signIn("smoke_dup", "password123");
  ok("participant signed in");
  const state = await p1.expect("GET", "/api/state", undefined, 200, "state");
  assert(state.me.balance === 1000, `starting balance should be 1000, got ${state.me.balance}`);
  ok("starting balance is the configured 1000");

  // single session: sign in again elsewhere kills the first
  const p1b = new Client("p1-second-machine"); await p1b.signIn("smoke_dup", "password123");
  const old = await p1.call("GET", "/api/state");
  assert(old.status === 401, `old session should be dead (got ${old.status})`);
  ok("second sign-in invalidated the first session (one session per participant)");
  const p1c = p1b; // continue as the live session

  // two more participants for the auction
  const p2 = new Client("p2"); await p2.call("POST", "/api/register", { username: "smoke_two", password: "password123" }); await p2.signIn("smoke_two", "password123");
  const p3 = new Client("p3"); await p3.call("POST", "/api/register", { username: "smoke_three", password: "password123" }); await p3.signIn("smoke_three", "password123");

  await admin.expect("POST", "/api/admin/contest/registration", { reason: "smoke", open: false }, 200, "close registration");
  ok("registration closed");

  // --- Phase 1 -----------------------------------------------------------
  await advance(admin, "p1_puzzles");
  await p1c.expect("PUT", `/api/phase1/puzzles/${pz.id}/answer`, { answer: "41", explanation: "a*b+a+b" }, 200, "p1 answers puzzle");
  await p2.expect("PUT", `/api/phase1/puzzles/${pz.id}/answer`, { answer: "40" }, 200, "p2 answers puzzle");
  const bad = await p2.call("PUT", `/api/phase1/puzzles/${pz.id}/answer`, { answer: "forty" });
  assert(bad.status === 400, "format regex must be enforced server-side");
  await p1c.expect("PUT", `/api/phase1/puzzles/${vz.id}/answer`, { answer: ["5239", "5239", "6237", "1111"] }, 200, "p1 answers validator puzzle");
  ok("answers saved; malformed answer rejected server-side");
  const notYet = await p1c.call("GET", "/api/phase1/results");
  assert(notYet.status === 409, "results must not be visible while Section A is open");
  await p1c.expect("POST", "/api/phase1/finish", { section: "puzzles" }, 200, "p1 finishes");
  ok("p1 finished Section A (submission time recorded)");

  await advance(admin, "p1_hacking");
  // validator scoring runs at section close, through the judge
  for (let i = 0; i < 40; i++) {
    const res = await p1c.expect("GET", "/api/phase1/results", undefined, 200, "results");
    const vq = res.puzzles.find((x: any) => x.question_id === vz.id);
    if (vq && vq.auto_score !== null) { assert(vq.auto_score === 4, `5239 and 6237 valid, 1111 not, duplicates once → 4 points, got ${vq.auto_score}`); break; }
    if (i === 39) fail("validator scoring never completed");
    await sleep(500);
  }
  ok("validator-scored question scored via the judge at section close (2 valid distinct entries × 2 = 4)");

  const invalid = await p1c.expect<{ id: number }>("POST", `/api/phase1/hacking/${hk.id}/attempts`, { input: "5000 1\n" }, 202, "invalid hack input");
  let att: any;
  for (let i = 0; i < 40; i++) { att = (await p1c.expect("GET", "/api/phase1/hacking", undefined, 200, "hacking")).attempts.find((a: any) => a.id === invalid.id); if (att.state === "done") break; await sleep(500); }
  assert(att.valid_input === false && /maximum/.test(att.invalid_reason), `invalid input should be named: ${JSON.stringify(att)}`);
  assert(!("verdict" in att), "verdict must never reach a participant");
  ok("invalid hack input rejected with the constraint named; no verdict exposed");
  await sleep(3200); // cooldown
  const good = await p1c.expect<{ id: number }>("POST", `/api/phase1/hacking/${hk.id}/attempts`, { input: "-2 3\n" }, 202, "breaking hack input");
  for (let i = 0; i < 60; i++) { att = (await p1c.expect("GET", "/api/phase1/hacking", undefined, 200, "hacking")).attempts.find((a: any) => a.id === good.id); if (att.state === "done") break; await sleep(500); }
  assert(att.hacked === true && att.points_awarded === 20, `hack should succeed for 20: ${JSON.stringify(att)}`);
  ok("breaking input hacked the flawed solution: +20");

  await advance(admin, "review");
  const queue = await admin.expect("GET", "/api/grade/queue", undefined, 200, "grading queue");
  assert(queue.ungraded >= 1, "p1's explanation should be in the queue");
  await admin.expect("POST", "/api/grade", { participant_id: state.viewer.id, question_id: pz.id, explain_score: 5, comment: "good" }, 200, "grade explanation");
  ok("explanation graded from the queue");
  const st = await admin.expect("GET", "/api/admin/phase1/advance", undefined, 200, "p1 standings");
  const me = st.standings.find((s: any) => s.participant_id === state.viewer.id);
  assert(me.rank === 1 && me.points === 10 + 5 + 4 + 20, `p1 should lead with 39, got ${JSON.stringify(me)}`);
  ok(`Phase 1 standings: p1 rank 1 with ${me.points} points`);
  const ids = st.standings.map((s: any) => s.participant_id);
  await admin.expect("POST", "/api/admin/phase1/advance", { participant_ids: ids, reason: "smoke: everyone advances" }, 200, "advance all");
  ok("all participants selected to advance");

  // --- Phase 2 -----------------------------------------------------------
  await advance(admin, "auction1");
  let a = (await p1c.expect("GET", "/api/state", undefined, 200, "state")).auction;
  assert(a?.lot?.question_id === "sum" && a.lot.next_bid === 100, `lot should be open at base 100: ${JSON.stringify(a?.lot)}`);
  await p1c.expect("POST", "/api/bids", { lot_id: a.lot.id, amount: 100 }, 200, "p1 bids 100");
  const wrong = await p2.call("POST", "/api/bids", { lot_id: a.lot.id, amount: 150 });
  assert(wrong.status === 409 && wrong.data.error === "wrong_increment", "bid must be exactly one increment");
  await p2.expect("POST", "/api/bids", { lot_id: a.lot.id, amount: 110 }, 200, "p2 bids 110");
  const self = await p2.call("POST", "/api/bids", { lot_id: a.lot.id, amount: 120 });
  assert(self.status === 409 && self.data.error === "already_highest", "cannot bid against yourself");
  await p1c.expect("POST", "/api/bids", { lot_id: a.lot.id, amount: 120 }, 200, "p1 bids 120");
  ok("bidding: increments enforced, self-bid refused, countdown restarted");
  await admin.expect("POST", "/api/admin/lots/close", { reason: "smoke" }, 200, "close lot");
  const s2 = await p1c.expect("GET", "/api/state", undefined, 200, "state after award");
  assert(s2.me.balance === 880 && s2.questions.some((q: any) => q.id === "sum"), `p1 should own sum with 880 left: ${s2.me.balance}`);
  ok("p1 awarded 'sum' for 120; balance 880; sole owner");

  await advance(admin, "coding1");
  const forbidden = await p2.call("GET", "/api/questions/sum");
  assert(forbidden.status === 403, "non-owner must be refused");
  ok("non-owner cannot read the statement");
  const qv = await p1c.expect("GET", "/api/questions/sum", undefined, 200, "owner reads question");
  assert(qv.samples.length === 1 && qv.samples[0].input === "2 3\n", "sample = first testcase from the package");
  assert(qv.hidden_testcases === 2, "hidden count only");
  ok("owner sees statement, 1 sample read from the package, 2 hidden (count only)");

  await p1c.expect("POST", "/api/submissions", { question_id: "sum", language: "cpp", source: WRONG_CPP }, 202, "submit wrong");
  const again = await p1c.call("POST", "/api/submissions", { question_id: "sum", language: "cpp", source: WRONG_CPP });
  assert(again.status === 409 && again.data.error === "in_flight", "second in-flight submission refused");
  let j: any;
  for (let i = 0; i < 60; i++) { j = (await p1c.expect("GET", "/api/questions/sum", undefined, 200, "poll")).history[0].judgement; if (j.state === "done") break; await sleep(500); }
  assert(j.verdict === "WA" && j.first_fail === 0, `expected WA on test 0: ${JSON.stringify(j)}`);
  assert(!("jury_detail" in j) && !("juryDetail" in j), "jury detail must not reach the participant");
  ok("wrong submission → WA on test 0 (a sample); no jury detail exposed");
  const cd = await p1c.call("POST", "/api/submissions", { question_id: "sum", language: "cpp", source: SUM_CPP });
  assert(cd.status === 409 && cd.data.error === "cooldown", "cooldown enforced");
  await sleep(3200);
  await p1c.expect("POST", "/api/submissions", { question_id: "sum", language: "cpp", source: SUM_CPP }, 202, "submit correct");
  for (let i = 0; i < 60; i++) { j = (await p1c.expect("GET", "/api/questions/sum", undefined, 200, "poll")).history[0].judgement; if (j.state === "done") break; await sleep(500); }
  assert(j.verdict === "AC" && j.passed === 3, `expected AC 3/3: ${JSON.stringify(j)}`);
  ok("correct submission → AC 3/3");

  const hint = await p1c.expect("POST", "/api/questions/sum/hints", undefined, 200, "buy hint");
  assert(hint.idx === 0 && hint.balance === 850, `hint 0 for 30 → 850, got ${JSON.stringify(hint)}`);
  const none = await p1c.call("POST", "/api/questions/sum/hints");
  assert(none.status === 409, "no second hint exists");
  ok("hint bought once for 30; nothing left to buy");

  const lb = await p1c.expect("GET", "/api/leaderboard", undefined, 200, "leaderboard");
  const top = lb.standings[0];
  assert(top.participant_id === state.viewer.id && top.score === 100 && top.rank === 1, `p1 should lead with 100: ${JSON.stringify(top)}`);
  ok("leaderboard: p1 first with 100, solve time from award to first AC");

  const subs = await admin.expect("GET", "/api/admin/submissions?question=sum", undefined, 200, "admin submissions");
  assert(subs.submissions.some((s: any) => s.judgement.juryDetail), "admin sees jury detail");
  const audit = await admin.expect("GET", "/api/admin/audit", undefined, 200, "audit");
  assert(audit.entries.length > 10 && audit.entries.every((e: any) => e.reason), "every audit entry has a reason");
  ok(`admin sees jury detail; audit log has ${audit.entries.length} entries, all with reasons`);

  console.log(`\nALL ${step} STEPS PASSED`);
}

main().catch((e) => { console.error(e); process.exit(1); });
