import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  const sessionCookie =
    request.cookies.get("better-auth.session_token") ||
    request.cookies.get("__Secure-better-auth.session_token");

  const isAuthenticated = Boolean(sessionCookie?.value);

  // Protected routes: the creator dashboard and the buyer library.
  const isDashboardRoute = pathname.startsWith("/dashboard") || pathname.startsWith("/library");

  // Auth routes: /login and /register
  const isAuthRoute = pathname === "/login" || pathname === "/register";

  if (isDashboardRoute && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Only redirect away from /login or /register if there is NO explicit redirect parameter.
  // If redirect parameter exists (e.g. ?redirect=/dashboard), user was specifically sent to login
  // (e.g. from an expired/invalid session in dashboard), so never loop back to dashboard.
  if (isAuthRoute && isAuthenticated && !searchParams.has("redirect")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/library/:path*", "/login", "/register"],
};
