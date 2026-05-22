/**
 * Centralized environment variable validation for the BI app.
 *
 * - Uses zod to ensure required `NEXT_PUBLIC_SUPABASE_*` variables exist and
 *   are well-formed before the app boots.
 * - This file is safe to import from both the browser and the server: it only
 *   reads `NEXT_PUBLIC_*` variables, never private secrets.
 * - All `process.env.*` reads should go through this module so that we have a
 *   single source of truth for env shape and validation.
 *
 * If a required variable is missing or malformed, this module throws an
 * actionable error at first import (i.e. at server startup or page load),
 * rather than failing later with a cryptic runtime error.
 */
import { z } from "zod";

/**
 * Schema describing the public, client-safe Supabase configuration.
 *
 * All three variables are required — there are no sensible runtime defaults
 * for connecting to Supabase, and silently falling back would mask bugs.
 *
 * Note: zod v4 uses `error` (or a string positional arg) for messages;
 * the v3-era `required_error` option no longer exists.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string({ error: "NEXT_PUBLIC_SUPABASE_URL is required" })
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string({ error: "NEXT_PUBLIC_SUPABASE_ANON_KEY is required" })
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY must not be empty"),
  NEXT_PUBLIC_SUPABASE_SCHEMA: z
    .string({ error: "NEXT_PUBLIC_SUPABASE_SCHEMA is required" })
    .min(1, "NEXT_PUBLIC_SUPABASE_SCHEMA must not be empty"),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * Parse `process.env` once at module load.
 *
 * NB: We explicitly pick the keys we care about (instead of passing the entire
 * `process.env` object) so that Next.js's compile-time inlining of
 * `NEXT_PUBLIC_*` values can replace them in the client bundle.
 */
function parseClientEnv(): ClientEnv {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_SCHEMA: process.env.NEXT_PUBLIC_SUPABASE_SCHEMA,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid or missing environment variables for Supabase client:\n${issues}\n\n` +
        `Add them to .env.local (see .env.example for the expected shape).`,
    );
  }

  return parsed.data;
}

export const clientEnv: ClientEnv = parseClientEnv();
