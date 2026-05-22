// @vitest-environment node
/**
 * Tests for `POST /api/reports/run` route handler.
 *
 * The handler is intentionally thin: validate body → call `runReport` →
 * shape errors. We mock both collaborators (`createServerClient` and
 * `runReport`) so this test exercises the handler's response contract
 * only — `runReport`'s own logic is covered in
 * `features/reports/engine/__tests__/runReport.test.ts`.
 *
 * The route handler is imported via `vi.resetModules() + dynamic
 * import` inside each test, so the mocks below are guaranteed to be in
 * place before the route's imports resolve.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { runReportMock, createServerClientMock } = vi.hoisted(() => ({
  runReportMock: vi.fn(),
  createServerClientMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: createServerClientMock,
}));

vi.mock("@/features/reports/engine/runReport", () => ({
  runReport: runReportMock,
}));

beforeEach(() => {
  vi.resetModules();
  runReportMock.mockReset();
  createServerClientMock.mockReset();
  createServerClientMock.mockReturnValue({});
});

const validBody = {
  sectionSlug: "sales",
  reportSlug: "by-managers",
  period: { from: "2026-04-01", to: "2026-04-28" },
  comparisonPeriod: { from: "2026-03-04", to: "2026-03-31" },
  filters: {
    teamIds: [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
    ],
  },
  metricIds: ["all_core"],
  grouping: "none",
};

const cannedResponse = {
  columns: { dimension: [], metrics: [] },
  rows: [],
  totals: null,
  meta: {
    period: validBody.period,
    comparisonPeriod: validBody.comparisonPeriod,
  },
};

function buildRequest(body: unknown, opts: { invalidJson?: boolean } = {}) {
  const init: RequestInit = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: opts.invalidJson ? "not json" : JSON.stringify(body),
  };
  return new Request("http://localhost/api/reports/run", init);
}

describe("POST /api/reports/run — happy path", () => {
  it("returns 200 with the canned runReport response on a valid body", async () => {
    runReportMock.mockResolvedValue(cannedResponse);

    const { POST } = await import("../route");
    const res = await POST(buildRequest(validBody));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const body = await res.json();
    expect(body).toEqual(cannedResponse);

    expect(createServerClientMock).toHaveBeenCalledTimes(1);
    expect(runReportMock).toHaveBeenCalledTimes(1);
    expect(runReportMock).toHaveBeenCalledWith(
      expect.objectContaining({ reportSlug: "by-managers" }),
      expect.any(Object),
    );
  });
});

describe("POST /api/reports/run — validation errors", () => {
  it("returns 400 with `issues` when period.from is malformed", async () => {
    const { POST } = await import("../route");
    const bad = { ...validBody, period: { from: "April 1", to: "2026-04-28" } };
    const res = await POST(buildRequest(bad));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ ok: false, error: "Invalid request" });
    expect(Array.isArray(body.issues)).toBe(true);
    expect(body.issues.length).toBeGreaterThan(0);
    // Doesn't reach runReport.
    expect(runReportMock).not.toHaveBeenCalled();
  });

  it("returns 400 when comparisonPeriod is missing", async () => {
    const { POST } = await import("../route");
    const bad: Partial<typeof validBody> = { ...validBody };
    delete bad.comparisonPeriod;
    const res = await POST(buildRequest(bad));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request");
    expect(runReportMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the body is not valid JSON", async () => {
    const { POST } = await import("../route");
    const res = await POST(buildRequest(null, { invalidJson: true }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: "Invalid JSON body" });
    expect(runReportMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/reports/run — engine errors", () => {
  it("returns 500 with the thrown Error.message when runReport rejects", async () => {
    runReportMock.mockRejectedValue(new Error("boom"));

    const { POST } = await import("../route");
    const res = await POST(buildRequest(validBody));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: "boom" });
  });

  it('falls back to "Unknown error" for non-Error rejections', async () => {
    runReportMock.mockRejectedValue({ weird: true });

    const { POST } = await import("../route");
    const res = await POST(buildRequest(validBody));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: "Unknown error" });
  });

  it('passes through string rejections via extractErrorMessage', async () => {
    runReportMock.mockRejectedValue("plain string");

    const { POST } = await import("../route");
    const res = await POST(buildRequest(validBody));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: "plain string" });
  });
});
