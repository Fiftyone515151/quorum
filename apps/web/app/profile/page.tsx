import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@quorum/db";
import { getSession } from "@/lib/auth";
import ProfileClient, { type CompanyLite } from "@/components/profile/ProfileClient";

export const dynamic = "force-dynamic";

export default async function StartupProfilePage({ searchParams }: { searchParams: { return?: string; mode?: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const rows = await prisma.company.findMany({
    where: { ownerId: session.userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, topic: true, stage: true, profile: true },
  });
  const companies: CompanyLite[] = rows.map((c) => ({
    id: c.id, name: c.name, topic: c.topic, stage: c.stage,
    profile: (c.profile as Record<string, string> | null) ?? {},
  }));

  const activeId = cookies().get("quorum_active_company")?.value;
  const initialSelectedId = companies.find((c) => c.id === activeId)?.id ?? companies[0]?.id ?? null;

  const fromNew = searchParams.return === "new";
  const backHref = fromNew ? `/new?mode=${searchParams.mode ?? "screening"}` : "/";
  const backLabel = fromNew ? "← Back to new session" : "← Home";

  return <ProfileClient initialCompanies={companies} initialSelectedId={initialSelectedId} backHref={backHref} backLabel={backLabel} />;
}
