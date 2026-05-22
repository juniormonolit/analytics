import { describe, it, expect } from "vitest";

import {
  THEME_STORAGE_KEY,
  inlineThemeScript,
  type ThemeName,
} from "../inlineThemeScript";

type FakeStorage = {
  getItem: (key: string) => string | null;
};

type FakeWindow = {
  localStorage: FakeStorage;
};

type FakeDocument = {
  documentElement: { dataset: Record<string, string> };
};

function runScriptWithStored(stored: string | null): string | undefined {
  const fakeDocument: FakeDocument = {
    documentElement: { dataset: {} },
  };
  const fakeWindow: FakeWindow = {
    localStorage: {
      getItem: (key) => (key === THEME_STORAGE_KEY ? stored : null),
    },
  };
  const fn = new Function("window", "document", inlineThemeScript);
  fn(fakeWindow, fakeDocument);
  return fakeDocument.documentElement.dataset.theme;
}

function runScriptWithThrowingStorage(): string | undefined {
  const fakeDocument: FakeDocument = {
    documentElement: { dataset: {} },
  };
  const fakeWindow: FakeWindow = {
    localStorage: {
      getItem: () => {
        throw new Error("storage unavailable");
      },
    },
  };
  const fn = new Function("window", "document", inlineThemeScript);
  fn(fakeWindow, fakeDocument);
  return fakeDocument.documentElement.dataset.theme;
}

describe("inlineThemeScript constants", () => {
  it("exports the canonical storage key", () => {
    expect(THEME_STORAGE_KEY).toBe("bi.theme");
  });

  it("ThemeName covers light and dark", () => {
    const lightCheck: ThemeName = "light";
    const darkCheck: ThemeName = "dark";
    expect([lightCheck, darkCheck]).toEqual(["light", "dark"]);
  });
});

describe("inlineThemeScript string", () => {
  it("reads localStorage with the project key", () => {
    expect(inlineThemeScript).toContain('localStorage.getItem("bi.theme")');
  });

  it("references document.documentElement.dataset", () => {
    expect(inlineThemeScript).toMatch(
      /document\.documentElement\.dataset\.theme\s*=/,
    );
  });

  it("contains both 'light' and 'dark' branches", () => {
    expect(inlineThemeScript).toContain('"dark"');
    expect(inlineThemeScript).toContain('"light"');
  });

  it("is wrapped in an IIFE so it runs synchronously", () => {
    expect(inlineThemeScript.trim()).toMatch(/^\(function\s*\(/);
    expect(inlineThemeScript.trim()).toMatch(/\)\(\);?\s*$/);
  });
});

describe("inlineThemeScript runtime behaviour", () => {
  it("applies dark when localStorage holds 'dark'", () => {
    expect(runScriptWithStored("dark")).toBe("dark");
  });

  it("falls back to light when localStorage is empty (null)", () => {
    expect(runScriptWithStored(null)).toBe("light");
  });

  it("falls back to light when stored value is an unknown string", () => {
    expect(runScriptWithStored("solarized")).toBe("light");
  });

  it("falls back to light when stored value is empty string", () => {
    expect(runScriptWithStored("")).toBe("light");
  });

  it("falls back to light when stored value is 'LIGHT' (case-sensitive match)", () => {
    expect(runScriptWithStored("LIGHT")).toBe("light");
  });

  it("falls back to light when localStorage throws (private mode / blocked)", () => {
    expect(runScriptWithThrowingStorage()).toBe("light");
  });
});
