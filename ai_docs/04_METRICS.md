# Метрики v1

## Источник списка метрик

Используем все активные базовые метрики из `sa.metrics`:

```sql
select *
from sa.metrics
where is_active = true
order by sort_order, name_ru;
```

Если есть `is_core = true`, по умолчанию выбирать их:

```sql
select *
from sa.metrics
where is_active = true
  and is_core = true
order by sort_order, name_ru;
```

## Принцип

В таблице выбора показателей показывать:

- название метрики;
- короткое название;
- категорию;
- тип данных;
- формулу/описание, если есть;
- теги: кол-во, сумма, CR, %, сделки, продажи, брони, отказы, отгрузки.

## Типы метрик

- `int` — целое число;
- `decimal` — число;
- `money` — деньги;
- `percent` — процент;
- `months` — месяцы.

## Форматирование

- money: `1 234 567 ₽`
- percent: `12,3%`
- int: `1 234`
- decimal: `1 234,5`

## Цвета отклонений

Для большинства метрик:

- рост — хорошо;
- падение — плохо.

Для отказов и негативных метрик наоборот:

- рост — плохо;
- падение — хорошо.

В v1 можно добавить в frontend список `negativeMetricIds`, если в `sa.metrics.color_rules` нет достаточной информации.

## Важное правило для CR

CR/проценты нельзя суммировать и нельзя усреднять при группировке. Нужно пересчитывать:

```text
CR = numerator / denominator
```

Для этого у calculated metric должны быть dependencies. Если dependencies нет — временно показывать значение на уровне строки, но totals для такой метрики делать пустым или `—`.

## Первичные и повторные сделки

Глобальный переключатель **Первичные / Повторные / Все** в тулбаре отчёта (`dealScope`) задаёт воронку для **всех** метрик сразу. По умолчанию — **Первичные**.

Отдельные метрики `repeat_deals_count`, `repeat_sales_count`, `repeat_sales_amount`, `repeat_shipments_amount` скрыты из UI; вместо дублей с суффиксами `(перв.)` / `(повт.)` показывается одна метрика на показатель.

Подсчёт первичных / повторных сделок по таблице `sa.deals` за период по `created_at` (half-open: `[from 00:00, to+1 day 00:00)`).

Атрибуция менеджеру — всегда через `deals.current_manager_id` (с alias `employees.id` / `employees.bitrix_id`).

Разделение первичных / повторных — по воронке сделки:

| Метрика | id в каталоге | Правило |
|---------|---------------|---------|
| **Первичные сделки** | `primary_deals_count` | `count(distinct deal_id)` где `funnel_id` **не** входит в `select id from sa.funnels where is_repeat = true` |
| **Повторные сделки** | `repeat_deals_count` | `count(distinct deal_id)` где `funnel_id` **входит** в повторные воронки |

Legacy-id `incoming_deals_count` в движке трактуется как **первичные сделки** (для сохранённых настроек UI).

Drill-down открывается кликом по ячейке **«Текущий»** метрики. Список сделок фильтруется по той же правилу, что и метрика (воронка / `event_type` стадии). Без `metricId` в запросе — fallback на первичные сделки.

Пример SQL для первичных сделок по менеджеру:

```sql
select d.current_manager_id, count(distinct d.deal_id) as primary_deals_count
from sa.deals d
where d.created_at >= :from
  and d.created_at < :to_plus_1_day
  and d.funnel_id not in (
    select id from sa.funnels where is_repeat = true
  )
group by d.current_manager_id;
```

`sa.deal_events` и `stage_type = 'NEW'` для первичных/повторных метрик **не используются**.

### Созвонился (technical)

Метрика **«Созвонился»** (`called_deals_count`) остаётся в движке как **техническая** — используется внутренней логикой, но **не отображается в отчётах** (скрыта из каталога UI и `all_core`).

Правило подсчёта (если метрика запрошена явно):

- `count(distinct deal_id)` по `sa.deals` за период `created_at`;
- `deals.stage_id` должен совпадать с `sa.stages.id`, где `event_type = 'called'`;
- менеджер — `deals.current_manager_id`.

```sql
select d.current_manager_id, count(distinct d.deal_id) as called_deals_count
from sa.deals d
where d.created_at >= :from
  and d.created_at < :to_plus_1_day
  and d.stage_id in (
    select id from sa.stages where event_type = 'called'
  )
group by d.current_manager_id;
```

### Брони и подтверждённые брони

Метрики **«Брони»** (`reservations_count`) и **«Подтверждённые брони»** / **«Подтв. брони»** (`confirmed_reservations_count`):

- `count(distinct deal_id)` по `sa.deals` за период `created_at` (half-open);
- сделка попадает в метрику, если **когда-либо** был `sa.deal_events` с `stage_id` ∈ `sa.stages.id`, где `event_type = 'reserved'` или `'confirmed'` (текущий `deals.stage_id` не важен);
- менеджер — `deals.current_manager_id`.

```sql
select d.current_manager_id, count(distinct d.deal_id) as reservations_count
from sa.deals d
where d.created_at >= :from
  and d.created_at < :to_plus_1_day
  and exists (
    select 1
    from sa.deal_events de
    where de.deal_id = d.deal_id
      and de.stage_id in (
        select id from sa.stages where event_type = 'reserved'
      )
  )
group by d.current_manager_id;
```

### Продажи и отгрузки

Метрики **«Продажи»** (`primary_sales_count`), **«Сумма продаж»** (`primary_sales_amount`), **«Отгрузки»** (`primary_shipments_count`), **«Сумма отгрузок»** (`primary_shipments_amount`):

- период — `deals.created_at` (half-open);
- менеджер — `deals.current_manager_id`;
- фильтр воронки — глобальный `dealScope` (Первичные / Повторные / Все).

| Метрика | Правило по текущему `deals.stage_id` |
|---------|--------------------------------------|
| **Продажи** / **Сумма продаж** | `stage_id` ∈ `select id from sa.stages where event_type in ('sold', 'shipped')` |
| **Отгрузки** / **Сумма отгрузок** | `stage_id` ∈ `select id from sa.stages where stage_type = 'WON'` |

```sql
-- Продажи (count)
select d.current_manager_id, count(distinct d.deal_id) as primary_sales_count
from sa.deals d
where d.created_at >= :from
  and d.created_at < :to_plus_1_day
  and d.stage_id in (
    select id from sa.stages where event_type in ('sold', 'shipped')
  )
group by d.current_manager_id;

-- Отгрузки (count)
select d.current_manager_id, count(distinct d.deal_id) as primary_shipments_count
from sa.deals d
where d.created_at >= :from
  and d.created_at < :to_plus_1_day
  and d.stage_id in (
    select id from sa.stages where stage_type = 'WON'
  )
group by d.current_manager_id;
```
