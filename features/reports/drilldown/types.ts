/**
 * Drill-down types — shared by the API route, the level handlers and
 * the UI panel.
 *
 * Two layers:
 *
 * 1. **Wire shapes** (`DrilldownRequest`, `DrilldownResponse`,
 *    `DrilldownAggregateRow`, `DealRow`) — match the contract in
 *    `ai_docs/03_REPORT_ENGINE.md` ("Drill down API" section).
 *
 * 2. **UI helpers** (`DrilldownStackEntry`, `DrilldownLevel`,
 *    `DrilldownRowKey`) — used by the Zustand store and the panel
 *    components.
 */
import type { Period } from "@/lib/period/types";
import type {
  DimensionColumn,
  MetricColumn,
  MetricCell,
  ReportSlug,
  Row,
  DealScope,
} from "@/features/reports/engine/types";

/** Three logical levels the drill-down API can render. */
export type DrilldownLevel = "product-groups" | "managers" | "deals";

/**
 * The "row key" identifies which manager / product-group / pair the
 * caller is drilling into. Both ids are optional so the same shape
 * works for the manager-side, product-group-side and combined cases.
 */
export type DrilldownRowKey = {
  managerId?: number;
  productGroupId?: number;
};

/** Request body for `POST /api/reports/drilldown`. */
export type DrilldownRequest = {
  sectionSlug: "sales";
  reportSlug: ReportSlug;
  rowKey: DrilldownRowKey;
  period: Period;
  comparisonPeriod: Period;
  filters: { teamIds?: string[] };
  level: DrilldownLevel;
  /**
   * Report metric that opened the drill-down. Filters deal sets to match
   * the same rule as the main report (funnel split / stage event_type).
   */
  metricId?: string;
  /** Global primary / repeat / all filter from the main report toolbar. */
  dealScope?: DealScope;
  /** Default 100. Used only for `level === "deals"`. */
  limit?: number;
  /** Default 0. Used only for `level === "deals"`. */
  offset?: number;
};

/**
 * Aggregate row used at the `product-groups` and `managers` levels.
 * Mirrors the engine's `Row` shape (so the UI can re-use the same
 * column rendering primitives), but the metric set is fixed: just
 * the synthetic `deals_count` and `deals_amount` for v1.
 */
export type DrilldownAggregateRow = {
  key: string;
  dimension: Record<string, string | number | null>;
  metrics: Record<string, MetricCell>;
};

/**
 * A single deal row for `level === "deals"`. Shaped per the spec in
 * `03_REPORT_ENGINE.md` plus the joined `product_group_name`.
 */
export type DealRow = {
  dealId: number;
  dealName: string | null;
  amount: number;
  createdAt: string;
  stageId: string;
  stageName: string | null;
  managerId: number;
  teamId: number | null;
  productGroupId: number | null;
  productGroupName: string | null;
};

/** Discriminated wire response — one shape per level. */
export type DrilldownAggregateResponse = {
  ok: true;
  level: "product-groups" | "managers";
  columns: {
    dimension: DimensionColumn[];
    metrics: MetricColumn[];
  };
  rows: DrilldownAggregateRow[];
  meta: {
    period: Period;
    comparisonPeriod: Period;
    rowKey: DrilldownRowKey;
    reportSlug: ReportSlug;
  };
};

export type DrilldownDealsResponse = {
  ok: true;
  level: "deals";
  rows: DealRow[];
  total: number;
  limit: number;
  offset: number;
  meta: {
    period: Period;
    comparisonPeriod: Period;
    rowKey: DrilldownRowKey;
    reportSlug: ReportSlug;
  };
};

export type DrilldownErrorResponse = {
  ok: false;
  error: string;
  issues?: unknown;
};

export type DrilldownResponse =
  | DrilldownAggregateResponse
  | DrilldownDealsResponse
  | DrilldownErrorResponse;

/**
 * One entry on the panel's history stack — what to load and the user
 * facing breadcrumb label.
 */
export type DrilldownStackEntry = {
  level: DrilldownLevel;
  rowKey: DrilldownRowKey;
  /** Russian label rendered in the header / breadcrumbs. */
  label: string;
  /** Metric clicked in the main report table (when applicable). */
  metricId?: string;
  /** Human-readable metric name for the panel header. */
  metricLabel?: string;
};

/**
 * Convenience re-export so consumers in the UI layer can type prop
 * shapes without reaching into `engine/types`.
 */
export type { Row };
