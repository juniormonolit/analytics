import { describe, expect, it } from "vitest";

import { resolvePreviewColumns } from "@/lib/debug/previewColumns";

describe("resolvePreviewColumns", () => {
  const metaColumns = [
    { name: "deal_id", dataType: "number", isNullable: false },
    { name: "deal_name", dataType: "string", isNullable: true },
  ];

  it("keeps metadata order and appends extra row keys", () => {
    const columns = resolvePreviewColumns(metaColumns, [
      {
        deal_id: 1,
        deal_name: "Test",
        sold_at: "2026-05-10T10:00:00Z",
      },
    ]);

    expect(columns.map((column) => column.name)).toEqual([
      "deal_id",
      "deal_name",
      "sold_at",
    ]);
    expect(columns[2]?.dataType).toBe("unknown");
  });

  it("deduplicates keys across rows", () => {
    const columns = resolvePreviewColumns(metaColumns, [
      { deal_id: 1, sold_at: "2026-05-10T10:00:00Z" },
      { deal_id: 2, delivered_at: "2026-05-11T10:00:00Z" },
    ]);

    expect(columns.map((column) => column.name)).toEqual([
      "deal_id",
      "deal_name",
      "sold_at",
      "delivered_at",
    ]);
  });
});
