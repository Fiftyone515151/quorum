import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@quorum/db";
import { getSession } from "@/lib/auth";
import { isDemoUser, DEMO_READONLY_ERROR } from "@/lib/demo";
import { buildCompanyData, companyInputSchema } from "@/lib/companyWrite";
import { rebuildCorpus } from "@/lib/corpus";

export const dynamic = "force-dynamic";

async function owned(id: string, userId: string) {
  const c = await prisma.company.findUnique({ where: { id } });
  return c && c.ownerId === userId ? c : null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const c = await owned(params.id, s.userId);
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ company: c });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(s.email)) return NextResponse.json({ error: DEMO_READONLY_ERROR }, { status: 403 });
  const current = await owned(params.id, s.userId);
  if (!current) return NextResponse.json({ error: "not found" }, { status: 404 });
  const parsed = companyInputSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = await buildCompanyData(parsed.data);
  await prisma.company.update({ where: { id: params.id }, data });
  // Re-derive bp from the (possibly changed) topic/profile + existing documents.
  const company = await rebuildCorpus(params.id);
  return NextResponse.json({ company });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemoUser(s.email)) return NextResponse.json({ error: DEMO_READONLY_ERROR }, { status: 403 });
  if (!(await owned(params.id, s.userId))) return NextResponse.json({ error: "not found" }, { status: 404 });
  await prisma.company.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
