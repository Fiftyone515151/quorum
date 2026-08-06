import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@quorum/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({ name: z.string().max(80).optional() });

/** Update the current user's editable profile fields (name for now). */
export async function PATCH(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  const name = parsed.data.name?.trim() || null;
  const user = await prisma.user.update({ where: { id: s.userId }, data: { name }, select: { name: true, email: true } });
  return NextResponse.json({ user });
}
