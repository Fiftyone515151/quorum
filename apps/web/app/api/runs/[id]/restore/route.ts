import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@quorum/db";
import { getSession } from "@/lib/auth";
import { authorizeRun } from "@/lib/authorize";

export const dynamic = "force-dynamic";

/** Restore a soft-deleted run (clear deletedAt), owner-scoped. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const authz = await authorizeRun(await getSession(), params.id, (id) =>
    prisma.modeRun.findUnique({ where: { id }, include: { company: { select: { ownerId: true } } } })
  );
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });
  await prisma.modeRun.update({ where: { id: params.id }, data: { deletedAt: null } });
  return NextResponse.json({ ok: true });
}
