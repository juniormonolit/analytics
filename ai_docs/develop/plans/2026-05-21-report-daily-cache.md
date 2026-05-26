# Plan: Дневной кэш отчётов (N месяцев) + быстрый путь API

**Created:** 2026-05-21  
**Status:** 📋 Запланировано (реализация отложена)  
**Scope:** `sales/by-managers` (MVP), затем drilldown и `by-product-groups`  
**Horizon:** ~3–4 недели поэтапно, когда вернёмся к задаче

---

## Goal

Ускорить открытие аналитики и смену периода **без полного пересчёта из `sa.deals` / `sa.deal_events`**, если запрошенный диапазон попадает в заранее подготовленное окно **последних N месяцев** (N = 3 по умолчанию).

Поведение для пользователя:

1. Открывает «По менеджерам» с дефолтным периодом (1-е число месяца → вчера) — **ответ за сотни миллисекунд**.
2. Меняет период внутри последних 3 месяцев — **пересчёт только по дневному кэшу** (SUM по датам), без скана сделок.
3. Drilldown product-groups — из того же кэша.
4. Drilldown deals — **on-demand** (или отдельный индекс позже).
5. Период старше окна кэша — **медленный путь** (как сейчас), с явным UI «исторические данные».
6. Кнопка **«Обновить»** — принудительный refresh кэша + invalidate клиентского TanStack Query.

---

## Non-Goals (v1 кэша)

- Полный прекэш списка сделок за 3 месяца для всех менеджеров.
- Замена текущего report engine — он остаётся **источником истины** и fallback.
- Слепое использование legacy `mv_*` без сверки с engine.
- Кэширование пользовательских prefs / color settings (уже есть `user_account_storage` в ORG).

---

## Ключевое архитектурное решение

> Кэшируем **не готовый отчёт**, а **дневные агрегаты** с гранулярностью, достаточной для slice-by-period.

```
┌─────────────────────────────────────────────────────────────┐
│  Nightly job (00:01 Europe/Moscow)                          │
│  refreshReportDailyCache() [TypeScript ETL]                 │
│    → READ deals/events из analytic SA                       │
│    → WRITE агрегаты в ORG (report_daily_cache)              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  ORG.public.report_daily_cache                              │
│  (report_date, manager_id, product_group_id?, metric_key,   │
│   deal_scope, value)                                        │
└──────────────────────────┬──────────────────────────────────┘
                           │
         POST /api/reports/run│
                           ▼
              period ⊂ cache window?
                    /        \
                  yes         no
                   │           │
           SUM by dates    runReport() live
           + merge cmp    (deals/events из SA)
           + ratios
           + grouping
```

**Почему не JSON-snapshot:** один snapshot покрывает только один период. Дневной кэш покрывает любой поддиапазон внутри N месяцев двумя SUM-ами (current + comparison).

### Где хранить кэш (важно)

| БД | Роль | Доступ приложения |
|----|------|-------------------|
| **Analytic (SA)** | `deals`, `metrics`, `deal_events` — источник данных | **только чтение** (anon key) |
| **ORG** | сотрудники, prefs, **кэш отчётов** | **чтение и запись** (service role) |

**Не применять** миграцию кэша в схему `sa` — write-доступа к analytic Supabase нет. Таблицы кэша создаём в **ORG Supabase**, schema `public` (тот же паттерн, что `user_account_storage`).

ETL при refresh: `createServerClient()` → читает SA; `createOrgServerClient()` → пишет кэш. Fast path: ORG → SUM; org-lookup для имён менеджеров — как сейчас.

---

## Схема данных (новые таблицы в ORG)

Предпочтительно **обычная таблица** + nightly upsert (не MV), чтобы:

- проще обновлять rolling window;
- хранить `refreshed_at` и версию;
- не блокировать чтение на `REFRESH MATERIALIZED VIEW`.

### `public.report_daily_cache`

| Колонка | Тип | Описание |
|---------|-----|----------|
| `report_date` | `date` | Календарный день метрики |
| `report_slug` | `text` | `'by-managers'` / `'by-product-groups'` |
| `manager_id` | `int` | Bitrix manager id; `-1` для top-level by-product-groups |
| `product_group_id` | `int` | `-1` = manager-level; `>= 0` = drilldown grain |
| `metric_key` | `text` | `incoming`, `called`, `primary_sales_count`, … |
| `deal_scope` | `text` | `'primary'` \| `'repeat'` \| `'all'` |
| `value` | `numeric` | Сумма за день |
| `updated_at` | `timestamptz` | Когда строка пересчитана |

