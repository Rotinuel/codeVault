import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./constants.js";
import { sessionMaxAgeSeconds, signSessionToken, verifySessionToken } from "./jwt.js";

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
    priority: "high",
  };
}

export async function createSession(user) {
  const token = await signSessionToken({
    userId: user._id,
    role: user.role,
    tokenVersion: user.tokenVersion ?? 0,
  });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions(sessionMaxAgeSeconds()));
  return token;
}

export async function destroySession() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", cookieOptions(0));
}

export async function readSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}
