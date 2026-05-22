import { NextResponse, type NextRequest } from "next/server";

import { applySessionCookie, isSessionCookieValue } from "@/lib/auth/sessionCookie";
import {
  isValidStubCredentials,
  parseBasicAuthHeader,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/stubAuth";

const PUBLIC_PATHS = new Set(["/login", "/api/auth/login"]);

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

function hasValidSession(request: NextRequest): boolean {
  return isSessionCookieValue(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );
}

function wantsJsonResponse(request: NextRequest): boolean {
  const accept = request.headers.get("accept") ?? "";
  return (
    request.nextUrl.pathname.startsWith("/api/") ||
    accept.includes("application/json")
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (hasValidSession(request)) {
    return NextResponse.next();
  }

  const credentials = parseBasicAuthHeader(
    request.headers.get("authorization"),
  );
  if (
    credentials &&
    isValidStubCredentials(credentials.username, credentials.password)
  ) {
    return applySessionCookie(NextResponse.next());
  }

  if (wantsJsonResponse(request)) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
