/** Stub auth credentials until real Supabase Auth is wired. */
export const STUB_AUTH_USERNAME = "admin";
export const STUB_AUTH_PASSWORD = "pizda1488";

/** Stable user key persisted in account storage rows. */
export const STUB_AUTH_USER_KEY = "admin";

export const SESSION_COOKIE_NAME = "bi_session";

export function parseBasicAuthHeader(
  header: string | null,
): { username: string; password: string } | null {
  if (!header || !header.startsWith("Basic ")) return null;
  try {
    const encoded = header.slice("Basic ".length);
    const decoded = atob(encoded);
    const separator = decoded.indexOf(":");
    if (separator === -1) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

export function isValidStubCredentials(
  username: string,
  password: string,
): boolean {
  return (
    username === STUB_AUTH_USERNAME && password === STUB_AUTH_PASSWORD
  );
}
