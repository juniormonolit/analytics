/**
 * Curated mirror of CSS design tokens defined in `app/globals.css`.
 * Kept in sync by hand from `design/design-system-light-dark-theme.md`.
 *
 * Each entry corresponds to a `--<token>` CSS custom property exposed in both
 * the `:root` (light) and `[data-theme="dark"]` blocks.
 */

export const tokenNames = [
  // Background
  "bg-primary",
  "bg-secondary",
  "bg-tertiary",
  "bg-card",
  "bg-card-hover",
  "bg-elevated",
  "bg-overlay",

  // Text
  "text-primary",
  "text-secondary",
  "text-muted",
  "text-inverse",
  "text-link",
  "text-link-hover",
  "text-on-accent",
  "text-placeholder",

  // Border
  "border-primary",
  "border-secondary",
  "border-strong",
  "border-focus",

  // Accent
  "accent-primary",
  "accent-secondary",
  "accent-hover",
  "accent-soft",

  // Status
  "success",
  "success-bg",
  "success-border",
  "warning",
  "warning-bg",
  "warning-border",
  "danger",
  "danger-bg",
  "danger-border",
  "info",
  "info-bg",
  "info-border",

  // Chart Colors
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "chart-6",
  "chart-grid",
  "chart-axis",
  "chart-tooltip-bg",
  "chart-tooltip-border",

  // Shadows
  "shadow-sm",
  "shadow-md",
  "shadow-lg",
  "shadow-focus",

  // Interactive
  "hover",
  "active",
  "disabled-bg",
  "disabled-text",
  "skeleton",
  "skeleton-shimmer",

  // Scrollbar
  "scrollbar-track",
  "scrollbar-thumb",
  "scrollbar-thumb-hover",
  "scrollbar-thumb-active",
  "scrollbar-corner",

  // Selection
  "selection-bg",
  "selection-text",

  // Input / Form
  "input-bg",
  "input-bg-hover",
  "input-border",
  "input-border-hover",
  "input-border-focus",
  "input-text",
  "input-placeholder",
  "input-disabled-bg",
  "input-disabled-text",

  // Table
  "table-bg",
  "table-header-bg",
  "table-row-hover",
  "table-row-selected",
  "table-border",
  "table-zebra",

  // Modal / Popover / Tooltip
  "modal-bg",
  "popover-bg",
  "tooltip-bg",
  "tooltip-text",
  "tooltip-border",

  // Special
  "positive",
  "negative",
  "neutral",
  "highlight",
  "highlight-soft",
] as const;

export type TokenName = (typeof tokenNames)[number];

/** Returns the CSS `var(--<token>)` reference for use in inline styles. */
export function tokenVar(name: TokenName): string {
  return `var(--${name})`;
}
