-- Org Supabase (ORG_SUPABASE_URL), schema public.
-- Run once in SQL Editor: https://vbixjecrphhzshxabrru.supabase.co
--
-- Stores per-user report sets, metric color settings, etc.

CREATE TABLE IF NOT EXISTS public.user_account_storage (
  user_key text NOT NULL,
  storage_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_key, storage_key)
);

CREATE INDEX IF NOT EXISTS user_account_storage_user_key_idx
  ON public.user_account_storage (user_key);

COMMENT ON TABLE public.user_account_storage IS
  'Per-user JSON blobs for BI: report sets, metric color settings, etc.';
