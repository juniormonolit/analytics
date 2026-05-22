// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  canonicalManagerId,
  dealSetsByCurrentManager,
  filterDealsByFunnelKind,
  isPrimaryDealsMetricId,
  isRepeatDealsMetricId,
  mergeDealSetsToCanonicalManager,
  periodEndExclusiveIso,
  periodStartIso,
} from "../primaryRepeatDeals";

describe("primaryRepeatDeals helpers", () => {
  it("uses half-open period boundaries on created_at", () => {
    expect(periodStartIso({ from: "2026-05-01", to: "2026-05-18" })).toBe(
      "2026-05-01T00:00:00",
    );
    expect(periodEndExclusiveIso({ from: "2026-05-01", to: "2026-05-18" })).toBe(
      "2026-05-19T00:00:00",
    );
  });

  it("recognises primary and repeat metric ids", () => {
    expect(isPrimaryDealsMetricId("primary_deals_count")).toBe(true);
    expect(isPrimaryDealsMetricId("incoming_deals_count")).toBe(true);
    expect(isRepeatDealsMetricId("repeat_deals_count")).toBe(true);
    expect(isRepeatDealsMetricId("primary_deals_count")).toBe(false);
  });

  it("splits deals by repeat funnel ids", () => {
    const repeatFunnelIds = new Set([2, 5]);
    const deals = [
      { deal_id: 1, current_manager_id: 10, funnel_id: 1 },
      { deal_id: 2, current_manager_id: 10, funnel_id: 2 },
      { deal_id: 3, current_manager_id: 10, funnel_id: 3 },
    ];

    expect(
      filterDealsByFunnelKind(deals, repeatFunnelIds, "primary").map(
        (d) => d.deal_id,
      ),
    ).toEqual([1, 3]);
    expect(
      filterDealsByFunnelKind(deals, repeatFunnelIds, "repeat").map(
        (d) => d.deal_id,
      ),
    ).toEqual([2]);
  });

  it("counts distinct deal_id per manager", () => {
    const deals = [
      { deal_id: 1, current_manager_id: 1867 },
      { deal_id: 1, current_manager_id: 1867 },
      { deal_id: 2, current_manager_id: 1867 },
      { deal_id: 3, current_manager_id: 1906 },
    ];

    expect(dealSetsByCurrentManager(deals).get(1867)?.size).toBe(2);
    expect(dealSetsByCurrentManager(deals).get(1906)?.size).toBe(1);
  });

  it("merges internal and Bitrix manager ids onto the Bitrix key", () => {
    const byBitrixId = new Map([
      [1867, { id: "42", bitrix_id: 1867 }],
    ]);
    const byId = new Map([["42", { id: "42", bitrix_id: 1867 }]]);

    expect(canonicalManagerId(42, byBitrixId, byId)).toBe(1867);
    expect(canonicalManagerId(1867, byBitrixId, byId)).toBe(1867);

    const merged = mergeDealSetsToCanonicalManager(
      new Map([
        [42, new Set([1])],
        [1867, new Set([2])],
      ]),
      byBitrixId,
      byId,
    );
    expect(merged.get(1867)).toBe(2);
  });
});
