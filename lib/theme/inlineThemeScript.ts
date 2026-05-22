/**
 * Pre-hydration theme bootstrap.
 *
 * This script is injected synchronously into <head> so the correct
 * `data-theme` attribute is applied to <html> before React hydrates,
 * preventing FOUC (flash of unstyled content) on theme changes.
 *
 * It reads the persisted preference from `localStorage['bi.theme']`
 * and falls back to `'light'` when nothing is stored.
 */

export const THEME_STORAGE_KEY = "bi.theme";

export type ThemeName = "light" | "dark";

export const inlineThemeScript = `
(function () {
  try {
    var stored = window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var theme = stored === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
  } catch (e) {
    document.documentElement.dataset.theme = "light";
  }
})();
`;
