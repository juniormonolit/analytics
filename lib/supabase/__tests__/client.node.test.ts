// @vitest-environment node
/**
 * Verifies that `getBrowserClient()` rejects the call when there is no
 * browser global (i.e. on the server / edge / during SSR).
 *
 * This file runs under the `node` vitest environment so `typeof window`
 * really is `"undefined"` — that's the precondition the runtime guard in
 * `client.ts` checks for.
 */
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.NEXT_PUBLIC_SUPABASE_SCHEMA ??= "sa";
});

// We never expect `createClient` to be reached, but mock it so a regression
// (e.g. removing the `typeof window` guard) doesn't accidentally hit the
// real Supabase constructor and slow the test down.
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

describe("getBrowserClient() in a node environment", () => {
  it("sanity: window is undefined in this worker", () => {
    expect(typeof window).toBe("undefined");
  });

  it("throws when called from the server", async () => {
    const { getBrowserClient } = await import("../client");
    expect(() => getBrowserClient()).toThrow(
      /must only be called in the browser/,
    );
  });
});
