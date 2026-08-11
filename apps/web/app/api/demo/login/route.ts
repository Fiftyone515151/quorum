import { NextRequest, NextResponse } from "next/server";
import { getSession, signToken, setSessionCookie } from "@/lib/auth";
import { provisionDemoUser, DEMO_LOGINS_PER_IP_PER_DAY, DEMO_LIMITS_DISABLED } from "@/lib/demo";
import { isUnlimitedTester } from "@/lib/testAccounts";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

/** Mint a throwaway demo account (Relay pre-loaded) and sign the visitor in. */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.ip || "unknown";

  // Developers testing the demo: signed in as an unlimited tester → no IP cap.
  const current = await getSession();
  const bypass = isUnlimitedTester(current?.email);

  // Per-IP daily cap on demo accounts. Redis being down shouldn't take the
  // demo with it (runs are capped per account anyway), so fail open.
  if (!bypass && !DEMO_LIMITS_DISABLED) try {
    const key = `quorum:demo:logins:${ip}:${new Date().toISOString().slice(0, 10)}`;
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, 60 * 60 * 24);
    if (n > DEMO_LOGINS_PER_IP_PER_DAY) {
      return NextResponse.json(
        { error: "Demo limit reached for your network today — sign up (free) to keep exploring." },
        { status: 429 },
      );
    }
  } catch (e) {
    console.warn("[demo/login] rate-limit check skipped:", (e as Error).message);
  }

  try {
    const user = await provisionDemoUser();
    setSessionCookie(await signToken({ userId: user.id, email: user.email }));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[demo/login] provisioning failed:", e);
    return NextResponse.json({ error: "Could not start the demo — please try again." }, { status: 500 });
  }
}
