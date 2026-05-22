import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, it, expect } from "vitest";

import { tokenNames, tokenVar, type TokenName } from "../tokens";

const here = path.dirname(fileURLToPath(import.meta.url));
const designDocPath = path.resolve(
  here,
  "..",
  "..",
  "..",
  "design",
  "design-system-light-dark-theme.md",
);

const designDoc = readFileSync(designDocPath, "utf8");

const TOKEN_LINE_RE = /^\|\s*([a-z][a-z0-9-]*)\s*\|\s*`([^`]+)`\s*\|/gm;
const LIGHT_HEADER = "## 🌞 Light Theme";
const DARK_HEADER = "## 🌚 Dark Theme";
// `## Scrollbar` is a Level-2 header that closes the Dark section; the
// Level-3 sub-table header `### Scrollbar` inside Dark would also match a
// plain `## Scrollbar` substring, so we anchor on the trailing em-dash that
// only appears in the Level-2 heading.
const SCROLLBAR_GUIDE_HEADER = "## Scrollbar —";

function sliceSection(start: string, end: string): string {
  const startIdx = designDoc.indexOf(start);
  const endIdx = designDoc.indexOf(end, startIdx + start.length);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(
      `Не удалось найти секцию "${start}"…"${end}" в design doc`,
    );
  }
  return designDoc.slice(startIdx, endIdx);
}

function parseTokensFromSection(section: string): string[] {
  const found: string[] = [];
  for (const m of section.matchAll(TOKEN_LINE_RE)) {
    found.push(m[1]);
  }
  return found;
}

const lightSection = sliceSection(LIGHT_HEADER, DARK_HEADER);
const darkSection = sliceSection(DARK_HEADER, SCROLLBAR_GUIDE_HEADER);

const lightTokens = parseTokensFromSection(lightSection);
const darkTokens = parseTokensFromSection(darkSection);

describe("design doc parsing (sanity)", () => {
  it("parses a non-trivial number of light tokens", () => {
    expect(lightTokens.length).toBeGreaterThan(50);
  });

  it("parses a non-trivial number of dark tokens", () => {
    expect(darkTokens.length).toBeGreaterThan(50);
  });

  it("light and dark sections declare exactly the same token names", () => {
    expect(new Set(lightTokens)).toEqual(new Set(darkTokens));
  });
});

describe("tokenNames contract", () => {
  it("contains no duplicates", () => {
    const dupes = tokenNames.filter(
      (name, i, arr) => arr.indexOf(name) !== i,
    );
    expect(dupes).toEqual([]);
  });

  it("includes every token from the Light theme section", () => {
    const missing = lightTokens.filter(
      (token) => !tokenNames.includes(token as TokenName),
    );
    expect(missing).toEqual([]);
  });

  it("includes every token from the Dark theme section", () => {
    const missing = darkTokens.filter(
      (token) => !tokenNames.includes(token as TokenName),
    );
    expect(missing).toEqual([]);
  });

  it("does not declare tokens that are absent from the design doc", () => {
    const designSet = new Set([...lightTokens, ...darkTokens]);
    const stray = tokenNames.filter((name) => !designSet.has(name));
    expect(stray).toEqual([]);
  });
});

describe("tokenVar() helper", () => {
  it.each<[TokenName, string]>([
    ["bg-primary", "var(--bg-primary)"],
    ["success-bg", "var(--success-bg)"],
    ["scrollbar-thumb-active", "var(--scrollbar-thumb-active)"],
    ["chart-tooltip-border", "var(--chart-tooltip-border)"],
    ["table-header-bg", "var(--table-header-bg)"],
    ["highlight-soft", "var(--highlight-soft)"],
  ])("returns var(--%s) for %s", (name, expected) => {
    expect(tokenVar(name)).toBe(expected);
  });
});
