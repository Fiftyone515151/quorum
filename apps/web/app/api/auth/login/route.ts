import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@quorum/db";
import { verifyPassword, signToken, setSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().email(), password: z.string() });

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.password))) {
      return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
    }
    setSessionCookie(await signToken({ userId: user.id, email: user.email }));
    return NextResponse.json({ ok: true });
  } catch (e) {
    // Never let an unhandled throw return an empty body (which surfaces to the
    // client as an opaque "Unexpected end of JSON input").
    console.error("[auth/login] failed:", e);
    return NextResponse.json({ error: `Sign-in failed: ${(e as Error).message}` }, { status: 500 });
  }
}
