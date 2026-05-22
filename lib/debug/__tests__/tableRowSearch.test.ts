import { describe, expect, it } from "vitest";

import {
  buildTableRowSearchOrFilter,
  escapePostgrestFilterValue,
  normalizeDateSearchTerm,
} from "@/lib/debug/tableRowSearch";

describe("escapePostgrestFilterValue", () => {
  it("quotes values with commas", () => {
    expect(escapePostgrestFilterValue("a,b")).toBe('"a,b"');
  });
});

describe("buildTableRowSearchOrFilter", () => {
  const dealEventsColumns = [
    { name: "id", dataType: "number", isNullable: false },
    { name: "deal_id", dataType: "number", isNullable: false },
    { name: "stage_id", dataType: "string", isNullable: false },
    { name: "event_at", dataType: "timestamp", isNullable: false },
  ];

  const dealsColumns = [
    { name: "deal_id", dataType: "number", isNullable: false },
    { name: "deal_name", dataType: "string", isNullable: true },
    { name: "expected_close_date", dataType: "date", isNullable: true },
    { name: "created_at", dataType: "timestamp", isNullable: false },
  ];

  it("returns null for empty search", () => {
    expect(buildTableRowSearchOrFilter(dealEventsColumns, "  ")).toBeNull();
  });

  it("builds ilike filters for strings and eq for numeric columns", () => {
    const filter = buildTableRowSearchOrFilter(dealEventsColumns, "181875");
    expect(filter).toContain("id.eq.181875");
    expect(filter).toContain("deal_id.eq.181875");
    expect(filter).toContain("stage_id.ilike.%181875%");
    expect(filter).not.toContain("event_at");
  });

  it("does not apply ilike to date or timestamp columns for numeric search", () => {
    const filter = buildTableRowSearchOrFilter(dealsColumns, "173153");
    expect(filter).toContain("deal_id.eq.173153");
    expect(filter).toContain("deal_name.ilike.%173153%");
    expect(filter).not.toContain("expected_close_date");
    expect(filter).not.toContain("created_at");
  });

  it("matches date and timestamp columns by exact date value", () => {
    const filter = buildTableRowSearchOrFilter(dealsColumns, "2024-05-22");
    expect(filter).toContain("expected_close_date.eq.2024-05-22");
    expect(filter).toContain("created_at.eq.2024-05-22");
  });

  it("builds boolean eq filters", () => {
    const columns = [{ name: "is_active", dataType: "boolean", isNullable: false }];
    expect(buildTableRowSearchOrFilter(columns, "true")).toBe("is_active.eq.true");
  });
});

describe("normalizeDateSearchTerm", () => {
  it("accepts ISO dates", () => {
    expect(normalizeDateSearchTerm("2024-05-22")).toBe("2024-05-22");
  });
});
