import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@quorum/db";
import { getSession } from "@/lib/auth";
import { summarize } from "@/lib/runSummary";
import Landing from "@/components/landing/Landing";
import HomeHero from "@/components/home/HomeHero";

export const dynamic = "force-dynamic";

const ACTIVE_COOKIE = "quorum_active_company";

export default async function HomePage() {
  const session = await getSession();
  // Logged-out visitors see the public marketing landing page.
  if (!session) return <Landing />;

  const companies = await prisma.company.findMany({
    where: { ownerId: session.userId },
    orderBy: { updatedAt: "desc" },
  });
  // No startup yet → run the guided setup first.
  if (companies.length === 0) redirect("/onboarding");

  // The "current" startup: the one in the cookie, else the most recent.
  const cookieId = cookies().get(ACTIVE_COOKIE)?.value;
  const active = companies.find((c) => c.id === cookieId) ?? companies[0];

  const runs = await prisma.modeRun.findMany({
    where: { companyId: active.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const meetings = runs.map((r) => ({
    id: r.id,
    mode: r.mode,
    createdAt: r.createdAt.toISOString(),
    preview: summarize(r.mode, r.result, r.status),
  }));

  return (
    <HomeHero
      companies={companies.map((c) => ({ id: c.id, name: c.name, stage: c.stage }))}
      active={{ id: active.id, name: active.name, stage: active.stage, topic: active.topic }}
      meetings={meetings}
    />
  );
}
