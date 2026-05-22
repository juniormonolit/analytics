import { describe, it, expect } from "vitest";

import { SECTIONS, SETTINGS, SALES_REPORTS } from "../sections";

describe("SECTIONS", () => {
  it("declares exactly four main sections in the documented order", () => {
    expect(SECTIONS.map((section) => section.slug)).toEqual([
      "hr",
      "marketing",
      "sales",
      "delivery",
    ]);
  });

  it("only enables the Sales section in MVP scope", () => {
    const enabled = SECTIONS.filter((section) => !section.disabled);
    expect(enabled).toHaveLength(1);
    expect(enabled[0].slug).toBe("sales");

    const disabledSlugs = SECTIONS.filter((s) => s.disabled).map((s) => s.slug);
    expect(disabledSlugs.sort()).toEqual(["delivery", "hr", "marketing"]);
  });

  it("exposes all four navigable hrefs (top-level entry points)", () => {
    expect(SECTIONS.map((section) => section.href)).toEqual([
      "/hr",
      "/marketing",
      "/sales",
      "/delivery",
    ]);
  });

  it("uses Russian labels for the four main sections", () => {
    expect(SECTIONS.map((section) => section.label)).toEqual([
      "Найм",
      "Маркетинг",
      "Продажи",
      "Реализация",
    ]);
  });

  it("attaches every main section a renderable Lucide icon component", () => {
    for (const section of SECTIONS) {
      // Lucide icons are React components; depending on the lucide-react
      // version they can be plain function components or forwardRef objects.
      // Both are "renderable" — we just assert the field is defined.
      expect(section.icon).toBeDefined();
      expect(["function", "object"]).toContain(typeof section.icon);
    }
  });
});

describe("SECTIONS — Sales reports", () => {
  const sales = SECTIONS.find((s) => s.slug === "sales");

  it("declares the Sales section with reports", () => {
    expect(sales).toBeDefined();
    expect(sales?.reports).toBeDefined();
  });

  it("ships exactly two MVP reports with the expected slugs", () => {
    const reportSlugs = sales?.reports?.map((r) => r.slug);
    expect(reportSlugs).toEqual(["by-managers", "by-product-groups"]);
  });

  it("wires both reports to /sales/<slug> hrefs", () => {
    const hrefs = sales?.reports?.map((r) => r.href);
    expect(hrefs).toEqual([
      "/sales/by-managers",
      "/sales/by-product-groups",
    ]);
  });

  it("uses Russian labels for both reports", () => {
    const labels = sales?.reports?.map((r) => r.label);
    expect(labels).toEqual(["По менеджерам", "По товарным группам"]);
  });
});

describe("SETTINGS", () => {
  it("is enabled for internal debug access", () => {
    expect(SETTINGS.disabled).toBe(false);
  });

  it("points at /settings", () => {
    expect(SETTINGS.href).toBe("/settings");
  });

  it("has a Russian label and an icon", () => {
    expect(SETTINGS.label).toBe("Настройки");
    expect(SETTINGS.icon).toBeDefined();
    expect(["function", "object"]).toContain(typeof SETTINGS.icon);
  });
});

describe("SALES_REPORTS", () => {
  it("deep-equals the Sales section's reports array", () => {
    const sales = SECTIONS.find((s) => s.slug === "sales");
    expect(SALES_REPORTS).toEqual(sales?.reports);
  });

  it("contains exactly two reports in the documented order", () => {
    expect(SALES_REPORTS).toHaveLength(2);
    expect(SALES_REPORTS[0].slug).toBe("by-managers");
    expect(SALES_REPORTS[1].slug).toBe("by-product-groups");
  });
});
