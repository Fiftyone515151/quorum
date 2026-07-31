import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@quorum/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const run = await prisma.modeRun.findUnique({
    where: { id: params.id },
    include: {
      company: { select: { id: true, ownerId: true } },
      roles: { include: { persona: true }, orderBy: { order: "asc" } },
      turns: { orderBy: { seq: "asc" } },
    },
  });
  if (!run || run.company.ownerId !== s.userId) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ run });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const run = await prisma.modeRun.findUnique({
    where: { id: params.id },
    include: { company: { select: { ownerId: true } } },
  });
  if (!run || run.company.ownerId !== s.userId) return NextResponse.json({ error: "not found" }, { status: 404 });
  await prisma.modeRun.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
