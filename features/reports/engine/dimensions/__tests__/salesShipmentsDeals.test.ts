import { describe, expect, it } from "vitest";

import {
  isSalesCountMetricId,
  isSalesShipmentsMetricId,
  isShipmentsCountMetricId,
  needsSalesShipmentsFromDeals,
  PRIMARY_SALES_AMOUNT_METRIC_ID,
  PRIMARY_SALES_COUNT_METRIC_ID,
  PRIMARY_SHIPMENTS_AMOUNT_METRIC_ID,
  PRIMARY_SHIPMENTS_COUNT_METRIC_ID,
} from "../salesShipmentsDeals";

describe("salesShipmentsDeals", () => {
  it("detects sales and shipments metric ids", () => {
    expect(isSalesShipmentsMetricId(PRIMARY_SALES_COUNT_METRIC_ID)).toBe(true);
    expect(isSalesShipmentsMetricId(PRIMARY_SHIPMENTS_COUNT_METRIC_ID)).toBe(true);
    expect(isSalesCountMetricId(PRIMARY_SALES_COUNT_METRIC_ID)).toBe(true);
    expect(isShipmentsCountMetricId(PRIMARY_SHIPMENTS_COUNT_METRIC_ID)).toBe(true);
    expect(needsSalesShipmentsFromDeals([{ id: PRIMARY_SALES_AMOUNT_METRIC_ID }])).toBe(
      true,
    );
  });
});
