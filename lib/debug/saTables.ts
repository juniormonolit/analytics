import type { Database } from "@/lib/supabase/types.generated";

export type SaDebugTableName = keyof Database["sa"]["Tables"];

export type DebugColumnMeta = {
  name: string;
  dataType: string;
  isNullable: boolean;
};

export type SaDebugTableMeta = {
  tableName: SaDebugTableName;
  defaultSortColumn: string;
  columns: DebugColumnMeta[];
};

/** Read-only tables exposed in /settings debug UI. */
export const SA_DEBUG_TABLE_NAMES = [
  "deals",
  "deal_events",
  "daily_sales",
  "employees",
  "teams",
  "product_groups",
  "metrics",
  "stages",
  "funnels",
  "report_configs",
  "import_history",
  "permissions",
  "role_permissions",
  "sales_plans",
  "data_sources",
] as const satisfies readonly SaDebugTableName[];

const SA_DEBUG_TABLE_SET = new Set<string>(SA_DEBUG_TABLE_NAMES);

export function isSaDebugTableName(value: string): value is SaDebugTableName {
  return SA_DEBUG_TABLE_SET.has(value);
}

function col(
  name: string,
  dataType: string,
  isNullable = false,
): DebugColumnMeta {
  return { name, dataType, isNullable };
}

