import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@quorum/db";
import { redis } from "@/lib/redis";
import { inboxKey } from "@/lib/keys";
import { getSession } from "@/lib/auth";
import { authorizeRun } from "@/lib/authorize";

export const dynamic = "force-dynamic";

const findRun = (id: string) =>
  prisma.modeRun.findUnique({ where: { id }, include: { company: { select: { ownerId: true } } } });

/**
 * Founder input inbox. Accepts:
 *  - Board:  { kind: "board_items", responses: [{ id, status, note? }] }
 *  - Tea:    { content: "..." }
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const authz = await authorizeRun(await getSession(), params.id, findRun);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid" }, { status: 400 });

  await prisma.founderInput.create({ data: { runId: authz.run.id, kind: (body as any).kind ?? "tea_interjection", payload: body } });
  await redis.rpush(inboxKey(authz.run.id), JSON.stringify(body));
  return NextResponse.json({ ok: true });
}
