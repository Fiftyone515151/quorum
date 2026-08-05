import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@quorum/db";
import { getSession } from "@/lib/auth";
import { buildCompanyData, companyInputSchema } from "@/lib/companyWrite";

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
  const current = await owned(params.id, s.userId);
  if (!current) return NextResponse.json({ error: "not found" }, { status: 404 });
  const parsed = companyInputSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = await buildCompanyData(parsed.data, {
    topic: current.topic,
    profile: current.profile,
    docText: current.docText,
  });
  if (!data) return NextResponse.json({ error: "Nothing left to describe the startup." }, { status: 400 });

  const c = await prisma.company.update({ where: { id: params.id }, data });
  return NextResponse.json({ company: c });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await owned(params.id, s.userId))) return NextResponse.json({ error: "not found" }, { status: 404 });
  await prisma.company.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
