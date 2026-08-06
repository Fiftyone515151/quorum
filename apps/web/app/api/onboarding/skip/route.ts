import { NextResponse } from "next/server";
import { prisma } from "@quorum/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Mark the user onboarded so skipping the guided setup doesn't bounce them
 *  straight back to /onboarding. They can add a startup later. */
export async function POST() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await prisma.user.update({ where: { id: s.userId }, data: { onboardedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
