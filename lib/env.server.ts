import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  ORG_SUPABASE_URL: z
    .string({ error: "ORG_SUPABASE_URL is required" })
    .url("ORG_SUPABASE_URL must be a valid URL"),
  ORG_SUPABASE_SERVICE_ROLE_KEY: z
    .string({ error: "ORG_SUPABASE_SERVICE_ROLE_KEY is required" })
    .min(1, "ORG_SUPABASE_SERVICE_ROLE_KEY must not be empty"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function parseServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse({
    ORG_SUPABASE_URL: process.env.ORG_SUPABASE_URL,
    ORG_SUPABASE_SERVICE_ROLE_KEY: process.env.ORG_SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid or missing org Supabase environment variables:\n${issues}\n\n` +
        `Add ORG_SUPABASE_URL and ORG_SUPABASE_SERVICE_ROLE_KEY to .env.local.`,
    );
  }

  return parsed.data;
}

export const serverEnv: ServerEnv = parseServerEnv();
