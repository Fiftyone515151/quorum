import { NextResponse, type NextRequest } from "next/server";

/** Redirect unauthenticated users away from app pages to /login. */
export function middleware(req: NextRequest) {
  const authed = req.cookies.get("quorum_session")?.value;
  if (!authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/new", "/onboarding", "/history", "/session/:path*"],
};
