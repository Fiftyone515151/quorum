import { redirect } from "next/navigation";
import { prisma } from "@quorum/db";
import { getSession } from "@/lib/auth";
import SettingsClient from "@/components/settings/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true, email: true },
  });
  if (!user) redirect("/login");
  return <SettingsClient name={user.name ?? ""} email={user.email} />;
}
