import { redirect } from "next/navigation";
import { prisma } from "@quorum/db";
import { getSession } from "@/lib/auth";
import ProfileClient, { type CompanyLite } from "@/components/profile/ProfileClient";

export const dynamic = "force-dynamic";

export default async function StartupProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const rows = await prisma.company.findMany({
    where: { ownerId: session.userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, topic: true, stage: true, profile: true },
  });
  // Keep the payload small (no bp/docText) and JSON-safe.
  const companies: CompanyLite[] = rows.map((c) => ({
    id: c.id,
    name: c.name,
    topic: c.topic,
    stage: c.stage,
    profile: (c.profile as Record<string, string> | null) ?? {},
  }));

  return <ProfileClient initialCompanies={companies} />;
}
