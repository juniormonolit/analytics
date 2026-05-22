// @vitest-environment node
/**
 * Tests for `lib/supabase/server.ts`.
 *
 * Notes:
 * - `server-only` throws unconditionally when imported outside of Next.js's
 *   `react-server` resolution condition. Vitest doesn't apply that
 *   condition, so we replace the package with an empty stub via `vi.mock`.
 *   The `server-only` guard itself is enforced at build time by Next.js;
 *   re-asserting it here would be testing the bundler, not our code.
 * - `@supabase/supabase-js`'s `createClient` is also mocked to keep the
 *   tests deterministic (no fetch, no realtime).
 */
import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.NEXT_PUBLIC_SUPABASE_SCHEMA ??= "sa";
});

// Replace the build-time-only marker module with an inert stub.
vi.mock("server-only", () => ({}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn((_table: string) => ({
      select: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  })),
}));

describe("createServerClient() (lib/supabase/server.ts)", () => {
  it("module loads cleanly in a node environment", async () => {
    const mod = await import("../server");
    expect(typeof mod.createServerClient).toBe("function");
  });

  it("returns a client with a callable `.from('teams').select` chain", async () => {
    const { createServerClient } = await import("../server");
    const client = createServerClient();
    expect(typeof client.from).toBe("function");
    expect(typeof client.from("teams").select).toBe("function");
  });
});
