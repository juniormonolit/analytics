import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, it, expect } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..", "..", "..");

const homePagePath = path.resolve(projectRoot, "app", "page.tsx");
const salesIndexPagePath = path.resolve(projectRoot, "app", "sales", "page.tsx");

const homeSource = readFileSync(homePagePath, "utf8");
const salesIndexSource = readFileSync(salesIndexPagePath, "utf8");

describe("app/page.tsx — redirects to the default Sales report", () => {
  it("calls redirect('/sales/by-managers')", () => {
    expect(homeSource).toMatch(/redirect\(\s*["']\/sales\/by-managers["']\s*\)/);
  });

  it("imports redirect from next/navigation", () => {
    expect(homeSource).toMatch(
      /import\s*\{[^}]*\bredirect\b[^}]*\}\s*from\s*["']next\/navigation["']/,
    );
  });

  it("is a default-export server component (no 'use client' directive)", () => {
    expect(homeSource).not.toMatch(/^\s*["']use client["']/m);
    expect(homeSource).toMatch(/export\s+default\s+function\b/);
  });
});

describe("app/sales/page.tsx — redirects to the default Sales report", () => {
  it("calls redirect('/sales/by-managers')", () => {
    expect(salesIndexSource).toMatch(
      /redirect\(\s*["']\/sales\/by-managers["']\s*\)/,
    );
  });

  it("imports redirect from next/navigation", () => {
    expect(salesIndexSource).toMatch(
      /import\s*\{[^}]*\bredirect\b[^}]*\}\s*from\s*["']next\/navigation["']/,
    );
  });

  it("is a default-export server component (no 'use client' directive)", () => {
    expect(salesIndexSource).not.toMatch(/^\s*["']use client["']/m);
    expect(salesIndexSource).toMatch(/export\s+default\s+function\b/);
  });
});
