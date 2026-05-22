"use client";

import Link from "next/link";
import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";

type SidebarItemProps = {
  icon: LucideIcon;
  label: string;
  href?: string;
  disabled?: boolean;
  active?: boolean;
  collapsed?: boolean;
  expandable?: boolean;
  expanded?: boolean;
  onExpandToggle?: () => void;
};

const ROW_BASE = "flex items-center rounded-md transition-colors";
const NAV_BASE = "flex flex-1 items-center gap-3 px-3 py-2 text-sm";

/**
 * One row in the sidebar navigation. Renders as a Link when `href` is given
 * and the item is not disabled; renders as a non-interactive `<div>` for
 * disabled or section-only items. Optional expandable chevron sits at the
 * end of the row and is rendered as a sibling button so we don't nest
 * `<button>` inside `<a>`.
 */
export function SidebarItem({
  icon: Icon,
  label,
  href,
  disabled = false,
  active = false,
  collapsed = false,
  expandable = false,
  expanded = false,
  onExpandToggle,
}: SidebarItemProps) {
  const showChevron = expandable && !collapsed && Boolean(onExpandToggle);

  const navInner = (
    <>
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {!collapsed && (
        <span className="flex-1 truncate text-left">{label}</span>
      )}
    </>
  );

  let navElement;
  if (disabled) {
    navElement = (
      <div
        aria-disabled="true"
        title={collapsed ? label : undefined}
        className={`${NAV_BASE} text-disabled-text cursor-not-allowed`}
      >
        {navInner}
      </div>
    );
  } else if (href) {
    navElement = (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        title={collapsed ? label : undefined}
        className={`${NAV_BASE} ${
          active ? "text-accent-primary" : "text-text-secondary"
        }`}
      >
        {navInner}
      </Link>
    );
  } else {
    navElement = (
      <div className={`${NAV_BASE} text-text-secondary`}>{navInner}</div>
    );
  }

  const wrapperState = disabled
    ? ""
    : active
      ? "bg-accent-soft"
      : "hover:bg-bg-card-hover";

  return (
    <div className={`${ROW_BASE} ${wrapperState}`}>
      {navElement}
      {showChevron && (
        <button
          type="button"
          onClick={onExpandToggle}
          aria-label={
            expanded ? `Свернуть «${label}»` : `Развернуть «${label}»`
          }
          aria-expanded={expanded}
          className="mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text-primary"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
}
