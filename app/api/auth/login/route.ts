import { NextResponse } from "next/server";
import { z } from "zod";

import { applySessionCookie } from "@/lib/auth/sessionCookie";
import {
  getStubAuthUserKey,
  getStubAuthUsername,
  isValidStubCredentials,
} from "@/lib/auth/stubAuth";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Username and password are required" }, {
      status: 400,
    });
  }

  const { username, password } = parsed.data;
  if (!isValidStubCredentials(username.trim(), password)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const response = NextResponse.json({
    user: {
      userKey: getStubAuthUserKey(),
      username: getStubAuthUsername(),
    },
  });
  return applySessionCookie(response);
}
