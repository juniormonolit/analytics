// @vitest-environment jsdom
/**
 * Browser-side tests for `lib/supabase/client.ts`.
 *
 * Forces the jsdom environment via the per-file magic comment so
 * `typeof window !== "undefined"` regardless of the global default. The
 * "throws on the server" branch is exercised separately in
 * `client.node.test.ts` under `// @vitest-environment node`.
 *
 * `@supabase/supabase-js`'s `createClient` is mocked so:
 *   - tests are fast and deterministic (no realtime websockets, no fetch),
 *   - we can verify the singleton contract by counting how often the
 *     factory is invoked.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Inject deterministic env BEFORE the env validator at the top of `client.ts`
// is evaluated. `??=` keeps any pre-existing values (e.g. from `.env.local`).
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.NEXT_PUBLIC_SUPABASE_SCHEMA ??= "sa";
});

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(() => ({
    from: vi.fn((_table: string) => ({
      select: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

beforeEach(() => {
  // Reset both the createClient mock and the module cache so the singleton
  // inside `client.ts` starts fresh on every test.
  createClientMock.mockClear();
  vi.resetModules();
});

describe("getBrowserClient() in jsdom", () => {
  it("returns an object with a callable `.from('teams')` builder", async () => {
    const { getBrowserClient } = await import("../client");
    const client = getBrowserClient();

    expect(typeof client.from).toBe("function");
    expect(typeof client.from("teams").select).toBe("function");
  });

  it("returns the same instance on repeated calls (module-level singleton)", async () => {
    const { getBrowserClient } = await import("../client");
    const a = getBrowserClient();
    const b = getBrowserClient();
    const c = getBrowserClient();

    expect(a).toBe(b);
    expect(b).toBe(c);
    // The underlying createClient factory should have been called exactly once.
    expect(createClientMock).toHaveBeenCalledTimes(1);
  });

  it("createBrowserClient is the same function reference as getBrowserClient", async () => {
    const { getBrowserClient, createBrowserClient } = await import(
      "../client"
    );
    expect(createBrowserClient).toBe(getBrowserClient);
  });
});
