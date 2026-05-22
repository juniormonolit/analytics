/**
 * Shown when `/api/reports/run` errors out (network, validation,
 * server). Includes a retry button wired to the parent's refetch.
 */
import { AlertTriangle, RefreshCw } from "lucide-react";

type ErrorStateProps = {
  message?: string | null;
  onRetry?: () => void;
};

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-md border border-danger-border bg-danger-bg p-12 text-center">
      <AlertTriangle
        className="h-10 w-10 text-danger"
        aria-hidden
      />
      <p className="text-sm font-medium text-text-primary">
        Не удалось загрузить отчет
      </p>
      {message ? (
        <p className="max-w-md text-xs text-text-secondary">{message}</p>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-md bg-accent-primary px-3 py-1.5 text-sm text-text-on-accent transition-colors hover:bg-accent-hover"
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Попробовать снова
        </button>
      ) : null}
    </div>
  );
}
