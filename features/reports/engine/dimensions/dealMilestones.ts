import type { Period } from "@/lib/period/types";

import type { PeriodDealEvent } from "./dealEventMetrics";
import { periodEndExclusiveIso, periodStartIso } from "./primaryRepeatDeals";

export type DealMilestone = {
  deal_id: number;
  manager_id: number;
  amount_at_event: number | null;
  event_at: string;
};

export type DealMilestones = {
  deal_id: number;
  sale: DealMilestone | null;
  shipment: DealMilestone | null;
};

export type PeriodMilestoneAttribution = {
  sale: DealMilestone | null;
  shipment: DealMilestone | null;
};

function toMilestone(event: PeriodDealEvent): DealMilestone {
  return {
    deal_id: event.deal_id,
    manager_id: event.manager_id,
    amount_at_event: event.amount_at_event,
    event_at: event.event_at,
  };
}

export function isEventInPeriod(eventAt: string, period: Period): boolean {
  return (
    eventAt >= periodStartIso(period) && eventAt < periodEndExclusiveIso(period)
  );
}

export function groupEventsByDealId(
  events: ReadonlyArray<PeriodDealEvent>,
): Map<number, PeriodDealEvent[]> {
  const grouped = new Map<number, PeriodDealEvent[]>();

  for (const event of events) {
    const dealId = Number(event.deal_id);
    if (!Number.isFinite(dealId)) continue;

    const bucket = grouped.get(dealId);
    if (bucket) {
      bucket.push(event);
    } else {
      grouped.set(dealId, [event]);
    }
  }

  return grouped;
}

/**
 * Resolve canonical sale/shipment milestones for one deal from its full event history.
 *
 * - `sale` = first `sold` stage event ever
 * - `shipment` = first `shipped` stage event ever
 * - shipped-without-sold counts only as shipment, not as sale
 */
export function resolveDealMilestones(
  dealId: number,
  events: ReadonlyArray<PeriodDealEvent>,
  salesStageIds: ReadonlySet<string>,
  shipmentsStageIds: ReadonlySet<string>,
): DealMilestones {
  const sorted = [...events].sort((left, right) =>
    left.event_at.localeCompare(right.event_at),
  );

  let sale: DealMilestone | null = null;
  let shipment: DealMilestone | null = null;

  for (const event of sorted) {
    if (!sale && salesStageIds.has(event.stage_id)) {
      sale = toMilestone(event);
    }
    if (!shipment && shipmentsStageIds.has(event.stage_id)) {
      shipment = toMilestone(event);
    }
  }

  return { deal_id: dealId, sale, shipment };
}

export function resolveAllDealMilestones(
  events: ReadonlyArray<PeriodDealEvent>,
  salesStageIds: ReadonlySet<string>,
  shipmentsStageIds: ReadonlySet<string>,
): DealMilestones[] {
  const grouped = groupEventsByDealId(events);
  const milestones: DealMilestones[] = [];

  for (const [dealId, dealEvents] of grouped) {
    milestones.push(
      resolveDealMilestones(dealId, dealEvents, salesStageIds, shipmentsStageIds),
    );
  }

  return milestones;
}

/** Map deal milestones to the subset that falls in the requested period. */
export function attributeMilestonesToPeriod(
  milestones: DealMilestones,
  period: Period,
): PeriodMilestoneAttribution {
  const saleInPeriod =
    milestones.sale != null && isEventInPeriod(milestones.sale.event_at, period);
  const shipmentInPeriod =
    milestones.shipment != null &&
    isEventInPeriod(milestones.shipment.event_at, period);

  return {
    sale: saleInPeriod ? milestones.sale : null,
    shipment: shipmentInPeriod ? milestones.shipment : null,
  };
}

export function milestoneToPeriodDealEvent(
  milestone: DealMilestone,
  stageId = "",
): PeriodDealEvent {
  return {
    deal_id: milestone.deal_id,
    manager_id: milestone.manager_id,
    stage_id: stageId,
    amount_at_event: milestone.amount_at_event,
    event_at: milestone.event_at,
  };
}
