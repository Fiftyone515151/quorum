import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, Stage } from "@quorum/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  bp: z.string().min(1).optional(),
  fundingCurrency: z.string().optional(),
  valuation: z.string().optional(),
  roundSize: z.string().optional(),
  stage: z.enum(["pre_seed", "seed", "A"]).optional(),
  topic: z.string().optional(),
});

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
  if (!(await owned(params.id, s.userId))) return NextResponse.json({ error: "not found" }, { status: 404 });
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data: any = { ...parsed.data };
  if (data.stage) data.stage = data.stage as Stage;
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
