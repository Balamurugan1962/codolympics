/**
 * The web app's only way to reach the contest engine.
 *
 * The engine is a separate service with no published port: only this server
 * can reach it, on the internal network. Every request carries the service
 * token, so the engine knows it came through here, and the caller's cookie,
 * so the engine can check the Better Auth session itself. The web app decides
 * nothing about the contest.
 */
const ENGINE_URL = (process.env.ENGINE_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
const SERVICE_TOKEN = process.env.ENGINE_SERVICE_TOKEN ?? "";

/** Request headers worth passing on. Everything else describes the hop to us, not the caller. */
const FORWARDED_REQUEST_HEADERS = ["cookie", "content-type", "accept"];
/** Response headers worth passing back: what the body is, and how to save it. */
const FORWARDED_RESPONSE_HEADERS = ["content-type", "content-disposition", "cache-control"];

function engineHeaders(from: Headers): Headers {
  const headers = new Headers({ "x-engine-token": SERVICE_TOKEN });
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = from.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function unavailable(): Response {
  return Response.json(
    { error: "engine_unavailable", message: "the contest server is not responding; try again in a moment" },
    { status: 503 },
  );
}

/** Pass a browser's /api request to the engine unchanged, and its answer back. */
export async function forward(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  let res: Response;
  try {
    res = await fetch(`${ENGINE_URL}${url.pathname}${url.search}`, {
      method: req.method,
      headers: engineHeaders(req.headers),
      // Streamed, so a large package upload is never held in memory here.
      body: hasBody ? req.body : undefined,
      duplex: hasBody ? "half" : undefined,
      cache: "no-store",
      redirect: "manual",
    } as RequestInit & { duplex?: "half" });
  } catch {
    return unavailable();
  }
  const headers = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = res.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(res.body, { status: res.status, headers });
}

/** A server component's read from the engine, on behalf of the signed-in caller. */
export async function engineGet<T>(path: string, callerHeaders: Headers): Promise<T> {
  const res = await fetch(`${ENGINE_URL}${path}`, { headers: engineHeaders(callerHeaders), cache: "no-store" });
  if (!res.ok) throw new Error(`engine ${path} answered ${res.status}`);
  return (await res.json()) as T;
}
