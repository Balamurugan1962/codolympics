import { subscribe, type EventName } from "@/lib/events";
import { requireApiViewer } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events (decision 67). One stream per open page. The browser
 * reconnects on its own; on reconnect the client re-reads /api/state.
 */
export async function GET(req: Request) {
  let viewer;
  try {
    viewer = await requireApiViewer();
  } catch {
    return new Response("sign in required", { status: 401 });
  }

  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (name: EventName | "hello" | "ping", data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      send("hello", { server_now: Date.now() });
      unsubscribe = subscribe({ userId: viewer.id, role: viewer.role, send });
      heartbeat = setInterval(() => send("ping", { server_now: Date.now() }), 15_000);
      req.signal.addEventListener("abort", () => {
        unsubscribe();
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      unsubscribe();
      clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