**PK:** `(report_slug, report_date, manager_id, product_group_id, metric_key, deal_scope)`

**Индексы:**

- `(report_slug, report_date)`
- `(report_slug, manager_id, report_date)` WHERE `product_group_id = -1`
- `(report_slug, manager_id, product_group_id, report_date)` WHERE `product_group_id <> -1`

### `public.report_cache_meta`

| Колонка | Тип |
|---------|-----|
| `id` | `text` PK (`'global'`) |
| `window_start` | `date` |
| `window_end` | `date` |
| `refreshed_at` | `timestamptz` |
| `refresh_duration_ms` | `int` |
| `row_count` | `bigint` |
| `engine_version` | `text` — для invalidation при смене логики ETL |

Eligibility (период внутри окна) — **в TypeScript**, не SQL RPC.

---

## Правила attribution (must match engine)

ETL **обязан** повторять текущую логику из:

- `features/reports/engine/dimensions/primaryRepeatDeals.ts`
- `calledDeals.ts`, `reservationDeals.ts`, `salesShipmentsDeals.ts`

| metric_key | Источник | Дата для `report_date` |
|------------|----------|------------------------|
| `incoming` | `deals.created_at` | date(created_at) |
| `called` | `deal_events` | date(event_at) |
| `reservations` / `confirmed_reservations` | как в engine | … |
| `primary_sales_*` | `deals.sold_at` | date(sold_at) |
| `primary_shipments_*` | `deals.delivered_at` | date(delivered_at) |

**deal_scope:** отдельные строки для `primary`, `repeat`, `all`.

**Calculated metrics** (`conversion`, ratios): **не храним**; engine recomputes после SUM компонент.

**Median** (`price_speed`): **не кэшируем** → fallback на live engine.

---

## Rolling window: N = 3 месяца

- `window_end` = **вчера** (Europe/Moscow).
- `window_start` = первый день месяца `(today - N calendar months)`.
- Env: `REPORT_CACHE_MONTHS=3`.

Запрос вне окна → `meta.cacheHit: false`, live engine.

---

## API changes (план)

### `POST /api/reports/run` — fast path

1. Прочитать `report_cache_meta` из ORG.
2. Если оба периода внутри окна и кэш заполнен:
   - SUM из `report_daily_cache` для current и comparison.
   - Join org employees для имён.
   - Фильтр `teamIds` после join.
   - Reuse `mergeByDimension`, `applyGrouping`, `computeTotalsRow`.
3. `meta.cacheHit`, `meta.cacheRefreshedAt`, `meta.cacheWindow`, `cacheFallbackReason`.

### `POST /api/reports/drilldown`

- `level=product-groups`: SUM из кэша (drilldown grain).
- `level=deals`: live query без изменений v1.

### `POST /api/reports/cache/refresh` (новый)

- Auth: stub session.
- TypeScript ETL: SA read → ORG write.
- Rate limit: 1 раз в 5 минут.
- `maxDuration` до 300 с.

### Кнопка «Обновить» (UI)

1. `POST /api/reports/cache/refresh`.
2. `queryClient.invalidateQueries`.
3. Подсказка: возраст кэша / «период вне кэша».

---

## Nightly schedule

**Рекомендация v1:** внешний cron → `POST /api/reports/cache/refresh` в 00:01 MSK (нужна авторизация или отдельный service token).

Альтернативы: pg_cron в ORG (только NOTIFY/HTTP), Edge Function + schedule.

---

## Reconciliation (обязательно перед prod)

```
for each day in last 7 days:
  for dealScope in [primary, repeat, all]:
    compare SUM(cache) vs runReport(live) for single day
    assert delta < epsilon
```

Vitest integration, skip без `REPORT_CACHE_RECONCILIATION=1`.

---

## Tasks Overview

