import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@quorum/db";
import { getSession } from "@/lib/auth";
import { authorizeRun } from "@/lib/authorize";

export const dynamic = "force-dynamic";

const findRun = (id: string) =>
  prisma.modeRun.findUnique({ where: { id }, include: { company: { select: { ownerId: true } } } });

/** Durable event log for replay: returns persisted events with seq > ?after (default 0). */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const authz = await authorizeRun(await getSession(), params.id, findRun);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  const after = Number(req.nextUrl.searchParams.get("after") ?? "0") || 0;
  const events = await prisma.runEvent.findMany({
    where: { runId: params.id, seq: { gt: after } },
    orderBy: { seq: "asc" },
    take: 5000,
  });
  return NextResponse.json({ events: events.map((e) => ({ seq: e.seq, type: e.type, payload: e.payload })) });
}
