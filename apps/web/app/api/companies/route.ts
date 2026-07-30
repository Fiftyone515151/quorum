import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, Stage } from "@quorum/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1),
  bp: z.string().min(1),
  fundingCurrency: z.string().optional(),
  valuation: z.string().optional(),
  roundSize: z.string().optional(),
  stage: z.enum(["pre_seed", "seed", "A"]),
  topic: z.string().optional(),
});

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companies = await prisma.company.findMany({
    where: { ownerId: s.userId },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ companies });
}

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const c = await prisma.company.create({
    data: { ...parsed.data, stage: parsed.data.stage as Stage, ownerId: s.userId },
  });
  return NextResponse.json({ company: c });
}
