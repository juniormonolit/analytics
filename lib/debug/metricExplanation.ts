import type { Metric } from "@/lib/supabase/types";

import { sourceToDebugTable } from "./saTables";

export type DebugMetricRow = Pick<
  Metric,
  | "id"
  | "name_ru"
  | "name_short_ru"
  | "metric_type"
  | "data_type"
  | "aggregation_fn"
  | "source"
  | "source_column"
  | "formula"
  | "dependencies"
  | "category"
  | "is_core"
  | "is_active"
  | "sort_order"
>;

export type MetricEngineExplanation = {
  summary: string;
  sqlExplanation: string;
  relatedTable: ReturnType<typeof sourceToDebugTable>;
};

function dailySalesSum(sourceColumn: string): string {
  return `-- collected metric from sa.daily_sales
select sum(${sourceColumn}) as value
from sa.daily_sales
where report_date between :from and :to
  -- optional: and manager_id = :bitrix_user_id
  -- optional: and team_id = :team_id`;
}

function dealsCountSql(): string {
  return `-- deals_count-style metric from sa.deals
select count(*) as value
from sa.deals
where created_at >= :from
  and created_at < :to_plus_1_day
  -- optional: and team_id in (:team_ids)`;
}

function dealsAmountSql(): string {
  return `-- deals_amount-style metric from sa.deals
select sum(amount) as value
from sa.deals
where created_at >= :from
  and created_at < :to_plus_1_day
  -- optional: and team_id in (:team_ids)`;
}

function primaryDealsSql(): string {
  return `-- primary_deals_count (Первичные сделки)
select count(distinct d.deal_id) as primary_deals_count
from sa.deals d
where d.created_at >= :from
  and d.created_at < :to_plus_1_day
  and d.funnel_id not in (
    select id from sa.funnels where is_repeat = true
  );

-- grouped by manager (Bitrix user id on deals.current_manager_id)
select d.current_manager_id, count(distinct d.deal_id) as primary_deals_count
from sa.deals d
where d.created_at >= :from
  and d.created_at < :to_plus_1_day
  and d.funnel_id not in (
    select id from sa.funnels where is_repeat = true
  )
group by d.current_manager_id;`;
}

function repeatDealsSql(): string {
  return `-- repeat_deals_count (Повторные сделки)
select count(distinct d.deal_id) as repeat_deals_count
from sa.deals d
where d.created_at >= :from
  and d.created_at < :to_plus_1_day
  and d.funnel_id in (
    select id from sa.funnels where is_repeat = true
  );

-- grouped by manager
select d.current_manager_id, count(distinct d.deal_id) as repeat_deals_count
from sa.deals d
where d.created_at >= :from
  and d.created_at < :to_plus_1_day
  and d.funnel_id in (
    select id from sa.funnels where is_repeat = true
  )
group by d.current_manager_id;`;
}

function calledDealsSql(): string {
  return `-- called_deals_count (Созвонился)
select count(distinct d.deal_id) as called_deals_count
from sa.deals d
where d.created_at >= :from
  and d.created_at < :to_plus_1_day
  and d.stage_id in (
    select id from sa.stages where event_type = 'called'
  );

-- grouped by manager
select d.current_manager_id, count(distinct d.deal_id) as called_deals_count
from sa.deals d
where d.created_at >= :from
  and d.created_at < :to_plus_1_day
  and d.stage_id in (
    select id from sa.stages where event_type = 'called'
  )
group by d.current_manager_id;`;
}

function historicalStageDealsSql(eventType: "reserved" | "confirmed"): string {
  const column =
    eventType === "reserved"
      ? "reservations_count"
      : "confirmed_reservations_count";
  return `-- ${column}
select count(distinct d.deal_id) as ${column}
from sa.deals d
where d.created_at >= :from
  and d.created_at < :to_plus_1_day
  and exists (
    select 1
    from sa.deal_events de
    where de.deal_id = d.deal_id
      and de.stage_id in (
        select id from sa.stages where event_type = '${eventType}'
      )
  );

-- grouped by manager (deals.current_manager_id)
select d.current_manager_id, count(distinct d.deal_id) as ${column}
from sa.deals d
where d.created_at >= :from
  and d.created_at < :to_plus_1_day
  and exists (
    select 1
    from sa.deal_events de
    where de.deal_id = d.deal_id
      and de.stage_id in (
        select id from sa.stages where event_type = '${eventType}'
      )
  )
group by d.current_manager_id;`;
}

