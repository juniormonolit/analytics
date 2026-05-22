# Report Engine v1

## Цель

Один простой серверный API, который возвращает данные для таблицы отчета.

## API

```http
POST /api/reports/run
```

Body:

```json
{
  "sectionSlug": "sales",
  "reportSlug": "by-managers",
  "period": { "from": "2026-04-01", "to": "2026-04-28" },
  "comparisonPeriod": { "from": "2026-03-03", "to": "2026-03-31" },
  "filters": {
    "teamIds": [1, 2, 3]
  },
  "metricIds": ["all_core"],
  "grouping": "none",
  "dealScope": "primary"
}
```

`dealScope` — глобальный фильтр воронки, применяется **до** расчёта любой метрики:

| Значение | Поведение |
|----------|-----------|
| `"primary"` (default) | только первичные воронки |
| `"repeat"` | только повторные воронки |
| `"all"` | все воронки |

Метрики с суффиксами `(перв.)` / `(повт.)` в UI объединены: повторные id (`repeat_*`) скрыты из каталога, названия показываются без суффикса.

Response:

```json
{
  "columns": [],
  "rows": [],
  "totals": {},
  "meta": {
    "period": { "from": "2026-04-01", "to": "2026-04-28" },
    "comparisonPeriod": { "from": "2026-03-03", "to": "2026-03-31" }
  }
}
```

## Базовые отчеты

### `sales/by-managers`

Dimension:

- `manager_id`
- `manager_name`
- `team_id`
- `team_name`

Основная таблица: `sa.deals`.

Join для имени менеджера:

- если `sa.employees.bitrix_id = deals.current_manager_id`, использовать это;
- если в базе менеджеры пустые, временно показывать `current_manager_id` как ID менеджера.

### `sales/by-product-groups`

Dimension:

- `product_group_id`
- `product_group_name`

Join:

- `deals.product_group_id = product_groups.id`.

## Фильтр периода

Всегда по `deals.created_at`:

```sql
where deals.created_at >= :from::date
  and deals.created_at < (:to::date + interval '1 day')
```

Так `to` включительно.

## Первичные / повторные сделки

- **Первичные сделки** (`primary_deals_count`): distinct `deal_id` из `sa.deals` в периоде, где `funnel_id` не относится к повторной воронке (`sa.funnels.is_repeat = true`).
- **Повторные сделки** (`repeat_deals_count`): distinct `deal_id` из `sa.deals` в периоде, где `funnel_id` относится к повторной воронке.
- Менеджер — `deals.current_manager_id`.
- Legacy `incoming_deals_count` = первичные сделки.
- **Созвонился** (`called_deals_count`): техническая метрика — считается в движке, но скрыта из отчётов и picker'а.
- **Брони** / **Подтв. брони**: distinct `deal_id` в периоде по `deals.created_at`, где в `sa.deal_events` когда-либо была стадия с `event_type = 'reserved'` / `'confirmed'`.

Drill-down открывается кликом по **«Текущий»** выбранной метрики. Запрос `POST /api/reports/drilldown` принимает `metricId`; фильтр сделок совпадает с правилом метрики (первичные / повторные / стадия `event_type`). Без `metricId` — первичные сделки.

## Фильтр отделов

Если выбраны отделы в дереве, нужно включать все дочерние команды.

В frontend дерево возвращает `selectedTeamIdsExpanded` — уже раскрытый список leaf/team ids. Backend просто фильтрует:

```sql
and deals.team_id = any(:team_ids)
```

## Сравнение

Запускать один и тот же query дважды:

1. текущий период;
2. период сравнения.

Затем merge по ключу dimension.

Для каждой метрики:

```ts
current = rowCurrent[metricId] ?? 0
previous = rowPrevious[metricId] ?? 0
delta = current - previous
deltaPercent = previous === 0 ? null : delta / previous * 100
```

## Totals

Итоговая строка считается отдельно агрегированным запросом без dimension или через суммирование строк.

Для ratio-метрик нельзя усреднять проценты. Нужно пересчитывать через числитель/знаменатель.

## Drill down API

```http
POST /api/reports/drilldown
```

Body:

```json
{
  "sectionSlug": "sales",
  "reportSlug": "by-managers",
  "rowKey": { "managerId": 123 },
  "period": { "from": "2026-04-01", "to": "2026-04-28" },
  "comparisonPeriod": { "from": "2026-03-03", "to": "2026-03-31" },
  "level": "product-groups",
  "metricId": "called_deals_count"
}
```

Levels:

- `product-groups`
- `managers`
- `deals`

## Сделки в детализации

Для уровня `deals` вернуть:

- `deal_id`;
- `deal_name`;
- `amount`;
- `created_at`;
- `stage_id`;
- `stage_name`;
- `manager_id`;
- `team_id`;
- `product_group_id`.
