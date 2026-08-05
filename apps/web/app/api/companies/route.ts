import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@quorum/db";
import { getSession } from "@/lib/auth";
import { buildCompanyData, companyInputSchema } from "@/lib/companyWrite";

export const dynamic = "force-dynamic";

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
  const parsed = companyInputSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (!parsed.data.name?.trim()) return NextResponse.json({ error: "Startup name is required." }, { status: 400 });

  const data = await buildCompanyData(parsed.data);
  if (!data || !data.bp) return NextResponse.json({ error: "Add a business plan or a one-liner first." }, { status: 400 });

  const c = await prisma.company.create({
    data: { ...data, name: data.name!, bp: data.bp, ownerId: s.userId },
  });

  // Finishing onboarding (even if optional questions were skipped) marks the
  // user onboarded so they aren't bounced back to the guided flow.
  if (parsed.data.fromOnboarding) {
    await prisma.user.update({ where: { id: s.userId }, data: { onboardedAt: new Date() } });
  }
  return NextResponse.json({ company: c });
}
