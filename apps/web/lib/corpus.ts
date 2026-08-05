import { createHash } from "crypto";
import { prisma } from "@quorum/db";
import { assembleProfile } from "./profile";

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Recompute a company's derived panel corpus from its current documents +
 * topic + profile, and cache the concatenated text / filename list. Call after
 * any change to documents, topic, or profile. Returns the updated company.
 */
export async function rebuildCorpus(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { documents: { orderBy: { createdAt: "asc" } } },
  });
  if (!company) return null;
  const { topic, profile } = company;

  if (company.documents.length === 0) {
    // No document library. Protect legacy companies whose BP text lives only in
    // `bp` (pre-library, no docText) — don't blank it. Otherwise recompute from
    // topic/profile (+ any legacy docText), e.g. for a fresh topic-only company.
    const legacyRawBp = !company.docText?.trim() && company.bp.trim().length > 0;
    if (legacyRawBp) return company;
    const bp = assembleProfile({ topic, profile, fileText: company.docText ?? "" });
    return prisma.company.update({ where: { id: companyId }, data: { bp } });
  }

  const docText = company.documents.map((d) => `# ${d.fileName}\n${d.text}`).join("\n\n---\n\n");
  const bpFileName = company.documents.map((d) => d.fileName).join(", ") || null;
  const bp = assembleProfile({ topic, profile, fileText: docText });
  return prisma.company.update({ where: { id: companyId }, data: { docText, bpFileName, bp } });
}
