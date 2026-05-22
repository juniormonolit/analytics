// @vitest-environment node
/**
 * Tests for `features/reports/drilldown/runDrilldown.ts`.
 *
 * The dispatcher is intentionally trivial: every (reportSlug, level)
 * combination routes to exactly one level handler. We mock the three
 * handler modules to assert *which* one was invoked and *with what
 * args* — the handlers' own logic lives in `levels/__tests__/levels.test.ts`.
 *
 * The route is exhaustive per the matrix in the dispatcher's docstring:
 *
 *   reportSlug=by-managers
 *     level=product-groups → productGroups handler
 *     level=deals          → deals handler
 *     level=managers       → throws (invalid combination)
 *
 *   reportSlug=by-product-groups
 *     level=managers       → managers handler
 *     level=deals          → deals handler
 *     level=product-groups → throws (invalid combination)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  runProductGroupsLevelMock,
  runManagersLevelMock,
  runDealsLevelMock,
} = vi.hoisted(() => ({
  runProductGroupsLevelMock: vi.fn(),
  runManagersLevelMock: vi.fn(),
  runDealsLevelMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/org/repository", () => ({
  resolveExpandedDepartmentFilterIds: vi.fn(async (ids: string[]) => [...ids]),
}));

vi.mock("@/features/reports/drilldown/levels/productGroups", () => ({
  runProductGroupsLevel: runProductGroupsLevelMock,
}));
vi.mock("@/features/reports/drilldown/levels/managers", () => ({
  runManagersLevel: runManagersLevelMock,
}));
vi.mock("@/features/reports/drilldown/levels/deals", () => ({
  runDealsLevel: runDealsLevelMock,
}));

import { runDrilldown } from "../runDrilldown";
import type { DrilldownRequest } from "../types";

beforeEach(() => {
  runProductGroupsLevelMock.mockReset();
  runManagersLevelMock.mockReset();
  runDealsLevelMock.mockReset();
});

const baseRequest = (
  overrides: Partial<DrilldownRequest> = {},
): DrilldownRequest => ({
  sectionSlug: "sales",
  reportSlug: "by-managers",
  rowKey: { managerId: 42 },
  period: { from: "2026-04-01", to: "2026-04-28" },
  comparisonPeriod: { from: "2026-03-04", to: "2026-03-31" },
  filters: {},
  level: "product-groups",
  ...overrides,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fakeSupabase = { from: vi.fn() } as any;

describe("runDrilldown — by-managers", () => {
  it("routes (level=product-groups) to runProductGroupsLevel", async () => {
    const canned = { ok: true as const, level: "product-groups" as const };
    runProductGroupsLevelMock.mockResolvedValue(canned);

    const req = baseRequest({ level: "product-groups" });
    const res = await runDrilldown(req, fakeSupabase);

    expect(runProductGroupsLevelMock).toHaveBeenCalledTimes(1);
    expect(runProductGroupsLevelMock).toHaveBeenCalledWith(req, fakeSupabase);
    expect(runManagersLevelMock).not.toHaveBeenCalled();
    expect(runDealsLevelMock).not.toHaveBeenCalled();
    expect(res).toBe(canned);
  });

  it("routes (level=deals) to runDealsLevel", async () => {
    const canned = { ok: true as const, level: "deals" as const };
    runDealsLevelMock.mockResolvedValue(canned);

    const req = baseRequest({ level: "deals" });
    const res = await runDrilldown(req, fakeSupabase);

    expect(runDealsLevelMock).toHaveBeenCalledTimes(1);
    expect(runDealsLevelMock).toHaveBeenCalledWith(req, fakeSupabase);
    expect(runProductGroupsLevelMock).not.toHaveBeenCalled();
    expect(runManagersLevelMock).not.toHaveBeenCalled();
    expect(res).toBe(canned);
  });

  it("throws on invalid (level=managers) combination", async () => {
    await expect(
      runDrilldown(baseRequest({ level: "managers" }), fakeSupabase),
    ).rejects.toThrow(/managers/);
    expect(runProductGroupsLevelMock).not.toHaveBeenCalled();
    expect(runManagersLevelMock).not.toHaveBeenCalled();
    expect(runDealsLevelMock).not.toHaveBeenCalled();
  });
});

describe("runDrilldown — by-product-groups", () => {
  it("routes (level=managers) to runManagersLevel", async () => {
    const canned = { ok: true as const, level: "managers" as const };
    runManagersLevelMock.mockResolvedValue(canned);

    const req = baseRequest({
      reportSlug: "by-product-groups",
      rowKey: { productGroupId: 1 },
      level: "managers",
    });
    const res = await runDrilldown(req, fakeSupabase);

    expect(runManagersLevelMock).toHaveBeenCalledTimes(1);
    expect(runManagersLevelMock).toHaveBeenCalledWith(req, fakeSupabase);
    expect(runProductGroupsLevelMock).not.toHaveBeenCalled();
    expect(runDealsLevelMock).not.toHaveBeenCalled();
    expect(res).toBe(canned);
  });

  it("routes (level=deals) to runDealsLevel", async () => {
    const canned = { ok: true as const, level: "deals" as const };
    runDealsLevelMock.mockResolvedValue(canned);

    const req = baseRequest({
      reportSlug: "by-product-groups",
      rowKey: { productGroupId: 1 },
      level: "deals",
    });
    const res = await runDrilldown(req, fakeSupabase);

    expect(runDealsLevelMock).toHaveBeenCalledTimes(1);
    expect(runDealsLevelMock).toHaveBeenCalledWith(req, fakeSupabase);
    expect(runManagersLevelMock).not.toHaveBeenCalled();
    expect(runProductGroupsLevelMock).not.toHaveBeenCalled();
    expect(res).toBe(canned);
  });

  it("throws on invalid (level=product-groups) combination", async () => {
    await expect(
      runDrilldown(
        baseRequest({
          reportSlug: "by-product-groups",
          rowKey: { productGroupId: 1 },
          level: "product-groups",
        }),
        fakeSupabase,
      ),
    ).rejects.toThrow(/product-groups/);
    expect(runProductGroupsLevelMock).not.toHaveBeenCalled();
    expect(runManagersLevelMock).not.toHaveBeenCalled();
    expect(runDealsLevelMock).not.toHaveBeenCalled();
  });
});
