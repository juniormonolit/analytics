/**
 * Animated skeleton shown while a report is loading. Renders as a
 * grid of pulsing blocks sized to roughly match the eventual table.
 */
const ROW_COUNT = 8;
const COL_COUNT = 6;

export function TableSkeleton() {
  return (
    <div
      className="flex h-full flex-col gap-2 rounded-md border border-table-border bg-table-bg p-3"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex gap-2">
        {Array.from({ length: COL_COUNT }).map((_, i) => (
          <div
            key={`skeleton-h-${i}`}
            className="h-6 flex-1 animate-pulse rounded bg-skeleton"
          />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: ROW_COUNT }).map((_, i) => (
          <div key={`skeleton-r-${i}`} className="flex gap-2">
            {Array.from({ length: COL_COUNT }).map((_, j) => (
              <div
                key={`skeleton-c-${i}-${j}`}
                className="h-5 flex-1 animate-pulse rounded bg-skeleton"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
