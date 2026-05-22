/**
 * Server-side Supabase client for App Router route handlers, server
 * components, and server actions.
 *
 * Known limitation (v1):
 *   We currently use the public anon key here as well — there is no
 *   service-role key configured. That is fine for catalog reads of
 *   non-RLS-protected tables, but a future task should introduce a
 *   dedicated service-role client (e.g. `createServiceClient`) for
 *   queries that need to bypass RLS.
 *
 * The `import "server-only"` line at the top makes Next.js fail the build
 * if this module is ever pulled into a client bundle. We additionally add
 * a runtime guard for environments (e.g. unit tests) where the
 * `server-only` ESM marker isn't enforced.
 */
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types.generated";
import { clientEnv } from "@/lib/env";

/**
 * The schema name from env is just `string` at the type level, but the
 * generated `Database` type only knows the literal schema `"sa"`. This
 * helper performs a one-time, narrowed cast so consumers get full
 * table-level type safety. At runtime the value still comes from
 * `clientEnv.NEXT_PUBLIC_SUPABASE_SCHEMA`.
 */
type DbSchema = "sa";
const SCHEMA_NAME = clientEnv.NEXT_PUBLIC_SUPABASE_SCHEMA as DbSchema;

export type ServerSupabaseClient = SupabaseClient<Database, DbSchema, DbSchema>;

/**
 * Creates a fresh server-side Supabase client.
 *
 * We do NOT cache a singleton here: route handlers can be invoked
 * concurrently with different request contexts, and a future migration to
 * cookie-based auth will need a per-request client anyway.
 */
export function createServerClient(): ServerSupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error(
      "createServerClient() must not be called from the browser. " +
        "Use getBrowserClient() from lib/supabase/client.ts instead.",
    );
  }

  return createClient<Database, DbSchema, DbSchema>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      db: { schema: SCHEMA_NAME },
      auth: { persistSession: false },
    },
  );
}
