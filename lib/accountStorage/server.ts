import "server-only";

import { createOrgServerClient } from "@/lib/org/client";
import type { OrgJson } from "@/lib/org/database.types";

type JsonPayload = OrgJson;

export async function readAccountPayload<T>(
  userKey: string,
  storageKey: string,
): Promise<T | null> {
  const supabase = createOrgServerClient();
  const { data, error } = await supabase
    .from("user_account_storage")
    .select("payload")
    .eq("user_key", userKey)
    .eq("storage_key", storageKey)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data?.payload) return null;
  return data.payload as T;
}

export async function writeAccountPayload(
  userKey: string,
  storageKey: string,
  payload: JsonPayload,
): Promise<void> {
  const supabase = createOrgServerClient();
  const { error } = await supabase.from("user_account_storage").upsert(
    {
      user_key: userKey,
      storage_key: storageKey,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_key,storage_key" },
  );

  if (error) {
    throw new Error(error.message);
  }
}
