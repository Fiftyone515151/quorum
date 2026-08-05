// One-time backfill: turn each company's legacy `docText` into Document rows,
// so the document library shows existing files and editing won't wipe the BP.
// Run once, after `prisma db push`:
//   DATABASE_URL=... corepack pnpm --filter @quorum/db exec tsx prisma/backfill-documents.ts
import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";

const prisma = new PrismaClient();
const sha256 = (t: string) => createHash("sha256").update(t).digest("hex");
const extOf = (f: string) => f.toLowerCase().split(".").pop() ?? "";

/** Split the concatenated docText back into { fileName, text } pieces. */
function splitDocText(docText: string): { fileName: string; text: string }[] {
  return docText
    .split("\n\n---\n\n")
    .map((chunk) => {
      const c = chunk.trim();
      if (c.startsWith("# ")) {
        const nl = c.indexOf("\n");
        if (nl > 0) return { fileName: c.slice(2, nl).trim() || "document", text: c.slice(nl + 1).trim() };
      }
      return { fileName: "document", text: c };
    })
    .filter((p) => p.text.length > 0);
}

async function main() {
  const companies = await prisma.company.findMany({ include: { _count: { select: { documents: true } } } });
  let created = 0;
  for (const c of companies) {
    if (c._count.documents > 0) continue; // already migrated
    if (!c.docText?.trim()) continue;
    for (const piece of splitDocText(c.docText)) {
      const hash = sha256(piece.text);
      await prisma.document.upsert({
        where: { companyId_hash: { companyId: c.id, hash } },
        create: {
          ownerId: c.ownerId, companyId: c.id, fileName: piece.fileName,
          ext: extOf(piece.fileName), text: piece.text, sizeBytes: Buffer.byteLength(piece.text), hash,
        },
        update: {},
      });
      created++;
    }
  }
  console.log(`Backfill done: created ${created} document(s) across ${companies.length} companies.`);
}

main().finally(() => prisma.$disconnect());
