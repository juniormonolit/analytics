/** Shared sizing for report toolbar controls (segmented switches + buttons). */
export const TOOLBAR_CONTROL_HEIGHT = "h-8";

export const TOOLBAR_SEGMENTED =
  "inline-flex items-center gap-0.5 rounded-md border border-border-primary bg-bg-card p-0.5";

export function toolbarSegmentedButtonClass(isActive: boolean): string {
  return `rounded px-3 py-1 text-xs font-medium transition-colors ${
    isActive
      ? "bg-accent-primary text-text-on-accent"
      : "text-text-secondary hover:bg-bg-card-hover hover:text-text-primary"
  }`;
}

export const TOOLBAR_ACTION_BUTTON = `${TOOLBAR_CONTROL_HEIGHT} inline-flex items-center gap-2 rounded-md border border-input-border bg-input-bg px-3 text-sm text-text-primary transition-colors hover:border-input-border-hover`;

export const TOOLBAR_ICON_BUTTON = `${TOOLBAR_CONTROL_HEIGHT} inline-flex w-8 items-center justify-center rounded-md border border-input-border bg-input-bg text-text-secondary transition-colors hover:border-input-border-hover hover:text-text-primary`;
