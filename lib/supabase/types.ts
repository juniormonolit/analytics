/**
 * Curated, ergonomic re-exports of the most-used row types from the
 * generated Supabase schema. Application code should prefer these aliases
 * over reaching into `Database["sa"]["Tables"][...]["Row"]` directly.
 */
import type { Database } from "./types.generated";

export type SaSchema = Database["sa"];

/**
 * Looks up the `Row` type for a given `sa.*` table.
 *
 * @example
 *   type Deal = Tables<"deals">;
 */
export type Tables<T extends keyof SaSchema["Tables"]> =
  SaSchema["Tables"][T]["Row"];

/**
 * Looks up the `Insert` payload type for a given `sa.*` table.
 */
export type TablesInsert<T extends keyof SaSchema["Tables"]> =
  SaSchema["Tables"][T]["Insert"];

/**
 * Looks up the `Update` payload type for a given `sa.*` table.
 */
export type TablesUpdate<T extends keyof SaSchema["Tables"]> =
  SaSchema["Tables"][T]["Update"];

export type Deal = Tables<"deals">;
export type DealEvent = Tables<"deal_events">;
export type Team = Tables<"teams">;
export type Employee = Tables<"employees">;
export type ProductGroup = Tables<"product_groups">;
export type Metric = Tables<"metrics">;
export type ReportConfig = Tables<"report_configs">;
export type Stage = Tables<"stages">;
export type Funnel = Tables<"funnels">;
export type DailySales = Tables<"daily_sales">;

export type { Database, Json } from "./types.generated";
