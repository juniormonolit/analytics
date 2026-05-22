import { cookies } from "next/headers";

import {
  SESSION_COOKIE_NAME,
  STUB_AUTH_USER_KEY,
  STUB_AUTH_USERNAME,
} from "./stubAuth";

export type SessionUser = {
  userKey: string;
  username: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (value !== STUB_AUTH_USER_KEY) return null;
  return { userKey: STUB_AUTH_USER_KEY, username: STUB_AUTH_USERNAME };
}
