"use client";

/**
 * The browser's one way to call the API. Errors arrive as `{ error, message }`
 * and are thrown as ApiClientError so components show `message` directly.
 */
export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, payload?: unknown, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: payload instanceof FormData ? undefined : { "Content-Type": "application/json" },
    body: payload instanceof FormData ? payload : payload === undefined ? undefined : JSON.stringify(payload),
    cache: "no-store",
    ...init,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiClientError(res.status, data?.error ?? "error", data?.message ?? `request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, payload?: unknown) => request<T>("POST", path, payload),
  put: <T>(path: string, payload?: unknown) => request<T>("PUT", path, payload),
  patch: <T>(path: string, payload?: unknown) => request<T>("PATCH", path, payload),
  del: <T>(path: string, payload?: unknown) => request<T>("DELETE", path, payload),
};

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "something went wrong";
}
