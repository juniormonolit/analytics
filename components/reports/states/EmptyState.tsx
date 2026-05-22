/**
 * Shown when the report engine returns zero rows for the active
 * filters. Pure presentational — no retry button (changing filters is
 * the path forward, not a refresh).
 */
import { Inbox } from "lucide-react";

export function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-md border border-table-border bg-table-bg p-12 text-center">
      <Inbox
        className="h-10 w-10 text-text-muted"
        aria-hidden
      />
      <p className="text-sm font-medium text-text-primary">
        Нет данных за выбранный период
      </p>
      <p className="text-xs text-text-secondary">
        Измените период или фильтры отделов.
      </p>
    </div>
  );
}
