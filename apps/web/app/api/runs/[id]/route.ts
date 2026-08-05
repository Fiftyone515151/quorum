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
  // Don't delete a run the worker is still executing (would corrupt its writes).
  if (authz.run.status === "running" || authz.run.status === "awaiting_founder")
    return NextResponse.json(
      { error: "This session is still running — wait for it to finish before deleting." },
      { status: 409 }
    );
  // Soft delete: hide from lists but keep the record recoverable for 30 days.
  await prisma.modeRun.update({ where: { id: params.id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
