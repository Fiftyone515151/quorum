import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@quorum/db";
import { makeSubscriber } from "@/lib/redis";
import { eventsChannel } from "@/lib/keys";
import { getSession } from "@/lib/auth";
import { authorizeRun } from "@/lib/authorize";
import { resumeAfter } from "@/lib/sse";

export const dynamic = "force-dynamic";

const findRun = (id: string) =>
  prisma.modeRun.findUnique({ where: { id }, include: { company: { select: { ownerId: true } } } });

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  // Data isolation: only the run's owner may subscribe to its live transcript.
  const authz = await authorizeRun(await getSession(), params.id, findRun);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  const channel = eventsChannel(params.id);
  const sub = makeSubscriber();
  const encoder = new TextEncoder();

  // Resume point: Last-Event-ID (auto-sent on reconnect) else ?after= (fresh load).
  const after = resumeAfter(req.headers.get("last-event-id"), req.nextUrl.searchParams.get("after"));

  const stream = new ReadableStream({
    start(controller) {
      let backfilling = true;
      const buffered: string[] = [];
      let maxSent = after;

      const emit = (payload: string, id?: number) => {
        try {
          if (id != null) controller.enqueue(encoder.encode(`id: ${id}\n`));
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch {
          /* closed */
        }
      };
      // Forward a live event, skipping anything already covered by the backfill.
      const emitLive = (message: string) => {
        let seq: number | undefined;
        try { seq = JSON.parse(message)?.seq; } catch { /* non-JSON */ }
        if (typeof seq === "number") {
          if (seq <= maxSent) return; // already replayed
          maxSent = seq;
          emit(message, seq);
        } else {
          emit(message); // e.g. deltas without a seq
        }
      };

      emit(JSON.stringify({ type: "hello" })); // no id — must not reset Last-Event-ID

      // Subscribe first (buffer live events), then backfill from the durable log,
      // then flush the buffer. This avoids both losing and duplicating events.
      sub.subscribe(channel)
        .then(() => {
          sub.on("message", (_ch, message) => {
            if (backfilling) buffered.push(message);
            else emitLive(message);
          });
          return prisma.runEvent.findMany({
            where: { runId: params.id, seq: { gt: after } },
            orderBy: { seq: "asc" },
          });
        })
        .then((rows) => {
          for (const r of rows ?? []) {
            emit(JSON.stringify({ ...(r.payload as any), seq: r.seq }), r.seq);
            if (r.seq > maxSent) maxSent = r.seq;
          }
        })
        .catch(() => {})
        .finally(() => {
          backfilling = false;
          for (const m of buffered) emitLive(m);
          buffered.length = 0;
        });

      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* closed */
        }
      }, 15000);

      const close = () => {
        clearInterval(ping);
        sub.unsubscribe(channel).catch(() => {});
        sub.quit().catch(() => {});
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", close);
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