/** Column metadata sourced from `lib/supabase/types.generated.ts`. */
export const SA_DEBUG_TABLES: Record<SaDebugTableName, SaDebugTableMeta> = {
  deals: {
    tableName: "deals",
    defaultSortColumn: "created_at",
    columns: [
      col("deal_id", "number"),
      col("deal_name", "string", true),
      col("deal_type", "string"),
      col("stage_id", "string"),
      col("amount", "number"),
      col("funnel_id", "number"),
      col("product_group_id", "number", true),
      col("is_reserved", "boolean"),
      col("current_manager_id", "number"),
      col("manager_history", "string", true),
      col("team_id", "number", true),
      col("expected_close_date", "date", true),
      col("created_at", "timestamp"),
      col("updated_at", "timestamp"),
      col("lead_id", "number", true),
      col("contact_id", "number", true),
      col("company_id", "number", true),
      col("reserved_at", "timestamp", true),
      col("confirmed_at", "timestamp", true),
      col("sold_at", "timestamp", true),
      col("delivered_at", "timestamp", true),
      col("lost_at", "timestamp", true),
    ],
  },
  deal_events: {
    tableName: "deal_events",
    defaultSortColumn: "event_at",
    columns: [
      col("id", "number"),
      col("deal_id", "number"),
      col("stage_id", "string"),
      col("event_at", "timestamp"),
      col("manager_id", "number"),
      col("amount_at_event", "number", true),
      col("recorded_at", "timestamp"),
    ],
  },
  daily_sales: {
    tableName: "daily_sales",
    defaultSortColumn: "report_date",
    columns: [
      col("id", "number"),
      col("report_date", "date"),
      col("team_id", "number"),
      col("manager_id", "number"),
      col("incoming_deals_count", "number"),
      col("called_deals_count", "number"),
      col("reservations_count", "number"),
      col("primary_sales_count", "number"),
      col("primary_sales_amount", "number"),
      col("repeat_sales_amount", "number"),
      col("primary_shipments_count", "number"),
      col("primary_shipments_amount", "number"),
      col("repeat_shipments_amount", "number"),
      col("ppp_count", "number"),
      col("ppp_amount", "number"),
      col("confirmed_reservations_count", "number"),
      col("repeat_sales_count", "number"),
    ],
  },
  employees: {
    tableName: "employees",
    defaultSortColumn: "full_name",
    columns: [
      col("id", "number"),
      col("full_name", "string"),
      col("team_id", "number"),
      col("hire_date", "date", true),
      col("role", "string"),
      col("bitrix_id", "number", true),
      col("supabase_uid", "string", true),
      col("is_active", "boolean"),
    ],
  },
  teams: {
    tableName: "teams",
    defaultSortColumn: "name",
    columns: [
      col("id", "number"),
      col("name", "string"),
      col("is_active", "boolean"),
      col("parent_id", "number", true),
      col("head_id", "number", true),
    ],
  },
  product_groups: {
    tableName: "product_groups",
    defaultSortColumn: "name",
    columns: [
      col("id", "number"),
      col("name", "string"),
      col("is_active", "boolean"),
    ],
  },
  metrics: {
    tableName: "metrics",
    defaultSortColumn: "sort_order",
    columns: [
      col("id", "string"),
      col("name_ru", "string"),
      col("name_short_ru", "string", true),
      col("metric_type", "string"),
      col("data_type", "string"),
      col("aggregation", "json", true),
      col("source", "string", true),
      col("source_column", "string", true),
      col("formula", "string", true),
      col("dependencies", "string[]", true),
      col("decimal_places", "number", true),
      col("color_rules", "json", true),
      col("aggregation_fn", "string", true),
      col("category", "string", true),
      col("sort_order", "number", true),
      col("is_core", "boolean", true),
      col("is_active", "boolean", true),
      col("created_at", "timestamp", true),
    ],
  },
  report_configs: {
    tableName: "report_configs",
    defaultSortColumn: "sort_order",
    columns: [
      col("id", "string"),
      col("slug", "string"),
      col("name_ru", "string"),
      col("icon", "string", true),
      col("metric_ids", "string[]"),
      col("group_by", "string[]"),
      col("label_columns", "json"),
      col("primary_source", "string"),
      col("joins", "json", true),
      col("comparison_mode", "string", true),
      col("comparison_labels", "json", true),
      col("available_filters", "string[]", true),
      col("default_filters", "json", true),
      col("default_sort_by", "string", true),
      col("default_sort_dir", "string", true),
      col("allowed_roles", "string[]", true),
      col("role_scoping", "json", true),
      col("show_totals_row", "boolean", true),
      col("summary_row", "json", true),
      col("sticky_columns", "number", true),
      col("is_system", "boolean", true),
      col("sort_order", "number", true),
      col("created_at", "timestamp", true),
    ],
  },
  stages: {
    tableName: "stages",
    defaultSortColumn: "sort_order",
    columns: [
      col("id", "string"),
      col("funnel_id", "number"),
      col("name", "string"),
      col("event_type", "string"),
      col("sort_order", "number"),
      col("stage_type", "string", true),
      col("stage_color", "string", true),
      col("created_at", "timestamp", true),
    ],
  },
  funnels: {
    tableName: "funnels",
    defaultSortColumn: "name",
    columns: [
      col("id", "number"),
      col("name", "string"),
      col("is_repeat", "boolean"),
    ],
  },
  data_sources: {
    tableName: "data_sources",
    defaultSortColumn: "id",
    columns: [
      col("id", "string"),
      col("name_ru", "string"),
      col("table_or_view", "string"),
      col("available_dimensions", "json"),
      col("available_filters", "json"),
      col("date_column", "string", true),
      col("date_granularity", "string", true),
      col("label_joins", "json", true),
      col("refresh_interval", "string", true),
      col("is_auto_generated", "boolean", true),
      col("is_active", "boolean", true),
      col("created_at", "timestamp", true),
    ],
  },
  import_history: {
    tableName: "import_history",
    defaultSortColumn: "started_at",
    columns: [
      col("id", "number"),
      col("filename", "string"),
      col("file_size", "number", true),
      col("rows_total", "number"),
      col("rows_imported", "number"),
      col("rows_updated", "number"),
      col("rows_errors", "number"),
      col("error_details", "json", true),
      col("status", "string"),
      col("imported_by", "number", true),
      col("started_at", "timestamp"),
      col("completed_at", "timestamp", true),
    ],
  },
  permissions: {
    tableName: "permissions",
    defaultSortColumn: "permission_key",
    columns: [
      col("id", "number"),
      col("permission_key", "string"),
      col("description", "string", true),
      col("created_at", "timestamp", true),
    ],
  },
  role_permissions: {
    tableName: "role_permissions",
    defaultSortColumn: "sa_role",
    columns: [
      col("id", "number"),
      col("sa_role", "string"),
      col("permission_key", "string"),
      col("scope", "string", true),
    ],
  },
  sales_plans: {
    tableName: "sales_plans",
    defaultSortColumn: "period",
    columns: [
      col("id", "number"),
      col("manager_id", "number"),
      col("period", "date"),
      col("sales_plan", "number"),
      col("shipments_plan", "number"),
      col("updated_by", "number", true),
      col("updated_at", "timestamp"),
    ],
  },
};

export function getSaDebugTableMeta(
  tableName: SaDebugTableName,
): SaDebugTableMeta {
  return SA_DEBUG_TABLES[tableName];
}

export function isSortableColumn(
  tableName: SaDebugTableName,
  columnName: string,
): boolean {
  return getSaDebugTableMeta(tableName).columns.some((c) => c.name === columnName);
}

export function parseSortParam(
  sort: string | null | undefined,
  tableName: SaDebugTableName,
): { column: string; ascending: boolean } {
  const fallback = getSaDebugTableMeta(tableName).defaultSortColumn;
  if (!sort) {
    return { column: fallback, ascending: false };
  }
  const [column, direction] = sort.split(".");
  if (!column || !isSortableColumn(tableName, column)) {
    return { column: fallback, ascending: false };
  }
  return { column, ascending: direction !== "desc" };
}

/** Maps metric `source` values to debug table names when applicable. */
export function sourceToDebugTable(
  source: string | null | undefined,
): SaDebugTableName | null {
  if (!source) return null;
  const normalized = source.trim().toLowerCase();
  if (isSaDebugTableName(normalized)) return normalized;
  if (normalized === "mv_daily_summary") return "daily_sales";
  return null;
}
