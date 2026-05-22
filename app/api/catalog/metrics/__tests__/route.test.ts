// @vitest-environment node
/**
 * Tests for `GET /api/catalog/metrics`.
 *
 * Mocking strategy mirrors `app/api/catalog/teams/__tests__/route.test.ts`:
 *   - Replace `server-only` with an inert stub so the marker module
 *     doesn't blow up under Vitest's resolver.
 *   - Replace `@/lib/supabase/server`'s `createServerClient` with a
 *     fake that returns a builder we can wire per-test.
 *
 * The real route does:
 *   `.from("metrics").select("*").eq("is_active", true).order("sort_order", { ascending: true })`
 *
 * so the fake builder needs `.select`, `.eq`, and `.order` returning
 * a thenable that resolves to whatever the test wires up.
 */
import { CALLED_DEALS_METRIC_ID } from "@/features/reports/engine/dimensions/calledDeals";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: fromMock }),
}));

beforeEach(() => {
  fromMock.mockReset();
});

type Result = { data: unknown; error: unknown };

function wireSupabase(result: Result) {
  fromMock.mockImplementation(() => ({
    select: () => ({
      eq: () => ({
        order: () => Promise.resolve(result),
      }),
    }),
  }));
}

describe("GET /api/catalog/metrics — success path", () => {
  it("returns 200 with `{ ok: true, metrics: [...] }`", async () => {
    const sampleMetrics = [
      {
        id: "incoming_deals_count",
        name_ru: "Входящие сделки",
        name_short_ru: null,
        metric_type: "raw",
        data_type: "int",
        decimal_places: 0,
        is_active: true,
        is_core: true,
        sort_order: 1,
      },
      {
        id: CALLED_DEALS_METRIC_ID,
        name_ru: "Созвонился",
        name_short_ru: null,
        metric_type: "raw",
        data_type: "int",
        decimal_places: 0,
        is_active: true,
        is_core: true,
        sort_order: 0,
      },
      {
        id: "won_deals_amount",
        name_ru: "Выигранные сделки",
        name_short_ru: null,
        metric_type: "raw",
        data_type: "money",
        decimal_places: 0,
        is_active: true,
        is_core: true,
        sort_order: 2,
      },
    ];

    wireSupabase({ data: sampleMetrics, error: null });

    const { GET } = await import("../route");
    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);

    const body = await res.json();
    expect(body).toEqual({
      ok: true,
      metrics: sampleMetrics,
    });
  });

  it("returns an empty metrics array when the table is empty", async () => {
    wireSupabase({ data: [], error: null });

    const { GET } = await import("../route");
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, metrics: [] });
  });

  it("treats null `data` from supabase as an empty array", async () => {
    wireSupabase({ data: null, error: null });

    const { GET } = await import("../route");
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, metrics: [] });
  });
});

describe("GET /api/catalog/metrics — error path", () => {
  it("returns 500 with `{ ok: false, error }` when Supabase reports an error", async () => {
    wireSupabase({
      data: null,
      error: { message: "permission denied for table metrics", code: "42501" },
    });

    const { GET } = await import("../route");
    const res = await GET();

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({
      ok: false,
      error: "permission denied for table metrics",
    });
  });

  it("returns 500 with a generic message when the supabase call throws", async () => {
    fromMock.mockImplementation(() => {
      throw new Error("network down");
    });

    const { GET } = await import("../route");
    const res = await GET();

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ ok: false, error: "network down" });
  });
});
