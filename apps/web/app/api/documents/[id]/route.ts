import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@quorum/db";
import { getSession } from "@/lib/auth";
import { isDemoUser, DEMO_READONLY_ERROR } from "@/lib/demo";
import { rebuildCorpus } from "@/lib/corpus";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(s.email)) return NextResponse.json({ error: DEMO_READONLY_ERROR }, { status: 403 });

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    include: { company: { select: { ownerId: true } } },
  });
  if (!doc || doc.company.ownerId !== s.userId) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.document.delete({ where: { id: params.id } });
  await rebuildCorpus(doc.companyId);
  return NextResponse.json({ ok: true });
}
