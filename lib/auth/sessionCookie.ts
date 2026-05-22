import type { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "./stubAuth";

/** Fixed marker — middleware must not depend on runtime env (Edge inlines env at build). */
export const SESSION_COOKIE_VALUE = "1";

export function sessionCookieOptions() {
  // Secure cookies are opt-in: many prod deployments run over plain HTTP behind VPN/IP.
  const secure = process.env.STUB_AUTH_SECURE_COOKIE === "true";

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
    SESSION_COOKIE_VALUE,
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

export function isSessionCookieValue(value: string | undefined): boolean {
  return value === SESSION_COOKIE_VALUE;
}
