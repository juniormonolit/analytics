import { describe, expect, it } from "vitest";

import {
  normalizeMetricColorSettings,
  resolveMetricValueStyle,
  resizeGradientStops,
} from "../gradient";

describe("metric color gradient", () => {
  it("returns null when gradient is disabled", () => {
    const style = resolveMetricValueStyle(42, {
      enabled: false,
      stops: [
        { upTo: 10, colorId: "red" },
        { upTo: null, colorId: "green" },
      ],
    });
    expect(style).toBeNull();
  });

  it("picks color by ascending thresholds", () => {
    const settings = normalizeMetricColorSettings({
      enabled: true,
      stops: [
        { upTo: 10, colorId: "red" },
        { upTo: 50, colorId: "yellow" },
        { upTo: null, colorId: "green" },
      ],
    });

    expect(resolveMetricValueStyle(5, settings)?.backgroundColor).toBe("#fee2e2");
    expect(resolveMetricValueStyle(25, settings)?.backgroundColor).toBe("#fef3c7");
    expect(resolveMetricValueStyle(100, settings)?.backgroundColor).toBe("#dcfce7");
  });

  it("resizes stop count while keeping the last open-ended", () => {
    const stops = resizeGradientStops(
      [
        { upTo: 10, colorId: "red" },
        { upTo: null, colorId: "green" },
      ],
      4,
    );
    expect(stops).toHaveLength(4);
    expect(stops[3].upTo).toBeNull();
  });
});
