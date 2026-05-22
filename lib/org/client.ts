import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/env.server";

import type { OrgDatabase } from "./database.types";

export type OrgSupabaseClient = SupabaseClient<OrgDatabase, "public", "public">;

export function createOrgServerClient(): OrgSupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error(
      "createOrgServerClient() must not be called from the browser.",
    );
  }

  return createClient<OrgDatabase, "public", "public">(
    serverEnv.ORG_SUPABASE_URL,
    serverEnv.ORG_SUPABASE_SERVICE_ROLE_KEY,
    {
      db: { schema: "public" },
      auth: { persistSession: false },
    },
  );
}
