/**
 * Browser-side Supabase client.
 *
 * - Uses the public anon key — safe to ship to the browser.
 * - Caches a single instance per page lifetime to avoid re-creating the
 *   client on every render (which would also leak `realtime` connections).
 * - Bound to schema `sa` (via `db.schema`) so all `.from(...)` calls are
 *   typed against `Database["sa"]["Tables"]`.
 * - Disables session persistence: this app does not currently use Supabase
 *   Auth in the browser; future tasks may revisit.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types.generated";
import { clientEnv } from "@/lib/env";

/**
 * The schema name from env is just `string` at the type level, but the
 * generated `Database` type only knows the literal schema `"sa"`. This
 * helper performs a one-time, narrowed cast so the rest of the module
 * (and any consumer) gets full table-level type safety. At runtime the
 * value comes verbatim from `clientEnv.NEXT_PUBLIC_SUPABASE_SCHEMA`.
 */
type DbSchema = "sa";
const SCHEMA_NAME = clientEnv.NEXT_PUBLIC_SUPABASE_SCHEMA as DbSchema;

export type AppSupabaseClient = SupabaseClient<Database, DbSchema, DbSchema>;

let _browserClient: AppSupabaseClient | null = null;

/**
 * Returns the singleton browser-side Supabase client.
 *
 * @throws Error if called from a non-browser environment (server/edge).
 */
export function getBrowserClient(): AppSupabaseClient {
  if (typeof window === "undefined") {
    throw new Error(
      "getBrowserClient() must only be called in the browser. " +
        "Use createServerClient() from lib/supabase/server.ts on the server.",
    );
  }

  if (_browserClient) {
    return _browserClient;
  }

  const client = createClient<Database, DbSchema, DbSchema>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      db: { schema: SCHEMA_NAME },
      auth: { persistSession: false },
    },
  );

  _browserClient = client;
  return client;
}

/**
 * Back-compat alias kept in step with the planning doc's naming.
 *
 * Equivalent to `getBrowserClient()`.
 */
export const createBrowserClient = getBrowserClient;
