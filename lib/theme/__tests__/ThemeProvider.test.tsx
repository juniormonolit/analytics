import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ThemeProvider, useTheme } from "../ThemeProvider";
import {
  THEME_STORAGE_KEY,
  inlineThemeScript,
} from "../inlineThemeScript";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

/**
 * Simulates the production boot flow: the inline script writes
 * `data-theme` onto <html> based on localStorage BEFORE React mounts.
 * Without doing this in tests, ThemeProvider would observe an undefined
 * dataset and the integration assertions would not match production behaviour.
 */
function runBootScript(): void {
  new Function(inlineThemeScript)();
}

beforeEach(() => {
  delete document.documentElement.dataset.theme;
  window.localStorage.clear();
});

function ThemedHarness() {
  return (
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>
  );
}

describe("<ThemeProvider /> + <ThemeToggle />", () => {
  it("defaults to light when localStorage is empty", () => {
    runBootScript();
    render(<ThemedHarness />);
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("toggles light → dark on click and persists to localStorage", async () => {
    runBootScript();
    const user = userEvent.setup();
    render(<ThemedHarness />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute(
      "aria-label",
      "Включить тёмную тему",
    );

    await user.click(button);

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      "Включить светлую тему",
    );
  });

  it("toggles dark → light on a second click", async () => {
    runBootScript();
    const user = userEvent.setup();
    render(<ThemedHarness />);

    const button = screen.getByRole("button");
    await user.click(button);
    await user.click(button);

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("respects pre-set localStorage on initial render", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    runBootScript();
    render(<ThemedHarness />);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      "Включить светлую тему",
    );
  });

  it("ignores garbage in localStorage and falls back to light", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "neon");
    runBootScript();
    render(<ThemedHarness />);
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

describe("useTheme()", () => {
  it("throws when called outside of <ThemeProvider>", () => {
    function NakedConsumer() {
      useTheme();
      return null;
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<NakedConsumer />)).toThrow(
      /useTheme must be used inside <ThemeProvider>/,
    );
    spy.mockRestore();
  });
});
