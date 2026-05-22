import { describe, expect, it } from "vitest";

import {
  CALLED_DEALS_METRIC_ID,
  isCalledDealsMetricId,
  needsCalledDealsFromDeals,
} from "../calledDeals";

describe("calledDeals helpers", () => {
  it("recognises called metric id", () => {
    expect(isCalledDealsMetricId(CALLED_DEALS_METRIC_ID)).toBe(true);
    expect(isCalledDealsMetricId("primary_deals_count")).toBe(false);
  });

  it("detects called metric in catalog rows and dependencies", () => {
    expect(
      needsCalledDealsFromDeals([
        {
          id: "conv_incoming_to_called",
          dependencies: ["called_deals_count"],
        },
      ]),
    ).toBe(true);
  });
});
