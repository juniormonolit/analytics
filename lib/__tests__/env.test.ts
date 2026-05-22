/**
 * Tests for `lib/env.ts` — zod-validated `clientEnv`.
 *
 * `lib/env.ts` evaluates `process.env` at top-level on first import, so each
 * test must reset the module cache (`vi.resetModules`) and dynamically import
 * the module after stubbing the relevant env vars. `vi.unstubAllEnvs` in the
 * afterEach hook restores any pre-existing values that vitest/Vite may have
 * loaded from `.env.local`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PUBLIC_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_SCHEMA",
] as const;

beforeEach(() => {
  // Force a fresh evaluation of `lib/env.ts` for every test.
  vi.resetModules();
  // Start every test from a known-empty baseline, regardless of whether
  // vitest.setup or .env.local has populated `process.env`. Restored by
  // `vi.unstubAllEnvs()` in afterEach.
  for (const key of PUBLIC_KEYS) {
    vi.stubEnv(key, undefined);
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("clientEnv parsing — happy path", () => {
  it("returns the expected three NEXT_PUBLIC_SUPABASE_* fields when all vars are valid", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-abc");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_SCHEMA", "sa");

    const { clientEnv } = await import("../env");
    expect(clientEnv).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-abc",
      NEXT_PUBLIC_SUPABASE_SCHEMA: "sa",
    });
  });
});

describe("clientEnv parsing — error paths", () => {
  it("throws when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-abc");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_SCHEMA", "sa");

    await expect(import("../env")).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("throws when NEXT_PUBLIC_SUPABASE_URL is malformed", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not-a-url");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-abc");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_SCHEMA", "sa");

    await expect(import("../env")).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is an empty string", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_SCHEMA", "sa");

    await expect(import("../env")).rejects.toThrow(
      /NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });

  it("throws when NEXT_PUBLIC_SUPABASE_SCHEMA is an empty string", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-abc");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_SCHEMA", "");

    await expect(import("../env")).rejects.toThrow(
      /NEXT_PUBLIC_SUPABASE_SCHEMA/,
    );
  });

  it("error message names every failing variable", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_SCHEMA", undefined);

    let captured: unknown;
    try {
      await import("../env");
    } catch (err) {
      captured = err;
    }

    expect(captured).toBeInstanceOf(Error);
    const message = (captured as Error).message;
    expect(message).toMatch(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(message).toMatch(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    expect(message).toMatch(/NEXT_PUBLIC_SUPABASE_SCHEMA/);
  });
});
