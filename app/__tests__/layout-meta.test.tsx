import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, it, expect } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const layoutPath = path.resolve(here, "..", "layout.tsx");
const source = readFileSync(layoutPath, "utf8");

describe("app/layout.tsx — root document contract", () => {
  it("renders <html> with lang=\"ru\"", () => {
    expect(source).toMatch(/<html[^>]*\blang="ru"/);
  });

  it("opts into suppressHydrationWarning on <html> for the data-theme swap", () => {
    expect(source).toMatch(/<html[^>]*\bsuppressHydrationWarning\b/);
  });

  it("imports the inline theme bootstrap script source", () => {
    expect(source).toMatch(
      /import\s*\{[^}]*\binlineThemeScript\b[^}]*\}\s*from\s*['"]@\/lib\/theme\/inlineThemeScript['"]/,
    );
  });

  it("injects the inline theme script via dangerouslySetInnerHTML before hydration", () => {
    expect(source).toMatch(/<script[^>]*dangerouslySetInnerHTML/);
    expect(source).toMatch(/__html\s*:\s*inlineThemeScript/);
  });

  it("places the bootstrap script inside <head>", () => {
    const headBlock = source.match(/<head>([\s\S]*?)<\/head>/);
    expect(headBlock).not.toBeNull();
    expect(headBlock?.[1] ?? "").toMatch(/inlineThemeScript/);
  });

  it("wraps children in <ThemeProvider>", () => {
    expect(source).toMatch(/<ThemeProvider>[\s\S]*\{children\}[\s\S]*<\/ThemeProvider>/);
  });

  it("declares Russian metadata (title or description in Cyrillic)", () => {
    const metaMatch = source.match(
      /export\s+const\s+metadata[\s\S]*?\}\s*;/,
    );
    expect(metaMatch).not.toBeNull();
    expect(metaMatch?.[0] ?? "").toMatch(/[А-Яа-яЁё]/);
  });
});
