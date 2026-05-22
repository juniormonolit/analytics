// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: fromMock }),
}));

vi.mock("@/lib/env", () => ({
  clientEnv: { NEXT_PUBLIC_SUPABASE_SCHEMA: "sa" },
}));

function makeCountBuilder(count: number | null, error: unknown = null) {
  return {
    select: () => Promise.resolve({ count, error }),
  };
}

function makePreviewBuilder(data: unknown[], error: unknown = null) {
  const builder = {
    select: () => builder,
    or: () => builder,
    order: () => builder,
    range: () => Promise.resolve({ data, error }),
  };
  return builder;
}

beforeEach(() => {
  fromMock.mockReset();
});

describe("GET /api/debug/db/tables", () => {
  it("returns whitelisted tables with row estimates", async () => {
    fromMock.mockImplementation(() => makeCountBuilder(42));

    const { GET } = await import("../tables/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.schema).toBe("sa");
    expect(
      body.tables.some((t: { tableName: string }) => t.tableName === "deals"),
    ).toBe(true);
    expect(
      body.tables.find((t: { tableName: string }) => t.tableName === "deals")
        .rowEstimate,
    ).toBe(42);
  });
});

describe("GET /api/debug/db/table-preview", () => {
  it("rejects unknown tables", async () => {
    const { GET } = await import("../table-preview/route");
    const res = await GET(
      new Request("http://localhost/api/debug/db/table-preview?table=secret"),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("returns preview rows for whitelisted table", async () => {
    fromMock.mockImplementation(() =>
      makePreviewBuilder([{ deal_id: 1, deal_name: "Test" }]),
    );

    const { GET } = await import("../table-preview/route");
    const res = await GET(
      new Request(
        "http://localhost/api/debug/db/table-preview?table=deals&limit=50&offset=0&sort=created_at.desc",
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.table).toBe("deals");
    expect(body.rows).toHaveLength(1);
  });

  it("applies server-side search filter across table columns", async () => {
    const orMock = vi.fn().mockReturnValue({
      order: () => ({
        range: () =>
          Promise.resolve({
            data: [{ id: 1, deal_id: 181875 }],
            error: null,
          }),
      }),
    });
    fromMock.mockImplementation(() => ({
      select: () => ({ or: orMock }),
    }));

    const { GET } = await import("../table-preview/route");
    const res = await GET(
      new Request(
        "http://localhost/api/debug/db/table-preview?table=deal_events&limit=50&offset=0&sort=event_at.desc&search=181875",
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.search).toBe("181875");
    expect(orMock).toHaveBeenCalledOnce();
    expect(orMock.mock.calls[0][0]).toContain("deal_id.eq.181875");
  });
});

describe("GET /api/debug/metrics", () => {
  it("returns all metrics", async () => {
    fromMock.mockReturnValue({
      select: () => ({
        order: () =>
          Promise.resolve({
            data: [
              {
                id: "incoming_deals_count",
                name_ru: "Входящие",
                name_short_ru: null,
                metric_type: "collected",
                data_type: "int",
                aggregation_fn: "sum",
                source: "daily_sales",
                source_column: "incoming_deals_count",
                formula: null,
                dependencies: null,
                category: null,
                is_core: true,
                is_active: true,
                sort_order: 1,
              },
            ],
            error: null,
          }),
      }),
    });

    const { GET } = await import("../../metrics/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.metrics).toHaveLength(1);
  });
});
