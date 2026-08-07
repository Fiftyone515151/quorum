import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, RunStatus } from "@quorum/db";
import { redis } from "@/lib/redis";
import { controlInboxKey, eventsChannel, inboxKey, pauseKey } from "@/lib/keys";
import { getSession } from "@/lib/auth";
import { authorizeRun } from "@/lib/authorize";

export const dynamic = "force-dynamic";

const findRun = (id: string) =>
  prisma.modeRun.findUnique({ where: { id }, include: { company: { select: { ownerId: true } } } });

// Founder input is one of two known shapes; anything else is rejected.
const boardInput = z.object({
  kind: z.literal("board_items"),
  responses: z
    .array(
      z.object({
        id: z.string().min(1),
        status: z.enum(["already_doing", "added_context", "unaware"]),
        note: z.string().max(2000).optional(),
      })
    )
    .min(1),
});
const teaInput = z.object({
  kind: z.literal("tea_interjection").optional(),
  content: z.string().min(1).max(4000),
});
const pauseInput = z.object({ kind: z.literal("pause"), segment: z.string().max(20).optional() });
const resumeInput = z.object({ kind: z.literal("resume") });
const openInterjection = z.object({
  kind: z.literal("founder_interjection"),
  content: z.string().trim().min(1).max(4000),
  segment: z.string().max(20),
  clientMessageId: z.string().uuid(),
});
const founderInput = z.union([boardInput, teaInput, pauseInput, resumeInput, openInterjection]);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authz = await authorizeRun(await getSession(), params.id, findRun);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  const parsed = founderInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;

  if (body.kind === "pause" || body.kind === "resume" || body.kind === "founder_interjection") {
    if (authz.run.mode !== "tea" && authz.run.mode !== "board")
      return NextResponse.json({ error: "Founder interjections are only available in Board and Founder Tea." }, { status: 409 });

    if (body.kind === "pause") {
      if (authz.run.status !== "running")
        return NextResponse.json({ error: "This session cannot be paused right now." }, { status: 409 });
      await redis.set(pauseKey(authz.run.id), body.segment ?? "active", "EX", 60 * 30);
      await prisma.modeRun.update({ where: { id: authz.run.id }, data: { status: RunStatus.awaiting_founder } });
      await redis.publish(eventsChannel(authz.run.id), JSON.stringify({ type: "status", status: "awaiting_founder" }));
      return NextResponse.json({ ok: true });
    }

    if (!(await redis.get(pauseKey(authz.run.id))))
      return NextResponse.json({ error: "The conversation is no longer paused." }, { status: 409 });

    if (body.kind === "resume") {
      await redis.rpush(controlInboxKey(authz.run.id), JSON.stringify({ action: "resume" }));
      return NextResponse.json({ ok: true });
    }

    try {
      await prisma.founderInput.create({
        data: { id: body.clientMessageId, runId: authz.run.id, kind: body.kind, refId: body.segment, payload: body },
      });
    } catch (error: any) {
      if (error?.code !== "P2002") throw error;
    }
    await redis.rpush(controlInboxKey(authz.run.id), JSON.stringify({ action: "submit", content: body.content }));
    return NextResponse.json({ ok: true, messageId: body.clientMessageId });
  }

  if (body.kind === "board_items" && authz.run.mode !== "board")
    return NextResponse.json({ error: "Board responses can only be sent to a Board session." }, { status: 409 });
  if ((body.kind === "tea_interjection" || body.kind == null) && authz.run.mode !== "tea")
    return NextResponse.json({ error: "Tea interjections can only be sent to Founder Tea." }, { status: 409 });

  const kind = "kind" in body && body.kind ? body.kind : "tea_interjection";

  await prisma.founderInput.create({ data: { runId: authz.run.id, kind, payload: body } });
  await redis.rpush(inboxKey(authz.run.id), JSON.stringify(body));
  return NextResponse.json({ ok: true });
}
