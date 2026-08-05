import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@quorum/db";
import { getSession } from "@/lib/auth";
import { buildCompanyData, companyInputSchema, hasCompanySubstance, extOf } from "@/lib/companyWrite";
import { rebuildCorpus, sha256 } from "@/lib/corpus";

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
  if (!hasCompanySubstance(parsed.data)) return NextResponse.json({ error: "Add a business plan or a one-liner first." }, { status: 400 });

  const data = await buildCompanyData(parsed.data);
  // bp is set by rebuildCorpus() right after; create with a placeholder.
  const c = await prisma.company.create({
    data: { ...data, name: String(data.name), bp: "", ownerId: s.userId },
  });

  // Turn the pre-extracted onboarding files into the company's document library.
  for (const d of parsed.data.documents ?? []) {
    const hash = sha256(d.text);
    await prisma.document.upsert({
      where: { companyId_hash: { companyId: c.id, hash } },
      create: { ownerId: s.userId, companyId: c.id, fileName: d.fileName, ext: extOf(d.fileName), text: d.text, sizeBytes: Buffer.byteLength(d.text), hash },
      update: {},
    });
  }
  const company = (await rebuildCorpus(c.id)) ?? c;

  // Finishing onboarding (even if optional questions were skipped) marks the
  // user onboarded so they aren't bounced back to the guided flow.
  if (parsed.data.fromOnboarding) {
    await prisma.user.update({ where: { id: s.userId }, data: { onboardedAt: new Date() } });
  }
  return NextResponse.json({ company });
}
