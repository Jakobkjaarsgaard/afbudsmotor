import { NextRequest } from "next/server";
import { realtimeBus, type RealtimeSlotEvent } from "@/lib/realtime-bus";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const clinicId = req.nextUrl.searchParams.get("clinicId");
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
          );
        } catch {
          // Stream closed
        }
      };

      send({ type: "connected", timestamp: new Date().toISOString() });

      const onEvent = (event: RealtimeSlotEvent) => {
        if (!clinicId || event.clinicId === clinicId) {
          send(event);
        }
      };

      realtimeBus.on("slot_event", onEvent);

      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepAlive);
        }
      }, 20000);

      req.signal.addEventListener("abort", () => {
        clearInterval(keepAlive);
        realtimeBus.off("slot_event", onEvent);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
