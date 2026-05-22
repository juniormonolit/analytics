/**
 * Hand-rolled Database type for Supabase schema `sa`.
 *
 * NOTE: The file is named `types.generated.ts` to match the upstream
 * convention used by `supabase gen types typescript`. For now we author it
 * by hand from `database/schema.md`; a future task can replace this file
 * with the output of the official Supabase CLI without changing any
 * downstream imports.
 *
 * Conventions used here:
 * - `integer` / `bigint` / `numeric` → `number`
 * - `text` / `character varying` / `uuid` → `string`
 * - `timestamp with time zone` / `date` → `string`
 * - `jsonb` → `Json`
 * - Postgres `ARRAY` columns → `string[]` (all current array columns are
 *   text arrays per the schema)
 * - Columns marked `NOT NULL` are required and non-nullable in `Row`.
 * - `Insert` mirrors `Row`, but columns with a `DEFAULT` (or columns that
 *   are nullable) are optional.
 * - `Update` makes everything optional and accepts `null` where the column
 *   is nullable.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  sa: {
    Tables: {
      deals: {
        Row: {
          deal_id: number;
          deal_name: string | null;
          deal_type: string;
          stage_id: string;
          amount: number;
          funnel_id: number;
          product_group_id: number | null;
          is_reserved: boolean;
          current_manager_id: number;
          manager_history: string | null;
          team_id: number | null;
          expected_close_date: string | null;
          created_at: string;
          updated_at: string;
          lead_id: number | null;
          contact_id: number | null;
          company_id: number | null;
          reserved_at: string | null;
          confirmed_at: string | null;
          sold_at: string | null;
          delivered_at: string | null;
          lost_at: string | null;
        };
        Insert: {
          deal_id: number;
          deal_name?: string | null;
          deal_type: string;
          stage_id: string;
          amount: number;
          funnel_id: number;
          product_group_id?: number | null;
          is_reserved?: boolean;
          current_manager_id: number;
          manager_history?: string | null;
          team_id?: number | null;
          expected_close_date?: string | null;
          created_at?: string;
          updated_at?: string;
          lead_id?: number | null;
          contact_id?: number | null;
          company_id?: number | null;
          reserved_at?: string | null;
          confirmed_at?: string | null;
          sold_at?: string | null;
          delivered_at?: string | null;
          lost_at?: string | null;
        };
        Update: {
          deal_id?: number;
          deal_name?: string | null;
          deal_type?: string;
          stage_id?: string;
          amount?: number;
          funnel_id?: number;
          product_group_id?: number | null;
          is_reserved?: boolean;
          current_manager_id?: number;
          manager_history?: string | null;
          team_id?: number | null;
          expected_close_date?: string | null;
          created_at?: string;
          updated_at?: string;
          lead_id?: number | null;
          contact_id?: number | null;
          company_id?: number | null;
          reserved_at?: string | null;
          confirmed_at?: string | null;
          sold_at?: string | null;
          delivered_at?: string | null;
          lost_at?: string | null;
        };
      };

      deal_events: {
        Row: {
          id: number;
          deal_id: number;
          stage_id: string;
          event_at: string;
          manager_id: number;
          amount_at_event: number | null;
          recorded_at: string;
        };
        Insert: {
          id?: number;
          deal_id: number;
          stage_id: string;
          event_at?: string;
          manager_id: number;
          amount_at_event?: number | null;
          recorded_at?: string;
        };
        Update: {
          id?: number;
          deal_id?: number;
          stage_id?: string;
          event_at?: string;
          manager_id?: number;
          amount_at_event?: number | null;
          recorded_at?: string;
        };
      };

      teams: {
        Row: {
          id: number;
          name: string;
          is_active: boolean;
          parent_id: number | null;
          head_id: number | null;
        };
        Insert: {
          id?: number;
          name: string;
          is_active?: boolean;
          parent_id?: number | null;
          head_id?: number | null;
        };
        Update: {
          id?: number;
          name?: string;
          is_active?: boolean;
          parent_id?: number | null;
          head_id?: number | null;
        };
      };

      employees: {
        Row: {
          id: number;
          full_name: string;
          team_id: number;
          hire_date: string | null;
          role: string;
          bitrix_id: number | null;
          supabase_uid: string | null;
          is_active: boolean;
        };
        Insert: {
          id?: number;
          full_name: string;
          team_id: number;
          hire_date?: string | null;
          role?: string;
          bitrix_id?: number | null;
          supabase_uid?: string | null;
          is_active?: boolean;
        };
        Update: {
          id?: number;
          full_name?: string;
          team_id?: number;
          hire_date?: string | null;
          role?: string;
          bitrix_id?: number | null;
          supabase_uid?: string | null;
          is_active?: boolean;
        };
      };

      product_groups: {
        Row: {
          id: number;
          name: string;
          is_active: boolean;
        };
        Insert: {
          id?: number;
          name: string;
          is_active?: boolean;
        };
        Update: {
          id?: number;
          name?: string;
          is_active?: boolean;
        };
      };

      metrics: {
        Row: {
          id: string;
          name_ru: string;
          name_short_ru: string | null;
          metric_type: string;
          data_type: string;
          aggregation: Json | null;
          source: string | null;
          source_column: string | null;
          formula: string | null;
          dependencies: string[] | null;
          decimal_places: number | null;
          color_rules: Json | null;
          aggregation_fn: string | null;
          category: string | null;
          sort_order: number | null;
          is_core: boolean | null;
          is_active: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          name_ru: string;
          name_short_ru?: string | null;
          metric_type: string;
          data_type: string;
          aggregation?: Json | null;
          source?: string | null;
          source_column?: string | null;
          formula?: string | null;
          dependencies?: string[] | null;
          decimal_places?: number | null;
          color_rules?: Json | null;
          aggregation_fn?: string | null;
          category?: string | null;
          sort_order?: number | null;
          is_core?: boolean | null;
          is_active?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name_ru?: string;
          name_short_ru?: string | null;
          metric_type?: string;
          data_type?: string;
          aggregation?: Json | null;
          source?: string | null;
          source_column?: string | null;
          formula?: string | null;
          dependencies?: string[] | null;
          decimal_places?: number | null;
          color_rules?: Json | null;
          aggregation_fn?: string | null;
          category?: string | null;
          sort_order?: number | null;
          is_core?: boolean | null;
          is_active?: boolean | null;
          created_at?: string | null;
        };
      };

      report_configs: {
        Row: {
          id: string;
          slug: string;
          name_ru: string;
          icon: string | null;
          metric_ids: string[];
          group_by: string[];
          label_columns: Json;
          primary_source: string;
          joins: Json | null;
          comparison_mode: string | null;
          comparison_labels: Json | null;
          available_filters: string[] | null;
          default_filters: Json | null;
          default_sort_by: string | null;
          default_sort_dir: string | null;
          allowed_roles: string[] | null;
          role_scoping: Json | null;
          show_totals_row: boolean | null;
          summary_row: Json | null;
          sticky_columns: number | null;
          is_system: boolean | null;
          sort_order: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          slug: string;
          name_ru: string;
          icon?: string | null;
          metric_ids: string[];
          group_by: string[];
          label_columns?: Json;
          primary_source: string;
          joins?: Json | null;
          comparison_mode?: string | null;
          comparison_labels?: Json | null;
          available_filters?: string[] | null;
          default_filters?: Json | null;
          default_sort_by?: string | null;
          default_sort_dir?: string | null;
          allowed_roles?: string[] | null;
          role_scoping?: Json | null;
          show_totals_row?: boolean | null;
          summary_row?: Json | null;
          sticky_columns?: number | null;
          is_system?: boolean | null;
          sort_order?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          slug?: string;
          name_ru?: string;
          icon?: string | null;
          metric_ids?: string[];
          group_by?: string[];
          label_columns?: Json;
          primary_source?: string;
          joins?: Json | null;
          comparison_mode?: string | null;
          comparison_labels?: Json | null;
          available_filters?: string[] | null;
          default_filters?: Json | null;
          default_sort_by?: string | null;
          default_sort_dir?: string | null;
          allowed_roles?: string[] | null;
          role_scoping?: Json | null;
          show_totals_row?: boolean | null;
          summary_row?: Json | null;
          sticky_columns?: number | null;
          is_system?: boolean | null;
          sort_order?: number | null;
          created_at?: string | null;
        };
      };

      stages: {
        Row: {
          id: string;
          funnel_id: number;
          name: string;
          event_type: string;
          sort_order: number;
          stage_type: string | null;
          stage_color: string | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          funnel_id: number;
          name: string;
          event_type: string;
          sort_order?: number;
          stage_type?: string | null;
          stage_color?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          funnel_id?: number;
          name?: string;
          event_type?: string;
          sort_order?: number;
          stage_type?: string | null;
          stage_color?: string | null;
          created_at?: string | null;
        };
      };

      funnels: {
        Row: {
          id: number;
          name: string;
          is_repeat: boolean;
        };
        Insert: {
          id?: number;
          name: string;
          is_repeat?: boolean;
        };
        Update: {
          id?: number;
          name?: string;
          is_repeat?: boolean;
        };
      };

      daily_sales: {
        Row: {
          id: number;
          report_date: string;
          team_id: number;
          manager_id: number;
          incoming_deals_count: number;
          called_deals_count: number;
          reservations_count: number;
          primary_sales_count: number;
          primary_sales_amount: number;
          repeat_sales_amount: number;
          primary_shipments_count: number;
          primary_shipments_amount: number;
          repeat_shipments_amount: number;
          ppp_count: number;
          ppp_amount: number;
          confirmed_reservations_count: number;
          repeat_sales_count: number;
        };
        Insert: {
          id?: number;
          report_date: string;
          team_id: number;
          manager_id: number;
          incoming_deals_count?: number;
          called_deals_count?: number;
          reservations_count?: number;
          primary_sales_count?: number;
          primary_sales_amount?: number;
          repeat_sales_amount?: number;
          primary_shipments_count?: number;
          primary_shipments_amount?: number;
          repeat_shipments_amount?: number;
          ppp_count?: number;
          ppp_amount?: number;
          confirmed_reservations_count?: number;
          repeat_sales_count?: number;
        };
        Update: {
          id?: number;
          report_date?: string;
          team_id?: number;
          manager_id?: number;
          incoming_deals_count?: number;
          called_deals_count?: number;
          reservations_count?: number;
          primary_sales_count?: number;
          primary_sales_amount?: number;
          repeat_sales_amount?: number;
          primary_shipments_count?: number;
          primary_shipments_amount?: number;
          repeat_shipments_amount?: number;
          ppp_count?: number;
          ppp_amount?: number;
          confirmed_reservations_count?: number;
          repeat_sales_count?: number;
        };
      };

      data_sources: {
        Row: {
          id: string;
          name_ru: string;
          table_or_view: string;
          available_dimensions: Json;
          available_filters: Json;
          date_column: string | null;
          date_granularity: string | null;
          label_joins: Json | null;
          refresh_interval: string | null;
          is_auto_generated: boolean | null;
          is_active: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          name_ru: string;
          table_or_view: string;
          available_dimensions: Json;
          available_filters: Json;
          date_column?: string | null;
          date_granularity?: string | null;
          label_joins?: Json | null;
          refresh_interval?: string | null;
          is_auto_generated?: boolean | null;
          is_active?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name_ru?: string;
          table_or_view?: string;
          available_dimensions?: Json;
          available_filters?: Json;
          date_column?: string | null;
          date_granularity?: string | null;
          label_joins?: Json | null;
          refresh_interval?: string | null;
          is_auto_generated?: boolean | null;
          is_active?: boolean | null;
          created_at?: string | null;
        };
      };

      import_history: {
        Row: {
          id: number;
          filename: string;
          file_size: number | null;
          rows_total: number;
          rows_imported: number;
          rows_updated: number;
          rows_errors: number;
          error_details: Json | null;
          status: string;
          imported_by: number | null;
          started_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: number;
          filename: string;
          file_size?: number | null;
          rows_total?: number;
          rows_imported?: number;
          rows_updated?: number;
          rows_errors?: number;
          error_details?: Json | null;
          status?: string;
          imported_by?: number | null;
          started_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: number;
          filename?: string;
          file_size?: number | null;
          rows_total?: number;
          rows_imported?: number;
          rows_updated?: number;
          rows_errors?: number;
          error_details?: Json | null;
          status?: string;
          imported_by?: number | null;
          started_at?: string;
          completed_at?: string | null;
        };
      };

      permissions: {
        Row: {
          id: number;
          permission_key: string;
          description: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: number;
          permission_key: string;
          description?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          permission_key?: string;
          description?: string | null;
          created_at?: string | null;
        };
      };

      role_permissions: {
        Row: {
          id: number;
          sa_role: string;
          permission_key: string;
          scope: string | null;
        };
        Insert: {
          id?: number;
          sa_role: string;
          permission_key: string;
          scope?: string | null;
        };
        Update: {
          id?: number;
          sa_role?: string;
          permission_key?: string;
          scope?: string | null;
        };
      };

      sales_plans: {
        Row: {
          id: number;
          manager_id: number;
          period: string;
          sales_plan: number;
          shipments_plan: number;
          updated_by: number | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          manager_id: number;
          period: string;
          sales_plan?: number;
          shipments_plan?: number;
          updated_by?: number | null;
          updated_at?: string;
        };
        Update: {
          id?: number;
          manager_id?: number;
          period?: string;
          sales_plan?: number;
          shipments_plan?: number;
          updated_by?: number | null;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
