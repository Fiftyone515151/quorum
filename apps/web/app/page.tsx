import Link from "next/link";
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
  // No startup yet: first-timers go through the guided setup; users who
  // explicitly skipped it (onboardedAt set) get an empty-state prompt instead.
  if (companies.length === 0) {
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { onboardedAt: true } });
    if (!user?.onboardedAt) redirect("/onboarding");
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-white px-6 text-center font-sans text-navy">
        <img src="/brand/lockup.png" alt="Quorum" className="h-10 w-auto" />
        <p className="font-pixel text-base leading-[1.7] text-brand">No startup yet</p>
        <p className="max-w-sm text-sm leading-relaxed text-navy/60">Add your startup to convene the panel.</p>
        <Link href="/onboarding?add=1" className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark">
          Add your startup
        </Link>
      </div>
    );
  }

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
