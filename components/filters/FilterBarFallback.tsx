/**
 * Server-rendered placeholder shown while the client `FilterBar` is
 * loading inside its Suspense boundary. We mirror the real bar's
 * height and dividers so the layout doesn't shift when the dynamic
 * subtree resolves.
 */
export function FilterBarFallback() {
  return (
    <div
      aria-hidden
      className="flex items-center gap-3 border-b border-border-primary bg-bg-card px-6 py-3"
    >
      <div className="h-8 w-[220px] rounded-md bg-skeleton" />
      <div className="h-8 w-[260px] rounded-md bg-skeleton" />
      <div className="h-8 w-[160px] rounded-md bg-skeleton" />
    </div>
  );
}
