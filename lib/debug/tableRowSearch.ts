import type { DebugColumnMeta } from "@/lib/debug/saTables";

/** Escape a value for PostgREST `.or()` filter strings. */
export function escapePostgrestFilterValue(value: string): string {
  if (/[,.()]/.test(value) || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Returns an ISO date/time string when the term looks like a date search. */
export function normalizeDateSearchTerm(term: string): string | null {
  const trimmed = term.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return trimmed;
  return null;
}

/**
 * Builds a PostgREST `.or()` filter that matches `searchTerm` against all
 * searchable columns (strings via ilike, numbers/booleans via eq, dates via eq).
 */
export function buildTableRowSearchOrFilter(
  columns: DebugColumnMeta[],
  searchTerm: string,
): string | null {
  const term = searchTerm.trim();
  if (!term) return null;

  const likePattern = escapePostgrestFilterValue(`%${term}%`);
  const dateValue = normalizeDateSearchTerm(term);
  const parts: string[] = [];

  for (const column of columns) {
    switch (column.dataType) {
      case "string":
      case "string[]":
        parts.push(`${column.name}.ilike.${likePattern}`);
        break;
      case "number": {
        const num = Number(term);
        if (Number.isFinite(num)) {
          parts.push(`${column.name}.eq.${num}`);
        }
        break;
      }
      case "boolean": {
        const normalized = term.toLowerCase();
        if (normalized === "true" || normalized === "false") {
          parts.push(`${column.name}.eq.${normalized}`);
        }
        break;
      }
      case "date":
      case "timestamp": {
        if (dateValue) {
          parts.push(
            `${column.name}.eq.${escapePostgrestFilterValue(dateValue)}`,
          );
        }
        break;
      }
      default:
        break;
    }
  }

  return parts.length > 0 ? parts.join(",") : null;
}
