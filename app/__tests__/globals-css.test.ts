import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, it, expect } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..", "..");
const globalsCssPath = path.resolve(here, "..", "globals.css");
const designDocPath = path.resolve(
  projectRoot,
  "design",
  "design-system-light-dark-theme.md",
);

const css = readFileSync(globalsCssPath, "utf8");
const designDoc = readFileSync(designDocPath, "utf8");

const TOKEN_LINE_RE = /^\|\s*([a-z][a-z0-9-]*)\s*\|\s*`([^`]+)`\s*\|/gm;

function parseSection(start: string, end: string): string[] {
  const startIdx = designDoc.indexOf(start);
  if (startIdx === -1) {
    throw new Error(`parseSection: start header not found: "${start}"`);
  }
  const endIdx = designDoc.indexOf(end, startIdx + start.length);
  if (endIdx === -1) {
    throw new Error(
      `parseSection: end header not found: "${end}" (searching after "${start}")`,
    );
  }
  const slice = designDoc.slice(startIdx, endIdx);
  return Array.from(slice.matchAll(TOKEN_LINE_RE), (m) => m[1]);
}

const lightTokens = parseSection("## 🌞 Light Theme", "## 🌚 Dark Theme");
// `## Scrollbar — как применять` (Level-2) is the proper end of the Dark
// section. Plain "## Scrollbar" would also match the Level-3 "### Scrollbar"
// sub-table within Dark, truncating the section. Anchor on the em-dash.
const darkTokens = parseSection("## 🌚 Dark Theme", "## Scrollbar —");

function findBlock(re: RegExp): string {
  const all = [...css.matchAll(re)];
  if (all.length === 0) return "";
  return all.reduce((longest, m) =>
    m[1].length > longest[1].length ? m : longest,
  )[1];
}

const ROOT_BLOCK_RE = /:root\s*\{([\s\S]*?)\}/g;
const DARK_BLOCK_RE = /\[data-theme="dark"\]\s*\{([\s\S]*?)\}/g;
const THEME_INLINE_BLOCK_RE = /@theme\s+inline\s*\{([\s\S]*?)\n\}/g;

const rootBlock = findBlock(ROOT_BLOCK_RE);
const darkBlock = findBlock(DARK_BLOCK_RE);
const themeInlineBlock = findBlock(THEME_INLINE_BLOCK_RE);

describe("globals.css — block extraction", () => {
  it("contains a :root block with token declarations", () => {
    expect(rootBlock).not.toEqual("");
    expect(rootBlock).toContain("--bg-primary");
  });

  it('contains a [data-theme="dark"] block with token overrides', () => {
    expect(darkBlock).not.toEqual("");
    expect(darkBlock).toContain("--bg-primary");
  });

  it("contains a @theme inline block (Tailwind v4 token wiring)", () => {
    expect(themeInlineBlock).not.toEqual("");
    expect(themeInlineBlock).toContain("--color-bg-primary");
  });
});

describe("globals.css — Light tokens (:root)", () => {
  it.each(lightTokens)("declares --%s", (token) => {
    const re = new RegExp(`--${token}\\s*:`);
    expect(re.test(rootBlock)).toBe(true);
  });
});

describe("globals.css — Dark tokens ([data-theme=\"dark\"])", () => {
  it.each(darkTokens)("overrides --%s", (token) => {
    const re = new RegExp(`--${token}\\s*:`);
    expect(re.test(darkBlock)).toBe(true);
  });
});

