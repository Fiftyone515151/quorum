import { NextRequest, NextResponse } from "next/server";
import { prisma, RunStatus } from "@quorum/db";
import { redis } from "@/lib/redis";
import { JOBS_CHANNEL } from "@/lib/keys";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const run = await prisma.modeRun.findUnique({ where: { id: params.id }, include: { company: { select: { ownerId: true } } } });
  if (!run || run.company.ownerId !== s.userId) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (run.status === "running") return NextResponse.json({ ok: true, already: true });

  await prisma.modeRun.update({ where: { id: run.id }, data: { status: RunStatus.running } });
  await redis.publish(JOBS_CHANNEL, JSON.stringify({ runId: run.id }));
  return NextResponse.json({ ok: true });
}
