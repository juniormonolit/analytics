import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, it, expect } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const globalsCssPath = path.resolve(here, "..", "globals.css");
const css = readFileSync(globalsCssPath, "utf8");

const themeMatch = css.match(/@theme\s+inline\s*\{([\s\S]*?)\n\}/);
const themeBlock = themeMatch?.[1] ?? "";

function hasMapping(slot: string, source: string): boolean {
  const re = new RegExp(
    `--color-${slot}\\s*:\\s*var\\(--${source}\\)\\s*;`,
  );
  return re.test(themeBlock);
}

describe("Tailwind v4 @theme inline — token wiring", () => {
  it("the @theme inline block exists in globals.css", () => {
    expect(themeBlock).not.toEqual("");
  });

  it("wires the canonical bg/text mappings", () => {
    expect(hasMapping("bg-primary", "bg-primary")).toBe(true);
    expect(hasMapping("text-primary", "text-primary")).toBe(true);
  });

  describe("at least one mapping per design-system group", () => {
    const groups: Array<[string, () => boolean]> = [
      ["background", () => hasMapping("bg-card", "bg-card")],
      ["text", () => hasMapping("text-secondary", "text-secondary")],
      ["border", () => hasMapping("border-primary", "border-primary")],
      ["accent", () => hasMapping("accent-primary", "accent-primary")],
      [
        "status (success / warning / danger / info)",
        () =>
          hasMapping("success", "success") ||
          hasMapping("warning", "warning") ||
          hasMapping("danger", "danger") ||
          hasMapping("info", "info"),
      ],
      [
        "chart",
        () => hasMapping("chart-1", "chart-1") || hasMapping("chart-2", "chart-2"),
      ],
      ["table", () => hasMapping("table-header-bg", "table-header-bg")],
      ["input", () => hasMapping("input-bg", "input-bg")],
      [
        "modal/popover/tooltip",
        () =>
          hasMapping("modal-bg", "modal-bg") ||
          hasMapping("popover-bg", "popover-bg") ||
          hasMapping("tooltip-bg", "tooltip-bg"),
      ],
      [
        "special (positive/negative/neutral/highlight)",
        () =>
          hasMapping("positive", "positive") ||
          hasMapping("negative", "negative") ||
          hasMapping("neutral", "neutral") ||
          hasMapping("highlight", "highlight"),
      ],
    ];

    it.each(groups)("group: %s", (_label, predicate) => {
      expect(predicate()).toBe(true);
    });
  });

  it("declares at least one font-family token (font-sans)", () => {
    expect(themeBlock).toMatch(/--font-sans\s*:/);
  });
});
