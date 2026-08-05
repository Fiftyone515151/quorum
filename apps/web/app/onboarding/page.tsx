import { redirect } from "next/navigation";
import { prisma } from "@quorum/db";
import { getSession } from "@/lib/auth";
import { isUnlimitedTester } from "@/lib/testAccounts";
import OnboardingChat from "@/components/onboarding/OnboardingChat";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: { searchParams: { add?: string } }) {
  const session = await getSession();
  if (!session) redirect("/login");

  // `?add=1` lets an existing user run the guided flow again for another
  // startup. Test accounts bypass the guard entirely so they can re-run the
  // funnel repeatedly. Otherwise this is the first-run funnel: skip it for
  // anyone already onboarded or with a startup (backfill for pre-feature users).
  const adding = searchParams.add === "1" || isUnlimitedTester(session.email);
  if (!adding) {
    const [user, companyCount] = await Promise.all([
      prisma.user.findUnique({ where: { id: session.userId }, select: { onboardedAt: true } }),
      prisma.company.count({ where: { ownerId: session.userId } }),
    ]);
    if (user?.onboardedAt || companyCount > 0) redirect("/");
  }

  return <OnboardingChat adding={adding} />;
}
