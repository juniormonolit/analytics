import type { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME, getStubAuthUserKey } from "./stubAuth";

export function sessionCookieOptions() {
  const secureFromEnv = process.env.STUB_AUTH_SECURE_COOKIE;
  const secure =
    secureFromEnv === "true"
      ? true
      : secureFromEnv === "false"
        ? false
        : process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure,
  };
}

export function applySessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(
    SESSION_COOKIE_NAME,
    getStubAuthUserKey(),
    sessionCookieOptions(),
  );
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