function calculatedSql(dependencies: string[] | null): string {
  const deps = dependencies?.length ? dependencies.join(", ") : "dependency_metric";
  return `-- calculated metric (${deps})
-- numerator
select sum(<dependency_1_source_column>) as numerator
from sa.daily_sales
where report_date between :from and :to;

-- denominator
select sum(<dependency_2_source_column>) as denominator
from sa.daily_sales
where report_date between :from and :to;

-- result = numerator / denominator * 100`;
}

function isPrimaryDealsMetricId(id: string): boolean {
  return id === "primary_deals_count" || id === "incoming_deals_count";
}

export function explainMetricEngine(metric: DebugMetricRow): MetricEngineExplanation {
  const relatedTable = sourceToDebugTable(metric.source);

  if (metric.metric_type === "calculated") {
    return {
      summary:
        "Движок берёт зависимости из каталога и пересчитывает ratio/CR из numerator/denominator после агрегации строк.",
      sqlExplanation: calculatedSql(metric.dependencies),
      relatedTable,
    };
  }

  if (metric.metric_type === "external") {
    return {
      summary:
        "External-метрика: в v1 движок может не считать её автоматически. Проверьте source/source_column в каталоге.",
      sqlExplanation: `-- external metric
-- source: ${metric.source ?? "null"}
-- source_column: ${metric.source_column ?? "null"}`,
      relatedTable,
    };
  }

  const source = (metric.source ?? "").toLowerCase();
  const column = metric.source_column ?? "<source_column>";

  if (isPrimaryDealsMetricId(metric.id)) {
    return {
      summary:
        "Collected-метрика «Первичные сделки»: count(distinct deal_id) по sa.deals за период created_at, где funnel_id не относится к повторным воронкам (sa.funnels.is_repeat = true).",
      sqlExplanation: primaryDealsSql(),
      relatedTable: "deals",
    };
  }

  if (metric.id === "repeat_deals_count") {
    return {
      summary:
        "Collected-метрика «Повторные сделки»: count(distinct deal_id) по sa.deals за период created_at, где funnel_id относится к повторным воронкам (sa.funnels.is_repeat = true).",
      sqlExplanation: repeatDealsSql(),
      relatedTable: "deals",
    };
  }

  if (metric.id === "called_deals_count") {
    return {
      summary:
        "Collected-метрика «Созвонился»: count(distinct deal_id) по sa.deals за период created_at, где deals.stage_id соответствует sa.stages.id с event_type = 'called'.",
      sqlExplanation: calledDealsSql(),
      relatedTable: "deals",
    };
  }

  if (metric.id === "reservations_count") {
    return {
      summary:
        "Collected-метрика «Брони»: count(distinct deal_id) по sa.deals за период created_at, где у сделки когда-либо был deal_events.stage_id на стадии sa.stages.event_type = 'reserved'.",
      sqlExplanation: historicalStageDealsSql("reserved"),
      relatedTable: "deal_events",
    };
  }

  if (metric.id === "confirmed_reservations_count") {
    return {
      summary:
        "Collected-метрика «Подтверждённые брони»: count(distinct deal_id) по sa.deals за период created_at, где у сделки когда-либо был deal_events.stage_id на стадии sa.stages.event_type = 'confirmed'.",
      sqlExplanation: historicalStageDealsSql("confirmed"),
      relatedTable: "deal_events",
    };
  }

  if (
    metric.id === "primary_sales_count" ||
    metric.id === "repeat_sales_count"
  ) {
    return {
      summary:
        "Collected-метрика «Продажи»: count(distinct deal_id) по sa.deals за период created_at, где deals.stage_id соответствует sa.stages.id с event_type IN ('sold', 'shipped').",
      sqlExplanation: `-- primary_sales_count (Продажи)
select count(distinct d.deal_id) as primary_sales_count
from sa.deals d
where d.created_at >= :from
  and d.created_at < :to_plus_1_day
  and d.stage_id in (
    select id from sa.stages where event_type in ('sold', 'shipped')
  )`,
      relatedTable: "deals",
    };
  }

  if (
    metric.id === "primary_sales_amount" ||
    metric.id === "repeat_sales_amount"
  ) {
    return {
      summary:
        "Collected-метрика «Сумма продаж»: sum(amount) по sa.deals за период created_at, где deals.stage_id соответствует sa.stages.id с event_type IN ('sold', 'shipped').",
      sqlExplanation: `-- primary_sales_amount (Сумма продаж)
select sum(d.amount) as primary_sales_amount
from sa.deals d
where d.created_at >= :from
  and d.created_at < :to_plus_1_day
  and d.stage_id in (
    select id from sa.stages where event_type in ('sold', 'shipped')
  )`,
      relatedTable: "deals",
    };
  }

  if (metric.id === "primary_shipments_count") {
    return {
      summary:
        "Collected-метрика «Отгрузки»: count(distinct deal_id) по sa.deals за период created_at, где deals.stage_id соответствует sa.stages.id с stage_type = 'WON'.",
      sqlExplanation: `-- primary_shipments_count (Отгрузки)
select count(distinct d.deal_id) as primary_shipments_count
from sa.deals d
where d.created_at >= :from
  and d.created_at < :to_plus_1_day
  and d.stage_id in (
    select id from sa.stages where stage_type = 'WON'
  )`,
      relatedTable: "deals",
    };
  }

  if (
    metric.id === "primary_shipments_amount" ||
    metric.id === "repeat_shipments_amount"
  ) {
    return {
      summary:
        "Collected-метрика «Сумма отгрузок»: sum(amount) по sa.deals за период created_at, где deals.stage_id соответствует sa.stages.id с stage_type = 'WON'.",
      sqlExplanation: `-- primary_shipments_amount (Сумма отгрузок)
select sum(d.amount) as primary_shipments_amount
from sa.deals d
where d.created_at >= :from
  and d.created_at < :to_plus_1_day
  and d.stage_id in (
    select id from sa.stages where stage_type = 'WON'
  )`,
      relatedTable: "deals",
    };
  }

  if (
    metric.id === "deals_count" ||
    (source.includes("deals") && column === "deal_id")
  ) {
    return {
      summary: "Collected-метрика считается как count(*) по sa.deals за период created_at.",
      sqlExplanation: dealsCountSql(),
      relatedTable: "deals",
    };
  }

  if (
    metric.id === "deals_amount" ||
    (source.includes("deals") && column === "amount")
  ) {
    return {
      summary: "Collected-метрика считается как sum(amount) по sa.deals за период created_at.",
      sqlExplanation: dealsAmountSql(),
      relatedTable: "deals",
    };
  }

  if (source.includes("deal_events")) {
    return {
      summary:
        "Collected-метрика из sa.deal_events. В текущем by-managers engine v1 основной путь — sa.daily_sales.",
      sqlExplanation: `-- deal_events metric
select ${metric.aggregation_fn ?? "sum"}(${column}) as value
from sa.deal_events
where event_at >= :from
  and event_at < :to_plus_1_day`,
      relatedTable: "deal_events",
    };
  }

  return {
    summary: `Collected-метрика: sum(${column}) из ${metric.source ?? "daily_sales"} с фильтром report_date.`,
    sqlExplanation: dailySalesSum(column),
    relatedTable: relatedTable ?? "daily_sales",
  };
}

export function metricCatalogDescription(metric: DebugMetricRow): string {
  const parts = [
    metric.name_ru,
    metric.category ? `Категория: ${metric.category}` : null,
    metric.formula ? `Формула: ${metric.formula}` : null,
  ].filter(Boolean);
  return parts.join(". ");
}
