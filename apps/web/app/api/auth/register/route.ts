import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@quorum/db";
import { hashPassword, signToken, setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid email or password (min 6 chars)." }, { status: 400 });
  const { email, password, name } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: "Email already registered." }, { status: 409 });

  const user = await prisma.user.create({ data: { email, password: await hashPassword(password), name } });
  setSessionCookie(await signToken({ userId: user.id, email: user.email }));
  return NextResponse.json({ ok: true });
}