| ID | Task | Priority | Complexity | Depends |
|----|------|----------|------------|---------|
| CACHE-001 | SQL migration в **ORG**: `report_daily_cache`, `report_cache_meta` | High | Moderate | — |
| CACHE-002 | TypeScript ETL `refreshReportDailyCache()` (SA read, ORG write) | High | Complex | CACHE-001 |
| CACHE-003 | Eligibility + meta read из ORG | High | Simple | CACHE-001 |
| CACHE-004 | `loadFromCache()` fetcher | High | Moderate | CACHE-001 |
| CACHE-005 | Fast path в `runReport()` для `by-managers` | High | Complex | CACHE-004 |
| CACHE-006 | `meta.cacheHit` в API + tests | Medium | Simple | CACHE-005 |
| CACHE-007 | `POST /api/reports/cache/refresh` | High | Moderate | CACHE-002 |
| CACHE-008 | Toolbar «Обновить» → refresh + invalidate | Medium | Simple | CACHE-007 |
| CACHE-009 | UI hint: cache age / historical fallback | Low | Simple | CACHE-006 |
| CACHE-010 | Reconciliation test (7-day window) | High | Moderate | CACHE-002, CACHE-005 |
| CACHE-011 | Drilldown product-groups fast path | Medium | Complex | CACHE-004 |
| CACHE-012 | `by-product-groups` daily grain | Medium | Complex | CACHE-002 |
| CACHE-013 | Docs: `ai_docs/04_REPORT_CACHE.md` (runtime) | Low | Simple | CACHE-005 |

### Dependency graph

```
CACHE-001 ──► CACHE-002 ──► CACHE-007 ──► CACHE-008
     │              │
     │              └──► CACHE-010
     ▼
CACHE-003 ──► CACHE-004 ──► CACHE-005 ──► CACHE-006 ──► CACHE-009
                                   │
                                   └──► CACHE-011
CACHE-002 ──► CACHE-012
```

**MVP:** CACHE-001 … CACHE-010 + CACHE-008.  
**v1.1:** CACHE-011, CACHE-012.

---

## Фазы поставки

### Фаза 0 — Design lock

- [x] Список `metric_key` ↔ engine loaders (таблица выше).
- [x] Rolling window: calendar months.
- [x] Хранение кэша в **ORG**, не в SA.

### Фаза 1 — DB + ETL

- [ ] Migration в ORG Supabase.
- [ ] `features/reports/cache/refresh.ts`.
- [ ] Manual refresh + reconciliation на staging.

### Фаза 2 — Fast path API

- [ ] Модуль `features/reports/cache/`.
- [ ] Feature flag `REPORT_CACHE_ENABLED=true`.
- [ ] Unit tests.

### Фаза 3 — Ops + UX

- [ ] Refresh API + toolbar.
- [ ] Cron 00:01 MSK.
- [ ] UI hints.

### Фаза 4 — Drilldown (v1.1)

- [ ] product-groups from cache.
- [ ] deals — live.

---

## Feature flags & env (будущее)

```env
REPORT_CACHE_ENABLED=true
REPORT_CACHE_MONTHS=3
# REPORT_CACHE_REFRESH_SECRET=…  # optional for cron HTTP
```

При `REPORT_CACHE_ENABLED=false` — поведение как сейчас.

---

## Risks & mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| ETL расходится с engine | Неверные цифры | Reconciliation; `engine_version` bump |
| Refresh job > 5 min | Stale data | Monitor `refresh_duration_ms` в meta |
| Большой объём строк | Disk / slow SUM | Partial indexes; только active metrics |
| SA read-only | Нельзя писать кэш в SA | **ORG storage** (зафиксировано) |
| Org department filter | Wrong rows | Filter managers post-join |
| Median metrics | Нельзя SUM | Fallback live |

---

## Success metrics

- P95 `POST /api/reports/run` (cache hit) **< 500 ms**.
- Reconciliation: **0 mismatches** на 7-day sample перед enable flag.
- Default dashboard открывается без заметного spinner.

---

## Связанные файлы (touch points при реализации)

| Area | Files |
|------|-------|
| Engine | `features/reports/engine/runReport.ts`, `dimensions/byManagers.ts` |
| Drilldown | `features/reports/drilldown/levels/productGroups.ts` |
| API | `app/api/reports/run/route.ts`, `app/api/reports/cache/refresh/route.ts` |
| UI | `components/reports/ReportToolbar.tsx` |
| ORG DB | `database/migrations/` (новая миграция ORG), `lib/org/database.types.ts` |
| SA read | `lib/supabase/server.ts` (без изменений прав) |

---

## Next step (когда вернёмся к задаче)

1. CACHE-001: migration в **ORG** Supabase (`report_daily_cache`, `report_cache_meta`).
2. CACHE-002–007: код модуля `features/reports/cache/` + refresh API.
3. Первый refresh, reconciliation на staging.
4. `REPORT_CACHE_ENABLED=true` в env prod.
5. Cron 00:01 MSK → refresh API.
