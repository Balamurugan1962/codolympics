/**
 * Client for the judge service (judge/openapi.yaml). The judge is the only
 * thing that runs code; this file is the only thing that talks to it.
 *
 * It trusts us with a shared bearer token and authenticates no participants.
 */
import { ApiError, errors } from "./api";

const JUDGE_URL = (process.env.JUDGE_URL ?? "http://localhost:8000").replace(/\/$/, "");
const TOKEN = process.env.JUDGE_SERVICE_TOKEN ?? "";

export type Verdict = "AC" | "WA" | "TLE" | "MLE" | "OLE" | "RE" | "CE" | "IE";

export type Judgement = {
  submission_id: string | null;
  verdict: Verdict;
  passed: number;
  total: number;
  first_fail: number | null;
  max_time_ms: number;
  max_memory_kb: number;
  compile_output: string;
  message: string;
  jury_detail: string;
  problem_version: string;
  duration_ms: number;
};

export type HackResult = {
  submission_id: string | null;
  valid_input: boolean;
  invalid_reason: string;
  hacked: boolean | null;
  verdict: Verdict | null;
  message: string;
  problem_version: string;
  duration_ms: number;
};

export type AnswersResult = {
  submission_id: string | null;
  status: "ok" | "IE";
  results: { valid: boolean; error: string | null }[];
  message: string;
};

export type JobState<R> = {
  job_id: string;
  state: "queued" | "running" | "done";
  progress: { done: number; total: number };
  poll_after_ms: number | null;
  result: R | null;
};

export type ProblemInfo = {
  problem_id: string;
  testcases: number;
  time_limit_ms: number;
  memory_limit_mb: number;
  compare: string;
  early_exit: boolean;
  version: string;
  bytes: number;
  validated: boolean;
  modified_at: string | null;
  has_reference: boolean;
  hack_only: boolean;
};

export type ValidationReport = {
  problem_id: string;
  ok: boolean;
  testcases: number;
  version: string;
  issues: string[];
  checker: { compiled: boolean; output: string } | null;
  reference: { verdict: Verdict; first_fail: number | null; passed: number; max_time_ms: number } | null;
  wrong_solution: { verdict: Verdict; first_fail: number | null } | null;
};

export type Health = { status: "ok" | "degraded"; go_judge: "ok" | "unreachable"; problems: number; busy: number; capacity: number };

export type Language = { key: string; name: string; compiled: boolean };

/** Thrown when the judge answered with an error body. `code` is its `error`. */
/**
 * A failure that came from the judge rather than from us.
 *
 * It extends ApiError so a route returns the judge's own reason instead of
 * "something went wrong on the server". An operator reading "no such problem:
 * two-sum" can act on it; a 500 tells them only that we are not saying.
 *
 * The status is remapped for the caller of *our* API: the judge being
 * unreachable is a 503 on our side, and a 4xx from the judge is our 502 unless
 * it is genuinely the caller's fault.
 */
export class JudgeError extends ApiError {
  constructor(
    public judgeStatus: number,
    code: string,
    message: string,
  ) {
    super(
      judgeStatus === 0 ? 503 : judgeStatus === 404 ? 409 : judgeStatus >= 400 && judgeStatus < 500 ? 400 : 502,
      judgeStatus === 0 ? "judge_unavailable" : `judge_${code}`,
      message,
    );
  }
}

async function call<T>(method: string, path: string, payload?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${JUDGE_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {
    throw new JudgeError(0, "unreachable", `cannot reach the judge at ${JUDGE_URL}`);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new JudgeError(res.status, (data as { error?: string }).error ?? "error", (data as { message?: string }).message ?? res.statusText);
  }
  return data as T;
}

export const judge = {
  health: () => call<Health>("GET", "/health"),
  languages: async () => (await call<{ languages: Language[] }>("GET", "/languages")).languages,
  problems: async () => (await call<{ problems: ProblemInfo[] }>("GET", "/problems")).problems,
  problem: (id: string) => call<ProblemInfo>("GET", `/problems/${encodeURIComponent(id)}`),
  validate: (id: string, req: { reference_source?: string; wrong_source?: string; language?: string }, version?: string) =>
    call<ValidationReport>("POST", `/problems/${encodeURIComponent(id)}/validate${version ? `?version=${encodeURIComponent(version)}` : ""}`, req),
  testcase: (id: string, index: number, version?: string) =>
    call<{ input: string; answer: string; truncated: boolean; version: string }>(
      "GET",
      `/problems/${encodeURIComponent(id)}/testcases/${index}${version ? `?version=${encodeURIComponent(version)}` : ""}`,
    ),

  submit: (req: { problem_id: string; language: string; source: string; submission_id: string }) =>
    call<{ job_id: string }>("POST", "/submit", req),
  hack: (req: { problem_id: string; language: string; source: string; input: string; submission_id: string }) =>
    call<{ job_id: string }>("POST", "/hack", req),
  validateAnswers: (req: { validator: string; entries: string[]; submission_id: string }) =>
    call<{ job_id: string }>("POST", "/validate-answers", req),

  job: <R>(jobId: string) => call<JobState<R>>("GET", `/jobs/${encodeURIComponent(jobId)}`),
  cancel: (jobId: string) => call<void>("DELETE", `/jobs/${encodeURIComponent(jobId)}`),
};

/** Turn a judge failure into the right API response for the participant. */
export function judgeErrorToApi(err: unknown): ApiError {
  if (err instanceof JudgeError) {
    if (err.status === 0 || err.status === 503) return errors.judgeDown();
    if (err.status === 429) return new ApiError(429, "judge_busy", "the judge is at capacity; try again in a moment");
    return new ApiError(502, "judge_error", err.message);
  }
  return errors.judgeDown();
}
