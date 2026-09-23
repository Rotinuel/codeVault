import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

// Clears an unusable session cookie (revoked token, suspended/banned account)
// and sends the visitor to the login page with an explanation.
export async function GET(request) {
  const url = new URL(request.url);
  const reason = ["invalid", "suspended", "banned"].includes(url.searchParams.get("reason"))
    ? url.searchParams.get("reason")
    : "invalid";
  const target = new URL("/login", request.url);
  target.searchParams.set(reason === "invalid" ? "expired" : "blocked", reason === "invalid" ? "1" : reason);
  const res = NextResponse.redirect(target);
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return res;
}
