import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@quorum/db";
import { getSession, verifyPassword, hashPassword } from "@/lib/auth";
import { validatePassword } from "@/lib/password";

export const dynamic = "force-dynamic";

const schema = z.object({ currentPassword: z.string(), newPassword: z.string() });

/** Change the current user's password (verify current → validate new → hash). */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: s.userId } });
  if (!user || !(await verifyPassword(currentPassword, user.password))) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
  }
  const v = validatePassword(newPassword);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  await prisma.user.update({ where: { id: s.userId }, data: { password: await hashPassword(newPassword) } });
  // The session JWT carries only userId/email, so it stays valid after a
  // password change — no re-sign needed.
  return NextResponse.json({ ok: true });
}
