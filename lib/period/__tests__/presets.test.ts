/**
 * Tests for `lib/period/presets.ts`.
 *
 * Verifies the six fixed presets exposed under the calendar:
 * Сегодня, Вчера, Эта неделя, Прошлая неделя, Этот месяц, Прошлый
 * месяц. Each preset is a pure `(today: Date) → Period` function so we
 * can exhaustively pin behavior at notable date anchors.
 *
 * The "week" presets in the implementation use `weekStartsOn: 1` (so
 * weeks run Monday → Sunday) — both Monday and Sunday `today` anchors
 * are exercised below.
 */
import { describe, expect, it } from "vitest";

import {
  PRESETS,
  preset_lastMonth,
  preset_lastWeek,
  preset_thisMonth,
  preset_thisWeek,
  preset_today,
  preset_yesterday,
} from "../presets";

function midnight(year: number, month1: number, day: number): Date {
  return new Date(year, month1 - 1, day, 0, 0, 0, 0);
}

describe("PRESETS catalog", () => {
  it("declares the six presets in the documented order", () => {
    expect(PRESETS.map((p) => p.id)).toEqual([
      "today",
      "yesterday",
      "thisWeek",
      "lastWeek",
      "thisMonth",
      "lastMonth",
    ]);
  });

  it("uses Russian labels matching the spec / mockups", () => {
    expect(PRESETS.map((p) => p.label)).toEqual([
      "Сегодня",
      "Вчера",
      "Эта неделя",
      "Прошлая неделя",
      "Этот месяц",
      "Прошлый месяц",
    ]);
  });

  it("each preset is callable and returns a non-empty Period", () => {
    const today = midnight(2026, 4, 29);
    for (const preset of PRESETS) {
      const result = preset.fn(today);
      expect(result.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.from <= result.to).toBe(true);
    }
  });
});

describe("preset_today / preset_yesterday", () => {
  it.each([
    [midnight(2026, 4, 29), "2026-04-29"],
    [midnight(2026, 1, 1), "2026-01-01"],
    [midnight(2026, 12, 31), "2026-12-31"],
  ])("preset_today(%o) returns a single-day range", (today, iso) => {
    expect(preset_today(today)).toEqual({ from: iso, to: iso });
  });

  it("preset_yesterday(2026-04-29) → 2026-04-28", () => {
    expect(preset_yesterday(midnight(2026, 4, 29))).toEqual({
      from: "2026-04-28",
      to: "2026-04-28",
    });
  });

  it("preset_yesterday wraps month boundaries (2026-05-01 → 2026-04-30)", () => {
    expect(preset_yesterday(midnight(2026, 5, 1))).toEqual({
      from: "2026-04-30",
      to: "2026-04-30",
    });
  });

  it("preset_yesterday wraps year boundaries (2026-01-01 → 2025-12-31)", () => {
    expect(preset_yesterday(midnight(2026, 1, 1))).toEqual({
      from: "2025-12-31",
      to: "2025-12-31",
    });
  });
});

describe("preset_thisWeek (Monday-start week)", () => {
  it("Monday anchor: today = 2026-04-27 (Mon) → 2026-04-27 .. 2026-04-27", () => {
    expect(preset_thisWeek(midnight(2026, 4, 27))).toEqual({
      from: "2026-04-27",
      to: "2026-04-27",
    });
  });

  it("Wednesday anchor: today = 2026-04-29 (Wed) → 2026-04-27 .. 2026-04-29", () => {
    expect(preset_thisWeek(midnight(2026, 4, 29))).toEqual({
      from: "2026-04-27",
      to: "2026-04-29",
    });
  });

  it("Sunday anchor: today = 2026-05-03 (Sun) → 2026-04-27 .. 2026-05-03", () => {
    expect(preset_thisWeek(midnight(2026, 5, 3))).toEqual({
      from: "2026-04-27",
      to: "2026-05-03",
    });
  });
});

describe("preset_lastWeek (full Mon..Sun of the previous week)", () => {
  it("Monday anchor: today = 2026-04-27 (Mon) → 2026-04-20 .. 2026-04-26", () => {
    expect(preset_lastWeek(midnight(2026, 4, 27))).toEqual({
      from: "2026-04-20",
      to: "2026-04-26",
    });
  });

  it("Sunday anchor: today = 2026-05-03 (Sun) → 2026-04-20 .. 2026-04-26", () => {
    expect(preset_lastWeek(midnight(2026, 5, 3))).toEqual({
      from: "2026-04-20",
      to: "2026-04-26",
    });
  });

  it("crosses month boundary: today = 2026-05-04 (Mon) → 2026-04-27 .. 2026-05-03", () => {
    expect(preset_lastWeek(midnight(2026, 5, 4))).toEqual({
      from: "2026-04-27",
      to: "2026-05-03",
    });
  });
});

describe("preset_thisMonth", () => {
  it("first of month: today = 2026-04-01 → 2026-04-01 .. 2026-04-01", () => {
    expect(preset_thisMonth(midnight(2026, 4, 1))).toEqual({
      from: "2026-04-01",
      to: "2026-04-01",
    });
  });

  it("end of month: today = 2026-04-30 → 2026-04-01 .. 2026-04-30", () => {
    expect(preset_thisMonth(midnight(2026, 4, 30))).toEqual({
      from: "2026-04-01",
      to: "2026-04-30",
    });
  });

  it("mid-month: today = 2026-04-29 → 2026-04-01 .. 2026-04-29", () => {
    expect(preset_thisMonth(midnight(2026, 4, 29))).toEqual({
      from: "2026-04-01",
      to: "2026-04-29",
    });
  });
});

describe("preset_lastMonth", () => {
  it("today = 2026-04-29 → full March 2026 (2026-03-01 .. 2026-03-31)", () => {
    expect(preset_lastMonth(midnight(2026, 4, 29))).toEqual({
      from: "2026-03-01",
      to: "2026-03-31",
    });
  });

  it("first day of month: today = 2026-04-01 → full March 2026", () => {
    expect(preset_lastMonth(midnight(2026, 4, 1))).toEqual({
      from: "2026-03-01",
      to: "2026-03-31",
    });
  });

  it("non-leap February: today = 2026-03-15 → 2026-02-01 .. 2026-02-28", () => {
    // 2026 is not a leap year (2026 % 4 !== 0), so February has 28 days.
    expect(preset_lastMonth(midnight(2026, 3, 15))).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });

  it("crosses year boundary: today = 2026-01-15 → full December 2025", () => {
    expect(preset_lastMonth(midnight(2026, 1, 15))).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });
});
