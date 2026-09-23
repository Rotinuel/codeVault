// Next.js 16 Proxy (formerly middleware). Runs on the Node.js runtime.
//
// This is an optimistic, cookie-only gate for page navigation: it redirects
// visitors without a valid session away from /dashboard and /admin, and signed-in
// users away from /login and /register. It is NOT the security boundary — every
// page and API route re-validates the session, role, status and subscription
// against the database on the server.
import { NextResponse } from "next/server";
import { verifySessionToken } from "./lib/jwt.js";
import { SESSION_COOKIE, STAFF_ROLES } from "./lib/constants.js";

const AUTH_PAGES = ["/login", "/register", "/forgot-password", "/reset-password"];

export async function proxy(request) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isPayment = pathname.startsWith("/payments/");

  if ((isDashboard || isAdmin || isPayment) && !session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    const res = NextResponse.redirect(url);
    if (token) res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  if (isAdmin && session && !STAFF_ROLES.includes(session.role)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (session && AUTH_PAGES.includes(pathname) && !request.nextUrl.searchParams.has("blocked")) {
    return NextResponse.redirect(new URL(STAFF_ROLES.includes(session.role) ? "/admin" : "/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/payments/:path*", "/login", "/register", "/forgot-password", "/reset-password"],
};
