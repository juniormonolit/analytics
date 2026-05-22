// @vitest-environment node
/**
 * Tests for `features/reports/engine/metricsCatalog.ts`.
 *
 * Two surfaces under test:
 *   1. `loadActiveMetrics` — Supabase select against `sa.metrics`,
 *      with a 5-minute in-process cache. We assert on the number of
 *      `.from('metrics')` invocations to verify the cache hits and
 *      that `clearMetricsCache()` forces a re-fetch.
 *   2. `resolveMetricIds` — pure resolver against the catalog rows,
 *      with the special `"all_core"` token plus order-preserving id
 *      lookup.
 *
 * The cache lives at module scope, so `clearMetricsCache()` runs
 * before every test to keep the suite hermetic.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearMetricsCache,
  loadActiveMetrics,
  resolveCoreVisibleMetrics,
  resolveMetricIds,
  type MetricRow,
} from "../metricsCatalog";
import { CALLED_DEALS_METRIC_ID } from "../dimensions/calledDeals";

vi.mock("server-only", () => ({}));

type ServerSupabaseClient = Parameters<typeof loadActiveMetrics>[0];

function makeMetric(overrides: Partial<MetricRow> = {}): MetricRow {
  return {
    id: "x",
    name_ru: "X",
    name_short_ru: null,
    metric_type: "collected",
    data_type: "decimal",
    aggregation: null,
    source: null,
    source_column: null,
    formula: null,
    dependencies: null,
    decimal_places: 0,
    color_rules: null,
    aggregation_fn: "sum",
    category: null,
    sort_order: 0,
    is_core: false,
    is_active: true,
    created_at: null,
    ...overrides,
  };
}

/**
 * Build a fake Supabase client wired for the
 * `.from('metrics').select('*').eq('is_active', true).order('sort_order', ...)`
 * chain used inside `loadActiveMetrics`.
 */
function makeSupabaseStub(rows: MetricRow[]) {
  const orderMock = vi.fn().mockResolvedValue({ data: rows, error: null });
  const eqMock = vi.fn(() => ({ order: orderMock }));
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));

  const supabase = { from: fromMock } as unknown as ServerSupabaseClient;
  return { supabase, fromMock, selectMock, eqMock, orderMock };
}

beforeEach(() => {
  clearMetricsCache();
});

