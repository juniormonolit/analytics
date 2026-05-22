-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE sa.daily_sales (
  id integer NOT NULL DEFAULT nextval('sa.daily_sales_id_seq'::regclass),
  report_date date NOT NULL,
  team_id integer NOT NULL,
  manager_id integer NOT NULL,
  incoming_deals_count integer NOT NULL DEFAULT 0,
  called_deals_count integer NOT NULL DEFAULT 0,
  reservations_count integer NOT NULL DEFAULT 0,
  primary_sales_count integer NOT NULL DEFAULT 0,
  primary_sales_amount numeric NOT NULL DEFAULT 0,
  repeat_sales_amount numeric NOT NULL DEFAULT 0,
  primary_shipments_count integer NOT NULL DEFAULT 0,
  primary_shipments_amount numeric NOT NULL DEFAULT 0,
  repeat_shipments_amount numeric NOT NULL DEFAULT 0,
  ppp_count integer NOT NULL DEFAULT 0,
  ppp_amount numeric NOT NULL DEFAULT 0,
  confirmed_reservations_count integer NOT NULL DEFAULT 0,
  repeat_sales_count integer NOT NULL DEFAULT 0,
  CONSTRAINT daily_sales_pkey PRIMARY KEY (id),
  CONSTRAINT daily_sales_team_id_fkey FOREIGN KEY (team_id) REFERENCES sa.teams(id),
  CONSTRAINT daily_sales_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES sa.employees(id)
);
CREATE TABLE sa.data_sources (
  id character varying NOT NULL,
  name_ru character varying NOT NULL,
  table_or_view character varying NOT NULL,
  available_dimensions jsonb NOT NULL,
  available_filters jsonb NOT NULL,
  date_column character varying,
  date_granularity character varying DEFAULT 'day'::character varying CHECK (date_granularity::text = ANY (ARRAY['day'::character varying, 'week'::character varying, 'month'::character varying]::text[])),
  label_joins jsonb DEFAULT '[]'::jsonb,
  refresh_interval character varying,
  is_auto_generated boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT data_sources_pkey PRIMARY KEY (id)
);
CREATE TABLE sa.deal_events (
  id integer NOT NULL DEFAULT nextval('sa.deal_events_id_seq'::regclass),
  deal_id integer NOT NULL,
  stage_id text NOT NULL,
  event_at timestamp with time zone NOT NULL DEFAULT now(),
  manager_id integer NOT NULL,
  amount_at_event numeric,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT deal_events_pkey PRIMARY KEY (id),
  CONSTRAINT deal_events_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES sa.deals(deal_id),
  CONSTRAINT deal_events_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES sa.stages(id)
);
CREATE TABLE sa.deals (
  deal_id integer NOT NULL,
  deal_name character varying,
  deal_type character varying NOT NULL,
  stage_id text NOT NULL,
  amount numeric NOT NULL,
  funnel_id integer NOT NULL,
  product_group_id integer,
  is_reserved boolean NOT NULL DEFAULT false,
  current_manager_id integer NOT NULL,
  manager_history text,
  team_id integer,
  expected_close_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  lead_id integer,
  contact_id integer,
  company_id integer,
  CONSTRAINT deals_pkey PRIMARY KEY (deal_id),
  CONSTRAINT deals_funnel_id_fkey FOREIGN KEY (funnel_id) REFERENCES sa.funnels(id),
  CONSTRAINT deals_product_group_id_fkey FOREIGN KEY (product_group_id) REFERENCES sa.product_groups(id),
  CONSTRAINT deals_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES sa.stages(id)
);
CREATE TABLE sa.employees (
  id integer NOT NULL DEFAULT nextval('sa.employees_id_seq'::regclass),
  full_name character varying NOT NULL,
  team_id integer NOT NULL,
  hire_date date,
  role character varying NOT NULL DEFAULT 'manager'::character varying CHECK (role::text = ANY (ARRAY['director'::character varying, 'rop'::character varying, 'manager'::character varying]::text[])),
  bitrix_id integer UNIQUE,
  supabase_uid uuid UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT employees_pkey PRIMARY KEY (id)
);
CREATE TABLE sa.funnels (
  id integer NOT NULL DEFAULT nextval('sa.funnels_id_seq'::regclass),
  name character varying NOT NULL,
  is_repeat boolean NOT NULL DEFAULT false,
  CONSTRAINT funnels_pkey PRIMARY KEY (id)
);
CREATE TABLE sa.import_history (
  id integer NOT NULL DEFAULT nextval('sa.import_history_id_seq'::regclass),
  filename character varying NOT NULL,
  file_size integer,
  rows_total integer NOT NULL DEFAULT 0,
  rows_imported integer NOT NULL DEFAULT 0,
  rows_updated integer NOT NULL DEFAULT 0,
  rows_errors integer NOT NULL DEFAULT 0,
  error_details jsonb,
  status character varying NOT NULL DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying]::text[])),
  imported_by integer,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  CONSTRAINT import_history_pkey PRIMARY KEY (id),
  CONSTRAINT import_history_imported_by_fkey FOREIGN KEY (imported_by) REFERENCES sa.employees(id)
);
CREATE TABLE sa.metrics (
  id character varying NOT NULL,
  name_ru character varying NOT NULL,
  name_short_ru character varying,
  metric_type character varying NOT NULL CHECK (metric_type::text = ANY (ARRAY['collected'::character varying, 'calculated'::character varying, 'external'::character varying]::text[])),
  data_type character varying NOT NULL CHECK (data_type::text = ANY (ARRAY['int'::character varying, 'decimal'::character varying, 'percent'::character varying, 'money'::character varying, 'months'::character varying]::text[])),
  aggregation jsonb,
  source character varying,
  source_column character varying,
  formula text,
  dependencies ARRAY,
  decimal_places integer DEFAULT 0,
  color_rules jsonb DEFAULT '[]'::jsonb,
  aggregation_fn character varying DEFAULT 'sum'::character varying CHECK (aggregation_fn::text = ANY (ARRAY['sum'::character varying, 'avg'::character varying, 'none'::character varying]::text[])),
  category character varying,
  sort_order integer DEFAULT 0,
  is_core boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT metrics_pkey PRIMARY KEY (id)
);
CREATE TABLE sa.permissions (
  id integer NOT NULL DEFAULT nextval('sa.permissions_id_seq'::regclass),
  permission_key character varying NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT permissions_pkey PRIMARY KEY (id)
);
CREATE TABLE sa.product_groups (
  id integer NOT NULL DEFAULT nextval('sa.product_groups_id_seq'::regclass),
  name character varying NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT product_groups_pkey PRIMARY KEY (id)
);
CREATE TABLE sa.report_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug character varying NOT NULL UNIQUE,
  name_ru character varying NOT NULL,
  icon character varying DEFAULT 'BarChart3'::character varying,
  metric_ids ARRAY NOT NULL,
  group_by ARRAY NOT NULL,
  label_columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  primary_source character varying NOT NULL,
  joins jsonb DEFAULT '[]'::jsonb,
  comparison_mode character varying DEFAULT 'single'::character varying CHECK (comparison_mode::text = ANY (ARRAY['single'::character varying, 'dual'::character varying, 'triple'::character varying]::text[])),
  comparison_labels jsonb,
  available_filters ARRAY DEFAULT ARRAY['date_range'::text, 'team_id'::text],
  default_filters jsonb DEFAULT '{}'::jsonb,
  default_sort_by character varying,
  default_sort_dir character varying DEFAULT 'desc'::character varying CHECK (default_sort_dir::text = ANY (ARRAY['asc'::character varying, 'desc'::character varying]::text[])),
  allowed_roles ARRAY DEFAULT ARRAY['director'::text, 'rop'::text, 'manager'::text],
  role_scoping jsonb DEFAULT '{}'::jsonb,
  show_totals_row boolean DEFAULT true,
  summary_row jsonb,
  sticky_columns integer DEFAULT 1,
  is_system boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT report_configs_pkey PRIMARY KEY (id)
);
CREATE TABLE sa.role_permissions (
  id integer NOT NULL DEFAULT nextval('sa.role_permissions_id_seq'::regclass),
  sa_role character varying NOT NULL CHECK (sa_role::text = ANY (ARRAY['director'::character varying, 'rop'::character varying, 'manager'::character varying]::text[])),
  permission_key character varying NOT NULL,
  scope character varying DEFAULT NULL::character varying CHECK (scope IS NULL OR (scope::text = ANY (ARRAY['all'::character varying, 'team'::character varying, 'own'::character varying]::text[]))),
  CONSTRAINT role_permissions_pkey PRIMARY KEY (id),
  CONSTRAINT role_permissions_permission_key_fkey FOREIGN KEY (permission_key) REFERENCES sa.permissions(permission_key)
);
CREATE TABLE sa.sales_plans (
  id integer NOT NULL DEFAULT nextval('sa.sales_plans_id_seq'::regclass),
  manager_id integer NOT NULL,
  period date NOT NULL,
  sales_plan numeric NOT NULL DEFAULT 0,
  shipments_plan numeric NOT NULL DEFAULT 0,
  updated_by integer,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sales_plans_pkey PRIMARY KEY (id),
  CONSTRAINT sales_plans_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES sa.employees(id),
  CONSTRAINT sales_plans_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES sa.employees(id)
);
CREATE TABLE sa.stages (
  id text NOT NULL,
  funnel_id integer NOT NULL,
  name character varying NOT NULL,
  event_type character varying NOT NULL CHECK (event_type::text = ANY (ARRAY['created'::character varying, 'called'::character varying, 'reserved'::character varying, 'confirmed'::character varying, 'sold'::character varying, 'shipped'::character varying, 'lost'::character varying]::text[])),
  sort_order integer NOT NULL DEFAULT 0,
  stage_type character varying,
  stage_color text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT stages_pkey PRIMARY KEY (id),
  CONSTRAINT stages_funnel_id_fkey FOREIGN KEY (funnel_id) REFERENCES sa.funnels(id)
);
CREATE TABLE sa.teams (
  id integer NOT NULL DEFAULT nextval('sa.teams_id_seq'::regclass),
  name character varying NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT teams_pkey PRIMARY KEY (id)
);