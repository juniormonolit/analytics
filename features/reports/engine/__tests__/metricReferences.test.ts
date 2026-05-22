import { describe, expect, it } from "vitest";

import { CALLED_DEALS_METRIC_ID } from "../dimensions/calledDeals";
import { metricsReferenceId } from "../metricReferences";

describe("metricsReferenceId", () => {
  it("matches direct metric ids and source columns", () => {
    expect(
      metricsReferenceId(
        [{ id: "called_deals_count", source_column: "called_deals_count" }],
        CALLED_DEALS_METRIC_ID,
      ),
    ).toBe(true);
  });

  it("matches calculated metric dependencies", () => {
    expect(
      metricsReferenceId(
        [
          {
            id: "conv_incoming_to_called",
            source_column: null,
            dependencies: ["called_deals_count", "incoming_deals_count"],
          },
        ],
        CALLED_DEALS_METRIC_ID,
      ),
    ).toBe(true);
  });
});
