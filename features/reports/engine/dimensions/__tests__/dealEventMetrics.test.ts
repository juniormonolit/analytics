import { describe, expect, it } from "vitest";

import { attributedMilestoneToPeriodDealEvent } from "../dealEventMetrics";

describe("attributedMilestoneToPeriodDealEvent", () => {
  it("uses current manager and amount from deals", () => {
    const event = attributedMilestoneToPeriodDealEvent("2026-05-10T10:00:00", {
      deal_id: 42,
      current_manager_id: 1867,
      amount: 15000,
    });

    expect(event.deal_id).toBe(42);
    expect(event.manager_id).toBe(1867);
    expect(event.amount_at_event).toBe(15000);
    expect(event.event_at).toBe("2026-05-10T10:00:00");
  });
});
