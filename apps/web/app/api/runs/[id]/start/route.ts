import { NextRequest, NextResponse } from "next/server";
import { prisma, RunStatus } from "@quorum/db";
import { enqueueJob } from "@quorum/engine";
import { redis } from "@/lib/redis";
import { getSession } from "@/lib/auth";
import { authorizeRun } from "@/lib/authorize";

export const dynamic = "force-dynamic";

const findRun = (id: string) =>
  prisma.modeRun.findUnique({ where: { id }, include: { company: { select: { ownerId: true } } } });

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const authz = await authorizeRun(await getSession(), params.id, findRun);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });
  if (authz.run.status === "running") return NextResponse.json({ ok: true, already: true });

  await prisma.modeRun.update({ where: { id: authz.run.id }, data: { status: RunStatus.running } });
  // Durable queue (LPUSH) instead of fire-and-forget pub/sub: the job survives a
  // worker restart and is picked up on reconnect.
  await enqueueJob(redis, { runId: authz.run.id });
  return NextResponse.json({ ok: true });
}
