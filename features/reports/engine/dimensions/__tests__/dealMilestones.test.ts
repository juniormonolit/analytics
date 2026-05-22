import { describe, expect, it } from "vitest";

import type { PeriodDealEvent } from "../dealEventMetrics";
import {
  attributeMilestonesToPeriod,
  resolveAllDealMilestones,
  resolveDealMilestones,
} from "../dealMilestones";

const SALES_STAGES = new Set(["ST:SOLD"]);
const SHIPMENT_STAGES = new Set(["ST:SHIPPED", "ST:WON"]);

function event(
  dealId: number,
  stageId: string,
  eventAt: string,
  amount = 1000,
): PeriodDealEvent {
  return {
    deal_id: dealId,
    manager_id: 1867,
    stage_id: stageId,
    amount_at_event: amount,
    event_at: eventAt,
  };
}

describe("dealMilestones", () => {
  it("resolves sale and shipment from full deal history", () => {
    const milestones = resolveDealMilestones(
      1,
      [
        event(1, "ST:SOLD", "2026-04-10T10:00:00", 1000),
        event(1, "ST:WON", "2026-05-15T10:00:00", 1000),
      ],
      SALES_STAGES,
      SHIPMENT_STAGES,
    );

    expect(milestones.sale?.event_at).toBe("2026-04-10T10:00:00");
    expect(milestones.shipment?.event_at).toBe("2026-05-15T10:00:00");
  });

  it("does not count shipped-only deal as sale", () => {
    const milestones = resolveDealMilestones(
      2,
      [event(2, "ST:SHIPPED", "2026-05-15T10:00:00", 3000)],
      SALES_STAGES,
      SHIPMENT_STAGES,
    );

    expect(milestones.sale).toBeNull();
    expect(milestones.shipment?.event_at).toBe("2026-05-15T10:00:00");
  });

  it("attributes sold-in-april / shipped-in-may to different periods", () => {
    const all = resolveAllDealMilestones(
      [
        event(1, "ST:SOLD", "2026-04-10T10:00:00", 1000),
        event(1, "ST:WON", "2026-05-15T10:00:00", 1000),
      ],
      SALES_STAGES,
      SHIPMENT_STAGES,
    );

    const april = attributeMilestonesToPeriod(all[0], {
      from: "2026-04-01",
      to: "2026-04-30",
    });
    const may = attributeMilestonesToPeriod(all[0], {
      from: "2026-05-01",
      to: "2026-05-31",
    });

    expect(april.sale).not.toBeNull();
    expect(april.shipment).toBeNull();
    expect(may.sale).toBeNull();
    expect(may.shipment).not.toBeNull();
  });

  it("does not double-count sale in shipment month when sale was earlier", () => {
    const all = resolveAllDealMilestones(
      [
        event(1, "ST:SOLD", "2026-04-10T10:00:00", 1000),
        event(1, "ST:SHIPPED", "2026-05-15T10:00:00", 1000),
      ],
      SALES_STAGES,
      SHIPMENT_STAGES,
    );

    const may = attributeMilestonesToPeriod(all[0], {
      from: "2026-05-01",
      to: "2026-05-31",
    });

    expect(may.sale).toBeNull();
    expect(may.shipment?.event_at).toBe("2026-05-15T10:00:00");
  });
});
