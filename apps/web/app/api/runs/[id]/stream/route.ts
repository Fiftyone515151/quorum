import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@quorum/db";
import { makeSubscriber } from "@/lib/redis";
import { eventsChannel } from "@/lib/keys";
import { getSession } from "@/lib/auth";
import { authorizeRun } from "@/lib/authorize";

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

  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        } catch {
          /* closed */
        }
      };
      send(JSON.stringify({ type: "hello" }));
      sub.subscribe(channel).catch(() => {});
      sub.on("message", (_ch, message) => send(message));

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