describe("loadActiveMetrics()", () => {
  it("queries sa.metrics filtering is_active=true ordered by sort_order asc", async () => {
    const rows: MetricRow[] = [
      makeMetric({ id: "a", sort_order: 0 }),
      makeMetric({ id: "b", sort_order: 1 }),
    ];
    const { supabase, fromMock, selectMock, eqMock, orderMock } =
      makeSupabaseStub(rows);

    const result = await loadActiveMetrics(supabase);

    expect(result).toEqual(rows);
    expect(fromMock).toHaveBeenCalledWith("metrics");
    expect(selectMock).toHaveBeenCalledWith("*");
    expect(eqMock).toHaveBeenCalledWith("is_active", true);
    expect(orderMock).toHaveBeenCalledWith("sort_order", { ascending: true });
  });

  it("caches the result across calls within the TTL — second call does not re-query", async () => {
    const rows: MetricRow[] = [makeMetric({ id: "a" })];
    const { supabase, fromMock } = makeSupabaseStub(rows);

    await loadActiveMetrics(supabase);
    await loadActiveMetrics(supabase);
    await loadActiveMetrics(supabase);

    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it("clearMetricsCache() forces a re-fetch on the next call", async () => {
    const rows: MetricRow[] = [makeMetric({ id: "a" })];
    const { supabase, fromMock } = makeSupabaseStub(rows);

    await loadActiveMetrics(supabase);
    expect(fromMock).toHaveBeenCalledTimes(1);

    clearMetricsCache();

    await loadActiveMetrics(supabase);
    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it("treats null data as an empty array", async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqMock = vi.fn(() => ({ order: orderMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));
    const fromMock = vi.fn(() => ({ select: selectMock }));
    const supabase = { from: fromMock } as unknown as ServerSupabaseClient;

    const result = await loadActiveMetrics(supabase);
    expect(result).toEqual([]);
  });

  it("throws with a clear message when supabase reports an error", async () => {
    const orderMock = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "db down" } });
    const eqMock = vi.fn(() => ({ order: orderMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));
    const fromMock = vi.fn(() => ({ select: selectMock }));
    const supabase = { from: fromMock } as unknown as ServerSupabaseClient;

    await expect(loadActiveMetrics(supabase)).rejects.toThrow(
      /Failed to load metrics catalog: db down/,
    );
  });

  it("keeps hidden technical metrics in the engine catalog for dependency resolution", async () => {
    const rows: MetricRow[] = [
      makeMetric({ id: "incoming_deals_count", is_core: true }),
      makeMetric({ id: CALLED_DEALS_METRIC_ID, is_core: true }),
    ];
    const { supabase } = makeSupabaseStub(rows);

    const result = await loadActiveMetrics(supabase);
    expect(result.map((row) => row.id)).toEqual([
      "incoming_deals_count",
      CALLED_DEALS_METRIC_ID,
    ]);
  });
});

describe("resolveMetricIds()", () => {
  const catalog: MetricRow[] = [
    makeMetric({ id: "deals_count", is_core: true, sort_order: 0 }),
    makeMetric({ id: "deals_amount", is_core: true, sort_order: 1 }),
    makeMetric({ id: "extra_metric", is_core: false, sort_order: 2 }),
    makeMetric({ id: "another_core", is_core: true, sort_order: 3 }),
  ];

  it('returns every visible is_core=true metric when input contains "all_core"', () => {
    const catalogWithHidden: MetricRow[] = [
      ...catalog,
      makeMetric({ id: CALLED_DEALS_METRIC_ID, is_core: true, sort_order: 99 }),
    ];
    const out = resolveMetricIds(["all_core"], catalogWithHidden);
    expect(out.map((m) => m.id)).toEqual([
      "deals_count",
      "deals_amount",
      "another_core",
      CALLED_DEALS_METRIC_ID,
    ]);
  });

  it("resolveCoreVisibleMetrics respects uiHiddenMetricIds from Settings", () => {
    const catalogWithHidden: MetricRow[] = [
      makeMetric({ id: "incoming_deals_count", is_core: true }),
      makeMetric({ id: CALLED_DEALS_METRIC_ID, is_core: true }),
    ];
    expect(
      resolveCoreVisibleMetrics(catalogWithHidden, [CALLED_DEALS_METRIC_ID]).map(
        (m) => m.id,
      ),
    ).toEqual(["incoming_deals_count"]);
  });

  it('returns every is_core=true metric (catalog order) when input contains "all_core"', () => {
    const out = resolveMetricIds(["all_core"], catalog);
    expect(out.map((m) => m.id)).toEqual([
      "deals_count",
      "deals_amount",
      "another_core",
    ]);
  });

  it('expands "all_core" even when other ids are present in the same input', () => {
    // The implementation short-circuits as soon as it sees the token —
    // it returns *only* the core metrics regardless of the other ids.
    const out = resolveMetricIds(["all_core", "extra_metric"], catalog);
    expect(out.map((m) => m.id)).toEqual([
      "deals_count",
      "deals_amount",
      "another_core",
    ]);
  });

  it("returns matching ids in input order, preserving caller intent", () => {
    const out = resolveMetricIds(
      ["another_core", "deals_count", "extra_metric"],
      catalog,
    );
    expect(out.map((m) => m.id)).toEqual([
      "another_core",
      "deals_count",
      "extra_metric",
    ]);
  });

  it("silently drops unknown ids", () => {
    const out = resolveMetricIds(["deals_count", "ghost"], catalog);
    expect(out.map((m) => m.id)).toEqual(["deals_count"]);
  });

  it("returns an empty array for an empty input", () => {
    const out = resolveMetricIds([], catalog);
    expect(out).toEqual([]);
  });

  it("returns an empty array for an entirely unknown input set", () => {
    const out = resolveMetricIds(["a", "b", "c"], catalog);
    expect(out).toEqual([]);
  });
});
