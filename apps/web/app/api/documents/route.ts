import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@quorum/db";
import { getSession } from "@/lib/auth";
import { extractFileText } from "@/lib/extractText";
import { rebuildCorpus, sha256 } from "@/lib/corpus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ownedCompany(companyId: string, userId: string) {
  const c = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true, ownerId: true } });
  return c && c.ownerId === userId ? c : null;
}

/** List a company's document library. */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = req.nextUrl.searchParams.get("companyId");
  if (!companyId || !(await ownedCompany(companyId, s.userId)))
    return NextResponse.json({ error: "company not found" }, { status: 404 });

  const documents = await prisma.document.findMany({
    where: { companyId },
    orderBy: { createdAt: "asc" },
    select: { id: true, fileName: true, ext: true, sizeBytes: true, createdAt: true },
  });
  return NextResponse.json({ documents });
}

/** Upload a file into a company's library (extract text, dedup, rebuild corpus). */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const companyId = form.get("companyId");
  if (typeof companyId !== "string" || !(await ownedCompany(companyId, s.userId)))
    return NextResponse.json({ error: "company not found" }, { status: 404 });
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });

  const res = await extractFileText(file);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });

  const hash = sha256(res.content);
  // Dedup within the company: re-uploading the same file returns the existing row.
  const existing = await prisma.document.findUnique({ where: { companyId_hash: { companyId, hash } } });
  if (existing) {
    return NextResponse.json({ document: { id: existing.id, fileName: existing.fileName, ext: existing.ext, sizeBytes: existing.sizeBytes } });
  }

  const doc = await prisma.document.create({
    data: { ownerId: s.userId, companyId, fileName: res.name, ext: res.ext, text: res.content, sizeBytes: file.size, hash },
    select: { id: true, fileName: true, ext: true, sizeBytes: true },
  });
  await rebuildCorpus(companyId);
  return NextResponse.json({ document: doc });
}
