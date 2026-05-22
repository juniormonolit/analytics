// @vitest-environment node
/**
 * Tests for the GET /api/health/db route handler.
 *
 * The route's only collaborator is `createServerClient()` from
 * `lib/supabase/server.ts`. Mocking that here (rather than the underlying
 * supabase-js library) means we don't need a real env, don't pull in
 * `server-only`, and don't pull in any database code — we just verify the
 * route's response contract.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, loadAllDepartmentsMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  loadAllDepartmentsMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/org/repository", () => ({
  loadAllDepartments: loadAllDepartmentsMock,
}));

beforeEach(() => {
  fromMock.mockReset();
  loadAllDepartmentsMock.mockReset();
  loadAllDepartmentsMock.mockResolvedValue([]);
});

describe("GET /api/health/db", () => {
  it("returns 200 + { ok: true, schema: 'sa', teamsCount } on a successful count", async () => {
    fromMock.mockReturnValue({
      select: (
        _columns: string,
        _opts: { count: "exact"; head: true },
      ) => Promise.resolve({ count: 7, error: null }),
    });

    const { GET } = await import("../route");
    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);

    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      schema: "sa",
      teamsCount: 7,
      orgDepartmentsCount: 0,
    });
  });

  it("coerces a null count to 0 on success", async () => {
    fromMock.mockReturnValue({
      select: () => Promise.resolve({ count: null, error: null }),
    });

    const { GET } = await import("../route");
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      schema: "sa",
      teamsCount: 0,
      orgDepartmentsCount: 0,
    });
  });

  it("returns 200 + orgDepartmentsCount from org catalog", async () => {
    fromMock.mockReturnValue({
      select: () => Promise.resolve({ count: 3, error: null }),
    });
    loadAllDepartmentsMock.mockResolvedValue([
      { id: "d1", name: "Sales" },
      { id: "d2", name: "Support" },
    ]);

    const { GET } = await import("../route");
    const res = await GET();
    const body = await res.json();

    expect(body).toEqual({
      ok: true,
      schema: "sa",
      teamsCount: 3,
      orgDepartmentsCount: 2,
    });
  });

  it("returns 500 + { ok: false, error: <message> } when select rejects with an Error", async () => {
    fromMock.mockReturnValue({
      select: () => Promise.reject(new Error("boom")),
    });

    const { GET } = await import("../route");
    const res = await GET();

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: "boom" });
  });

  it("returns 500 with the rethrown Error.message when supabase reports an error result", async () => {
    // The route does `if (error) throw error;`. To exercise the *intended*
    // error-message-passthrough path we make `error` an actual Error.
    // (See "found issues" — when supabase yields a plain `{ message }` object,
    // the current `instanceof Error` check yields "unknown error" instead of
    // the real message.)
    fromMock.mockReturnValue({
      select: () =>
        Promise.resolve({ count: null, error: new Error("relation missing") }),
    });

    const { GET } = await import("../route");
    const res = await GET();

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: "relation missing" });
  });

  it("extracts `.message` when the failure is a plain object (supabase-js PostgrestError shape)", async () => {
    // supabase-js emits PostgrestError as a plain `{ message, code, details, hint }`
    // object, not an Error instance. The route's `extractErrorMessage` helper
    // must surface the real message instead of falling back to "unknown error".
    fromMock.mockReturnValue({
      select: () =>
        Promise.resolve({ count: null, error: { message: "plain object" } }),
    });

    const { GET } = await import("../route");
    const res = await GET();

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: "plain object" });
  });
});
