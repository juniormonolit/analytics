import { describe, expect, it } from "vitest";

import {
  formatThresholdForInput,
  parseThresholdInput,
} from "../thresholdInput";

describe("thresholdInput", () => {
  it("parses percent thresholds as display percents (12,5 → 12.5)", () => {
    expect(parseThresholdInput("12,5", "percent")).toBe(12.5);
    expect(parseThresholdInput("15", "percent")).toBe(15);
  });

  it("formats percent thresholds without scaling to fraction", () => {
    expect(formatThresholdForInput(12.3, "percent", 1)).toBe("12,3");
    expect(formatThresholdForInput(15, "percent", 0)).toBe("15");
  });

  it("rounds integer metric thresholds", () => {
    expect(parseThresholdInput("12,7", "int")).toBe(13);
    expect(formatThresholdForInput(42.9, "int", 0)).toBe("43");
  });
});
