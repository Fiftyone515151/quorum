import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

const COOKIE = "quorum_session";

// Resolve the signing secret lazily (at request time, not module load) so a
// production build without AUTH_SECRET still builds, but the server refuses to
// sign/verify sessions with a public fallback. In prod the var is mandatory —
// otherwise anyone could forge a session cookie.
let cachedSecret: Uint8Array | undefined;
function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const raw = process.env.AUTH_SECRET;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET is required in production (refusing to use an insecure fallback).");
    }
    console.warn("[auth] AUTH_SECRET not set — using an insecure dev-only secret. Do NOT use in production.");
    return new TextEncoder().encode("dev-only-insecure-secret");
  }
  cachedSecret = new TextEncoder().encode(raw);
  return cachedSecret;
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export async function signToken(payload: { userId: string; email: string }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export function setSessionCookie(token: string): void {
  cookies().set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}
export function clearSessionCookie(): void {
  cookies().set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSession(): Promise<{ userId: string; email: string } | null> {
  const t = cookies().get(COOKIE)?.value;
  if (!t) return null;
  try {
    const { payload } = await jwtVerify(t, getSecret());
    return { userId: payload.userId as string, email: payload.email as string };
  } catch {
    return null;
  }
}

/** For API routes: throws-friendly getter. */
export async function requireUser(): Promise<{ userId: string; email: string } | null> {
  return getSession();
}
