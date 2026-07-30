import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@quorum/db";
import { redis } from "@/lib/redis";
import { inboxKey } from "@/lib/keys";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Founder input inbox. Accepts:
 *  - Board:  { kind: "board_items", responses: [{ id, status, note? }] }
 *  - Tea:    { content: "..." }
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid" }, { status: 400 });

  const run = await prisma.modeRun.findUnique({ where: { id: params.id }, include: { company: { select: { ownerId: true } } } });
  if (!run || run.company.ownerId !== s.userId) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.founderInput.create({ data: { runId: run.id, kind: (body as any).kind ?? "tea_interjection", payload: body } });
  await redis.rpush(inboxKey(run.id), JSON.stringify(body));
  return NextResponse.json({ ok: true });
}
