import { cookies } from "next/headers";

import {
  SESSION_COOKIE_NAME,
  getStubAuthUserKey,
  getStubAuthUsername,
} from "./stubAuth";

export type SessionUser = {
  userKey: string;
  username: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (value !== getStubAuthUserKey()) return null;
  return {
    userKey: getStubAuthUserKey(),
    username: getStubAuthUsername(),
  };
}
