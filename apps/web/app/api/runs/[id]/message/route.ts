import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@quorum/db";
import { redis } from "@/lib/redis";
import { inboxKey } from "@/lib/keys";
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
const founderInput = z.union([boardInput, teaInput]);

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authz = await authorizeRun(await getSession(), params.id, findRun);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  const parsed = founderInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;
  const kind = "kind" in body && body.kind ? body.kind : "tea_interjection";

  await prisma.founderInput.create({ data: { runId: authz.run.id, kind, payload: body } });
  await redis.rpush(inboxKey(authz.run.id), JSON.stringify(body));
  return NextResponse.json({ ok: true });
}
