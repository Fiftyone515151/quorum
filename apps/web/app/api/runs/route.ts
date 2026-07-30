import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, Mode } from "@quorum/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  companyId: z.string(),
  mode: z.enum(["screening", "ic", "board", "tea"]),
  participants: z.array(z.string()).min(2).max(6),
  inheritedFromId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;

  const company = await prisma.company.findUnique({ where: { id: b.companyId } });
  if (!company || company.ownerId !== s.userId)
    return NextResponse.json({ error: "company not found" }, { status: 404 });

  const companySnapshot = {
    name: company.name,
    bp: company.bp,
    fundingCurrency: company.fundingCurrency,
    valuation: company.valuation,
    roundSize: company.roundSize,
    stage: company.stage,
    topic: company.topic,
  };

  const run = await prisma.modeRun.create({
    data: {
      companyId: company.id,
      companySnapshot,
      mode: b.mode as Mode,
      stage: company.stage,
      inheritedFromId: b.inheritedFromId,
      roles: { create: b.participants.map((personaId, i) => ({ personaId, order: i })) },
    },
  });
  return NextResponse.json({ runId: run.id });
}

/** History: runs for the current user, optionally filtered by company. */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = req.nextUrl.searchParams.get("companyId") ?? undefined;
  const runs = await prisma.modeRun.findMany({
    where: { company: { ownerId: s.userId }, ...(companyId ? { companyId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { company: { select: { id: true, name: true } } },
  });
  return NextResponse.json({
    runs: runs.map((r) => ({
      id: r.id, mode: r.mode, status: r.status, createdAt: r.createdAt,
      companyId: r.companyId, companyName: (r.companySnapshot as any)?.name ?? r.company.name,
    })),
  });
}
