import { NextResponse, type NextRequest } from "next/server";

import {
  isValidStubCredentials,
  parseBasicAuthHeader,
  SESSION_COOKIE_NAME,
  STUB_AUTH_USER_KEY,
} from "@/lib/auth/stubAuth";

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionCookie === STUB_AUTH_USER_KEY) {
    return NextResponse.next();
  }

  const credentials = parseBasicAuthHeader(
    request.headers.get("authorization"),
  );
  if (
    credentials &&
    isValidStubCredentials(credentials.username, credentials.password)
  ) {
    const response = NextResponse.next();
    response.cookies.set(SESSION_COOKIE_NAME, STUB_AUTH_USER_KEY, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Smekalochka"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