describe("globals.css — scrollbar styling", () => {
  it("declares ::-webkit-scrollbar rule", () => {
    expect(css).toMatch(/::-webkit-scrollbar\s*\{/);
  });

  it("declares ::-webkit-scrollbar-track using --scrollbar-track", () => {
    expect(css).toMatch(/::-webkit-scrollbar-track\s*\{[^}]*--scrollbar-track/);
  });

  it("declares ::-webkit-scrollbar-thumb using --scrollbar-thumb", () => {
    expect(css).toMatch(/::-webkit-scrollbar-thumb\s*\{[^}]*--scrollbar-thumb/);
  });

  it("declares Firefox scrollbar-color using both scrollbar tokens", () => {
    expect(css).toMatch(
      /scrollbar-color\s*:\s*var\(--scrollbar-thumb\)\s+var\(--scrollbar-track\)/,
    );
  });
});

describe("globals.css — selection styling", () => {
  it("declares ::selection rule referencing --selection-bg and --selection-text", () => {
    const m = css.match(/::selection\s*\{([\s\S]*?)\}/);
    expect(m).not.toBeNull();
    const body = m?.[1] ?? "";
    expect(body).toMatch(/var\(--selection-bg\)/);
    expect(body).toMatch(/var\(--selection-text\)/);
  });
});

describe("globals.css — focus styling", () => {
  it("declares :focus-visible rule using --shadow-focus token", () => {
    expect(css).toMatch(
      /:focus-visible\s*\{[\s\S]*?var\(--shadow-focus\)[\s\S]*?\}/,
    );
  });
});

describe("globals.css — gradient / radius / shadow token contract", () => {
  it("declares gradient tokens in :root", () => {
    expect(rootBlock).toMatch(/--gradient-app-bg\s*:/);
    expect(rootBlock).toMatch(/--gradient-surface\s*:/);
    expect(rootBlock).toMatch(/--gradient-card\s*:/);
  });

  it("overrides gradient tokens in dark theme", () => {
    expect(darkBlock).toMatch(/--gradient-app-bg\s*:/);
    expect(darkBlock).toMatch(/--gradient-surface\s*:/);
    expect(darkBlock).toMatch(/--gradient-card\s*:/);
  });

  it("declares radius tokens in :root", () => {
    expect(rootBlock).toMatch(/--radius-md\s*:/);
    expect(rootBlock).toMatch(/--radius-lg\s*:/);
    expect(rootBlock).toMatch(/--radius-xl\s*:/);
    expect(rootBlock).toMatch(/--radius-2xl\s*:/);
    expect(rootBlock).toMatch(/--radius-3xl\s*:/);
  });

  it("declares floating shadow tokens in both themes", () => {
    expect(rootBlock).toMatch(/--shadow-soft-sm\s*:/);
    expect(rootBlock).toMatch(/--shadow-soft-md\s*:/);
    expect(rootBlock).toMatch(/--shadow-soft-lg\s*:/);

    expect(darkBlock).toMatch(/--shadow-soft-sm\s*:/);
    expect(darkBlock).toMatch(/--shadow-soft-md\s*:/);
    expect(darkBlock).toMatch(/--shadow-soft-lg\s*:/);
  });
});

describe("globals.css — custom utilities contract", () => {
  it("declares gradient background utilities under @layer utilities", () => {
    expect(css).toMatch(/@layer\s+utilities\s*\{[\s\S]*?\.bg-app-gradient\s*\{/);
    expect(css).toMatch(
      /@layer\s+utilities\s*\{[\s\S]*?\.bg-surface-gradient\s*\{/,
    );
    expect(css).toMatch(
      /@layer\s+utilities\s*\{[\s\S]*?\.bg-card-gradient\s*\{/,
    );
  });

  it("declares radius token utilities under @layer utilities", () => {
    expect(css).toMatch(
      /@layer\s+utilities\s*\{[\s\S]*?\.rounded-token-md\s*\{[\s\S]*?var\(--radius-md\)/,
    );
    expect(css).toMatch(
      /@layer\s+utilities\s*\{[\s\S]*?\.rounded-token-lg\s*\{[\s\S]*?var\(--radius-lg\)/,
    );
    expect(css).toMatch(
      /@layer\s+utilities\s*\{[\s\S]*?\.rounded-token-xl\s*\{[\s\S]*?var\(--radius-xl\)/,
    );
    expect(css).toMatch(
      /@layer\s+utilities\s*\{[\s\S]*?\.rounded-token-2xl\s*\{[\s\S]*?var\(--radius-2xl\)/,
    );
    expect(css).toMatch(
      /@layer\s+utilities\s*\{[\s\S]*?\.rounded-token-3xl\s*\{[\s\S]*?var\(--radius-3xl\)/,
    );
  });

  it("declares soft shadow utilities under @layer utilities", () => {
    expect(css).toMatch(
      /@layer\s+utilities\s*\{[\s\S]*?\.shadow-soft-sm\s*\{[\s\S]*?var\(--shadow-soft-sm\)/,
    );
    expect(css).toMatch(
      /@layer\s+utilities\s*\{[\s\S]*?\.shadow-soft-md\s*\{[\s\S]*?var\(--shadow-soft-md\)/,
    );
    expect(css).toMatch(
      /@layer\s+utilities\s*\{[\s\S]*?\.shadow-soft-lg\s*\{[\s\S]*?var\(--shadow-soft-lg\)/,
    );
  });
});

describe("globals.css — Tailwind @theme inline mappings reference vars, not literals", () => {
  it("every --color-* declaration references a CSS variable, never a hex/rgb literal", () => {
    const colorDeclRe = /--color-([\w-]+)\s*:\s*([^;]+);/g;
    const offenders: Array<{ name: string; value: string }> = [];
    for (const m of themeInlineBlock.matchAll(colorDeclRe)) {
      const value = m[2].trim();
      if (!/^var\(--[\w-]+\)$/.test(value)) {
        offenders.push({ name: `--color-${m[1]}`, value });
      }
    }
    expect(offenders).toEqual([]);
  });

  it("provides at least one color mapping (sanity)", () => {
    const colorDeclRe = /--color-([\w-]+)\s*:\s*var\(--[\w-]+\)/g;
    const matches = [...themeInlineBlock.matchAll(colorDeclRe)];
    expect(matches.length).toBeGreaterThan(20);
  });
});
