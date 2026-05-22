import { describe, expect, it } from "vitest";

import {
  isConfirmedReservationsMetricId,
  isReservationsMetricId,
} from "../reservationDeals";

describe("reservationDeals helpers", () => {
  it("recognises reservation metric ids", () => {
    expect(isReservationsMetricId("reservations_count")).toBe(true);
    expect(isConfirmedReservationsMetricId("confirmed_reservations_count")).toBe(
      true,
    );
    expect(isReservationsMetricId("primary_deals_count")).toBe(false);
  });
});
