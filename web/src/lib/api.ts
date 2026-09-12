/**
 * Route handler plumbing, shaped like the judge's: every error the API returns
 * is an ApiError with its status and code decided, and one wrapper turns it
 * into `{ error, message }`. Handlers never build error responses by hand.
 */
import type { z } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const errors = {
  invalid: (message: string) => new ApiError(400, "invalid_request", message),
  unauthorized: () => new ApiError(401, "unauthorized", "sign in required"),
  forbidden: (message = "not allowed") => new ApiError(403, "forbidden", message),
  notFound: (what: string) => new ApiError(404, "not_found", `${what} not found`),
  conflict: (code: string, message: string) => new ApiError(409, code, message),
  judgeDown: () => new ApiError(503, "judge_unavailable", "the judge is unreachable; try again shortly"),
};

export function json<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data, init);
}

/** Parse and validate a JSON body; a bad body is a 400 with the first issue named. */
export async function body<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw errors.invalid("request body must be JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw errors.invalid(`${issue.path.join(".") || "body"}: ${issue.message}`);
  }
  return parsed.data;
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wrap a route handler so thrown ApiErrors become JSON and anything else is a 500. */
export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        return json({ error: err.code, message: err.message }, { status: err.status });
      }
      console.error(err);
      return json({ error: "internal_error", message: "something went wrong on the server" }, { status: 500 });
    }
  };
}
