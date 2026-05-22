"use client";

export type DrillDownRootTab = "products" | "deals";

type DrillDownRootTabsProps = {
  value: DrillDownRootTab;
  onChange: (value: DrillDownRootTab) => void;
};

const TABS: ReadonlyArray<{ id: DrillDownRootTab; label: string }> = [
  { id: "products", label: "Товары" },
  { id: "deals", label: "Сделки" },
];

/**
 * First-level view switch for `by-managers` drill-down: product-group
 * aggregates vs a flat deals list for the selected manager.
 */
export function DrillDownRootTabs({
  value,
  onChange,
}: DrillDownRootTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Вид детализации"
      className="flex items-center gap-2 border-b border-border-primary px-4 py-2"
    >
      {TABS.map((tab) => {
        const isActive = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              isActive
                ? "border border-border-primary bg-bg-card text-text-primary"
                : "border border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
