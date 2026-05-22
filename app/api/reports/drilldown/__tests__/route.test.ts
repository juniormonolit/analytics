// @vitest-environment node
/**
 * Tests for `POST /api/reports/drilldown` route handler.
 *
 * Mirrors the strategy used in `app/api/reports/run/__tests__/route.test.ts`:
 * we mock both collaborators (`createServerClient` and `runDrilldown`)
 * so this test exercises the handler's response contract only —
 * `runDrilldown`'s own logic is covered in
 * `features/reports/drilldown/__tests__/runDrilldown.test.ts`.
 *
 * The route handler is imported via `vi.resetModules() + dynamic import`
 * inside each test so the mocks below are guaranteed to be in place
 * before the route's imports resolve.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { runDrilldownMock, createServerClientMock } = vi.hoisted(() => ({
  runDrilldownMock: vi.fn(),
  createServerClientMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: createServerClientMock,
}));

vi.mock("@/features/reports/drilldown/runDrilldown", () => ({
  runDrilldown: runDrilldownMock,
}));

beforeEach(() => {
  vi.resetModules();
  runDrilldownMock.mockReset();
  createServerClientMock.mockReset();
  createServerClientMock.mockReturnValue({});
});

const validBody = {
  sectionSlug: "sales",
  reportSlug: "by-managers",
  rowKey: { managerId: 123 },
  period: { from: "2026-04-01", to: "2026-04-28" },
  comparisonPeriod: { from: "2026-03-04", to: "2026-03-31" },
  filters: {
    teamIds: [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
    ],
  },
  level: "product-groups",
};

const cannedResponse = {
  ok: true as const,
  level: "product-groups" as const,
  columns: { dimension: [], metrics: [] },
  rows: [],
  meta: {
    period: validBody.period,
    comparisonPeriod: validBody.comparisonPeriod,
    rowKey: validBody.rowKey,
    reportSlug: validBody.reportSlug,
  },
};

function buildRequest(body: unknown, opts: { invalidJson?: boolean } = {}) {
  const init: RequestInit = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: opts.invalidJson ? "not json" : JSON.stringify(body),
  };
  return new Request("http://localhost/api/reports/drilldown", init);
}

describe("POST /api/reports/drilldown — happy path", () => {
  it("returns 200 with the canned runDrilldown response on a valid body", async () => {
    runDrilldownMock.mockResolvedValue(cannedResponse);

    const { POST } = await import("../route");
    const res = await POST(buildRequest(validBody));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const body = await res.json();
    expect(body).toEqual(cannedResponse);

    expect(createServerClientMock).toHaveBeenCalledTimes(1);
    expect(runDrilldownMock).toHaveBeenCalledTimes(1);
    expect(runDrilldownMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reportSlug: "by-managers",
        level: "product-groups",
        rowKey: { managerId: 123 },
      }),
      expect.any(Object),
    );
  });
});

describe("POST /api/reports/drilldown — validation errors", () => {
  it("returns 400 with `issues` when rowKey carries neither managerId nor productGroupId", async () => {
    const { POST } = await import("../route");
    const bad = { ...validBody, rowKey: {} };
    const res = await POST(buildRequest(bad));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, error: "Invalid request" });
    expect(Array.isArray(body.issues)).toBe(true);
    expect(body.issues.length).toBeGreaterThan(0);
    expect(runDrilldownMock).not.toHaveBeenCalled();
  });

  it("returns 400 when level is not one of the allowed values", async () => {
    const { POST } = await import("../route");
    const bad = { ...validBody, level: "invalid" };
    const res = await POST(buildRequest(bad));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request");
    expect(runDrilldownMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the body is not valid JSON", async () => {
    const { POST } = await import("../route");
    const res = await POST(buildRequest(null, { invalidJson: true }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: "Invalid JSON body" });
    expect(runDrilldownMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/reports/drilldown — runtime errors", () => {
  it("returns 500 with the thrown Error.message when runDrilldown rejects", async () => {
    runDrilldownMock.mockRejectedValue(new Error("boom"));

    const { POST } = await import("../route");
    const res = await POST(buildRequest(validBody));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: "boom" });
  });

  it("falls back to 'Unknown error' for non-Error rejections", async () => {
    runDrilldownMock.mockRejectedValue({ weird: true });

    const { POST } = await import("../route");
    const res = await POST(buildRequest(validBody));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: "Unknown error" });
  });

  it("passes through string rejections", async () => {
    runDrilldownMock.mockRejectedValue("plain string");

    const { POST } = await import("../route");
    const res = await POST(buildRequest(validBody));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: "plain string" });
  });
});
