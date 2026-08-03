import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@quorum/db";
import { getSession } from "@/lib/auth";
import { authorizeRun } from "@/lib/authorize";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const authz = await authorizeRun(await getSession(), params.id, (id) =>
    prisma.modeRun.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, ownerId: true } },
        roles: { include: { persona: true }, orderBy: { order: "asc" } },
        turns: { orderBy: { seq: "asc" } },
      },
    })
  );
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });
  return NextResponse.json({ run: authz.run });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const authz = await authorizeRun(await getSession(), params.id, (id) =>
    prisma.modeRun.findUnique({ where: { id }, include: { company: { select: { ownerId: true } } } })
  );
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });
  await prisma.modeRun.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
