# Database & Supabase

## Используемая схема

Схема: `sa`.

## Важные таблицы

### `sa.deals`

Главная таблица сделок.

Ключевые поля:

- `deal_id` — ID сделки;
- `deal_name` — название;
- `deal_type` — тип сделки;
- `stage_id` — стадия;
- `amount` — сумма;
- `funnel_id` — воронка;
- `product_group_id` — товарная группа;
- `current_manager_id` — текущий менеджер;
- `team_id` — отдел/команда;
- `created_at` — дата создания, базовое поле периода;
- `updated_at` — дата обновления.

### `sa.funnels`

Воронки продаж. Поле `is_repeat = true` помечает **повторные** воронки.

Используется для метрик `primary_deals_count` / `repeat_deals_count`:

- первичная сделка — `deals.funnel_id` не в повторных воронках;
- повторная сделка — `deals.funnel_id` в повторной воронке.

### `sa.deal_events`

Журнал событий по сделкам.

Ключевые поля:

- `deal_id`;
- `stage_id`;
- `event_at`;
- `manager_id`;
- `amount_at_event`.

### `sa.teams`

Отделы/команды.

В приложенном `schema.md` таблица выглядит так:

- `id`;
- `name`;
- `is_active`.

В `schema.md` не видно `parent_id`, но пользователь помнит, что иерархия уже делалась. Поэтому Cursor должен сначала проверить реальную базу.

## Как проверить иерархию отделов

В Supabase SQL Editor выполнить:

```sql
select
  table_schema,
  table_name,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'sa'
  and table_name in ('teams', 'departments', 'org_units', 'team_tree', 'employee_departments')
order by table_name, ordinal_position;
```

Затем проверить наличие похожих таблиц:

```sql
select table_schema, table_name
from information_schema.tables
where table_schema = 'sa'
  and (
    table_name ilike '%team%'
    or table_name ilike '%department%'
    or table_name ilike '%org%'
    or table_name ilike '%branch%'
  )
order by table_name;
```

Если в `sa.teams` есть `parent_id`, используем его.

Если нет, в v1 делаем временную таблицу/маппинг:

```sql
create table if not exists sa.team_hierarchy (
  team_id int primary key references sa.teams(id),
  parent_team_id int null references sa.teams(id),
  sort_order int not null default 0
);
```

И строим дерево по `team_hierarchy`.

## Пользовательские настройки

В v1 допустим localStorage. Но лучше сразу заложить таблицу:

```sql
create table if not exists sa.user_report_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  section_slug text not null,
  report_slug text not null,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(user_id, section_slug, report_slug)
);
```

Пример `preferences`:

```json
{
  "metricIds": ["primary_deals_count", "repeat_deals_count", "primary_sales_amount"],
  "columnOrder": ["manager_name", "primary_deals_count", "repeat_deals_count", "primary_sales_amount"],
  "hiddenColumns": [],
  "columnWidths": { "manager_name": 220 },
  "grouping": "team",
  "sort": { "columnId": "primary_sales_amount.current", "direction": "desc" }
}
```

## Важный принцип метрик

Не доверять готовым materialized views без проверки. В v1 можно читать каталог `sa.metrics`, но агрегировать отчеты через контролируемый backend route, чтобы формулы, сравнения и drill down были прозрачны.
