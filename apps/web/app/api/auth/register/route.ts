import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@quorum/db";
import { hashPassword, signToken, setSessionCookie } from "@/lib/auth";
import { validatePassword } from "@/lib/password";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  password: z.string(),
  name: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
    const { email, password, name } = parsed.data;
    const pw = validatePassword(password);
    if (!pw.ok) return NextResponse.json({ error: pw.error }, { status: 400 });

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return NextResponse.json({ error: "Email already registered." }, { status: 409 });

    const user = await prisma.user.create({ data: { email, password: await hashPassword(password), name } });
    setSessionCookie(await signToken({ userId: user.id, email: user.email }));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[auth/register] failed:", e);
    return NextResponse.json({ error: `Registration failed: ${(e as Error).message}` }, { status: 500 });
  }
}
