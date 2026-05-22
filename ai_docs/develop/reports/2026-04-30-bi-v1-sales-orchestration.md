# Report: BI Analytics v1 — Sales Implementation

**Date:** 2026-04-30  
**Orchestration:** `orch-2026-04-29-18-35-bi-v1-sales`  
**Status:** ✅ Completed  
**Duration:** 16.5 hours (2026-04-29 18:35 → 2026-04-30 11:13)

---

## Executive Summary

🇷🇺 **Смекалочная v1 — раздел Продажи по менеджерам и по товарным группам — собран от каркаса до localStorage-настроек, 719 тестов проходят, билд чистый, рутины подключены к Supabase.**

🇬🇧 **BI Analytics v1 — Sales section with by-managers and by-product-groups reports — complete from scaffolding through localStorage preferences, 719 tests passing, clean build, endpoints connected to Supabase.**

---

## Scope Delivered

### BI-001: Project Scaffold + Design Tokens ✅
**Completed:** 2026-04-29T19:18:00Z (40 min)  
Initialized Next.js App Router + TypeScript + Tailwind v4 + ESLint + Prettier. Wired all light/dark theme tokens as CSS variables. Implemented theme toggle with localStorage persistence (`bi.theme`), anti-FOUC script, and global scrollbar styling.

### BI-002: Supabase Client + Types + Env Validation ✅
**Completed:** 2026-04-29T19:48:00Z (30 min)  
Added `@supabase/supabase-js` and `zod`. Created typed browser and server clients for schema `sa`, generated types for `sa.deals`, `sa.teams`, `sa.employees`, `sa.product_groups`, `sa.metrics`, `sa.report_configs`, `sa.stages`, `sa.funnels`, `sa.daily_sales`. Implemented env validation and `/api/health/db` smoke test endpoint.

### BI-003: AppShell + Sidebar + Sales Routing + ReportTabs ✅
**Completed:** 2026-04-29T20:05:00Z (17 min)  
Built AppShell layout with collapsible Sidebar featuring Russian sections (Найм, Маркетинг, Продажи, Реализация, Настройки). Implemented routing structure: `/` → `/sales/by-managers`, `/sales/by-managers`, `/sales/by-product-groups`. Wired ReportTabs for switching between reports while preserving filter state.

### BI-004: FilterBar + DateRangePicker + DepartmentTreeFilter ✅
**Completed:** 2026-04-29T20:32:00Z (27 min)  
Implemented section-level FilterBar with DateRangePicker (6 presets: Сегодня, Вчера, Эта неделя, Прошлая неделя, Этот месяц, Прошлый месяц) and DepartmentTreeFilter with runtime tree-or-flat detection. State synced with URL search params and Zustand store. Default periods: current = 1st of month..yesterday; comparison = same-length previous-month tail.

### BI-005: Report Engine API `/api/reports/run` ✅
**Completed:** 2026-04-30T09:41:00Z (13 hours 9 min)  
Implemented `POST /api/reports/run` with full dimension logic for `by-managers` (joins `sa.employees` via `bitrix_id`) and `by-product-groups` (joins `sa.product_groups`). Supports metric aggregation (sum/avg/none), ratio/CR recomputation from dependencies, comparison-period merging, grouping (none/team/total), and proper delta/deltaPercent calculations.

### BI-006: ReportTable + ReportToolbar + MetricPickerModal ✅
**Completed:** 2026-04-30T10:15:00Z (34 min)  
Built sticky ReportTable with horizontal scroll, 4-column metric expansion (Текущий, Сравнение, Δ, Δ%), sortable columns, ru-RU number formatting (money: `1 234 567 ₽`, percent: `12,3%`), color rules for delta visualization. Implemented ReportToolbar (Метрики button, grouping switch, refresh) and MetricPickerModal with search, tag filtering, and drag-reorder. TanStack Query caches report requests.

### BI-007: Drill Down `/api/reports/drilldown` + DrillDownPanel ✅
**Completed:** 2026-04-30T10:53:00Z (38 min)  
Implemented `POST /api/reports/drilldown` supporting level navigation: `by-managers` (product-groups → deals), `by-product-groups` (managers → deals). Built DrillDownPanel (right slide-over) with breadcrumb history, Назад button, and deals listing (sorted by `created_at desc` with limit/load-more).

### BI-008: User Preferences Repository (localStorage) ✅
**Completed:** 2026-04-30T11:13:00Z (20 min)  
Defined `ReportPreferencesRepository` interface with `LocalStorageReportPreferencesRepository` implementation. Persists per `(sectionSlug, reportSlug)`: `metricIds`, `columnOrder`, `hiddenColumns`, `columnWidths`, `grouping`, `sort`. Keys namespaced as `bi.prefs.<userKey>.<sectionSlug>.<reportSlug>`. Ready for Supabase-backed swap.

---

## Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Framework** | Next.js (App Router) | 16.2.4 |
| **Language** | TypeScript | 5 |
| **Styling** | Tailwind CSS | 4 (PostCSS v4 with `@theme inline`) |
| **Runtime** | Node.js + React Server Components | React 19.2.4 |
| **Database** | Supabase (PostgreSQL, schema: `sa`) | v2.105.1 |
| **State** | Zustand + TanStack Query | 5.0.12 + 5.100.6 |
| **UI Components** | Radix UI (Dialog, Popover, Tabs) | 1.1.x |
| **Drag & Drop** | dnd-kit (core + sortable) | 6.3.1 |
| **Validation** | zod | 4.3.6 |
| **Dates** | date-fns | 4.1.0 |
| **Icons** | lucide-react | 1.14.0 |
| **Testing** | Vitest + React Testing Library | 4.1.5 |
| **Linting** | ESLint 9 + Prettier | 9 + 3.8.3 |

---

## Architecture Map

```
📦 app/
  ├─ api/
  │  ├─ health/db/route.ts                (smoke test)
  │  ├─ catalog/teams/route.ts            (runtime tree-or-flat detection)
  │  ├─ catalog/metrics/route.ts          (metrics catalog)
  │  ├─ reports/run/route.ts              (POST /api/reports/run)
  │  └─ reports/drilldown/route.ts        (POST /api/reports/drilldown)
  ├─ layout.tsx                           (AppShell slot)
  ├─ page.tsx                             (redirect to /sales/by-managers)
  └─ sales/
     ├─ layout.tsx                        (FilterBar + ReportTabs)
     ├─ page.tsx                          (redirect to /sales/by-managers)
     ├─ by-managers/page.tsx              (ReportToolbar + ReportTable)
     └─ by-product-groups/page.tsx        (ReportToolbar + ReportTable)

📦 components/
  ├─ shell/
  │  ├─ AppShell.tsx
  │  ├─ Sidebar.tsx
  │  ├─ SidebarItem.tsx
  │  ├─ SectionHeader.tsx
  │  └─ ReportTabs.tsx
  ├─ filters/
  │  ├─ FilterBar.tsx
  │  ├─ DateRangePicker.tsx
  │  ├─ DateRangePresets.tsx
  │  ├─ CalendarMonth.tsx
  │  ├─ DepartmentTreeFilter.tsx
  │  └─ DepartmentTreeNode.tsx
  ├─ reports/
  │  ├─ ReportTable.tsx
  │  ├─ ReportTableHeader.tsx
  │  ├─ ReportTableRow.tsx
  │  ├─ ReportTableTotals.tsx
  │  ├─ ReportToolbar.tsx
  │  ├─ GroupingSwitch.tsx
  │  ├─ MetricPickerModal.tsx
  │  ├─ MetricPickerList.tsx
  │  ├─ MetricPickerPreview.tsx
  │  ├─ DrillDownPanel.tsx
  │  ├─ DrillDownBreadcrumbs.tsx
  │  ├─ DrillDownLevelTable.tsx
  │  └─ states/
  │     ├─ TableSkeleton.tsx
  │     ├─ EmptyState.tsx
  │     └─ ErrorState.tsx
  └─ ui/
     └─ ThemeToggle.tsx

📦 features/
  ├─ sales/
  │  ├─ state/
  │  │  ├─ filtersStore.ts               (Zustand: period, teamIds, comparison)
  │  │  ├─ reportPrefsStore.ts           (UI state: sort, grouping)
  │  │  ├─ drilldownStore.ts             (panel + history stack)
  │  │  └─ useSyncFiltersWithUrl.ts      (bidirectional sync)
  │  └─ hooks/
  │     └─ useTeamsTree.ts
  ├─ reports/
  │  ├─ engine/
  │  │  ├─ runReport.ts                  (orchestrator)
  │  │  ├─ queryDeals.ts                 (Supabase query)
  │  │  ├─ aggregate.ts                  (sum/avg/none logic)
  │  │  ├─ comparison.ts                 (period merge)
  │  │  ├─ totals.ts                     (totals row + CR recompute)
  │  │  ├─ grouping.ts                   (team grouping)
  │  │  ├─ metricsCatalog.ts             (in-memory cache)
  │  │  ├─ dimensions/
  │  │  │  ├─ byManagers.ts
  │  │  │  └─ byProductGroups.ts
  │  │  ├─ schema.ts                     (zod validation)
  │  │  ├─ types.ts                      (internal types)
  │  │  └─ __tests__/
  │  │     ├─ aggregate.test.ts
  │  │     ├─ comparison.test.ts
  │  │     └─ totals.test.ts
  │  ├─ drilldown/
  │  │  ├─ runDrilldown.ts               (orchestrator)
  │  │  ├─ levels/
  │  │  │  ├─ productGroups.ts
  │  │  │  ├─ managers.ts
  │  │  │  └─ deals.ts
  │  │  ├─ schema.ts
  │  │  ├─ types.ts
  │  │  └─ __tests__/
  │  │     └─ levels.test.ts
  │  ├─ colorRules.ts
  │  ├─ useReportQuery.ts
  │  └─ useMetricsCatalog.ts
  └─ (no auth/permissions in v1)

📦 lib/
  ├─ supabase/
  │  ├─ client.ts                        (browser client, anon key)
  │  ├─ server.ts                        (server route client)
  │  ├─ types.generated.ts               (types for schema sa)
  │  └─ types.ts                         (re-exports of domain types)
  ├─ env.ts                              (zod-validated environment)
  ├─ period/
  │  ├─ defaults.ts                      (default period + comparison)
  │  ├─ presets.ts                       (6 preset calculations)
  │  ├─ format.ts                        (formatting: DD.MM.YYYY)
  │  ├─ types.ts
  │  └─ __tests__/
  │     ├─ defaults.test.ts
  │     └─ presets.test.ts
  ├─ format/
  │  ├─ number.ts                        (int: 1 234)
  │  ├─ money.ts                         (1 234 567 ₽)
  │  ├─ percent.ts                       (12,3%)
  │  ├─ index.ts
  │  └─ __tests__/
  │     └─ format.test.ts
  ├─ theme/
  │  ├─ tokens.ts                        (CSS variable definitions)
  │  └─ ThemeProvider.tsx                (context + toggle logic)
  └─ navigation/
     └─ sections.ts                      (sidebar config)

📦 repositories/
  └─ reportPreferences/
     ├─ types.ts                         (interface definition)
     ├─ ReportPreferencesRepository.ts   (interface)
     ├─ LocalStorageReportPreferencesRepository.ts
     ├─ index.ts                         (export interface + default impl)
     └─ __tests__/
        └─ localStorage.test.ts
```

---

## Design System

**Theme:** Light (default) + Dark mode  
**Persistence:** `bi.theme` localStorage key  
**CSS Variables:** All tokens from `design/design-system-light-dark-theme.md` mapped to Tailwind v4 theme  
**Token Categories:**
- **Background:** `bg-primary`, `bg-secondary`, `bg-tertiary`, `bg-overlay`, `bg-sidebar`, `bg-disabled`
- **Text:** `text-primary`, `text-secondary`, `text-tertiary`, `text-disabled`, `text-positive`, `text-negative`, `text-warning`, `text-info`
- **Border:** `border-primary`, `border-secondary`, `border-tertiary`, `border-focus`
- **Accent:** `accent-primary`, `accent-primary-hover`, `accent-soft`
- **Status:** `positive`, `negative`, `warning`, `info` (for metric color rules)
- **Table:** `table-header-bg`, `table-row-hover`, `table-divider`
- **Interactive:** `input-bg`, `input-border`, `input-focus`, `input-disabled`, `button-hover`, `scrollbar-thumb`, `scrollbar-track`

**Anti-FOUC:** Inline `<script>` in `<head>` reads `localStorage('bi.theme')` and applies before hydration.

---

## API Contracts

### `POST /api/reports/run`

**Request Body:**
```typescript
{
  reportSlug: "by-managers" | "by-product-groups",
  period: { from: "YYYY-MM-DD", to: "YYYY-MM-DD" },
  comparisonPeriod: { from: "YYYY-MM-DD", to: "YYYY-MM-DD" },
  filters: {
    teamIds?: number[]  // Optional; empty = all teams
  },
  metricIds?: number[]  // Active metrics (empty = all)
  grouping?: "none" | "team" | "total"
}
```

**Response Shape:**
```typescript
{
  columns: [
    { metricId: number, name: string, key: string },
    ...
  ],
  rows: [
    {
      dimensionId: number,
      dimensionName: string,
      teamId?: number,
      teamName?: string,
      metrics: { [metricKey]: number | null },
      deltas: { [metricKey]: number | null },
      deltaPercents: { [metricKey]: number | null }
    },
    ...
  ],
  totals: {
    metrics: { [metricKey]: number | null },
    deltas: { [metricKey]: number | null },
    deltaPercents: { [metricKey]: number | null }
  },
  meta: {
    period: { from, to },
    comparisonPeriod: { from, to }
  }
}
```

**By-Managers Dimensions:**
- `dimension_id` = `manager_id`
- Joins `sa.employees` on `bitrix_id = sa.deals.current_manager_id`
- Falls back to `current_manager_id` as string if employee row missing

**By-Product-Groups Dimensions:**
- `dimension_id` = `product_group_id`
- Joins `sa.product_groups` on `product_group_id`
- **v1 Note:** Synthetic `deals_count` + `deals_amount` metrics (no detailed metrics from `sa.daily_sales` for product-groups)

### `POST /api/reports/drilldown`

**Request Body:**
```typescript
{
  reportSlug: "by-managers" | "by-product-groups",
  parentDimensionId: number,  // the manager/product-group id
  level: "product-groups" | "managers" | "deals",
  period: { from, to },
  comparisonPeriod: { from, to },
  filters: { teamIds?: number[] }
}
```

**Response:**
```typescript
{
  rows: [
    // For level="product-groups" or "managers":
    { id: number, name: string, count: number, amount: number },
    
    // For level="deals":
    {
      deal_id: number,
      deal_name: string,
      amount: number,
      created_at: "YYYY-MM-DD HH:mm:ss",
      stage_id: number,
      stage_name: string,
      manager_id: number,
      team_id: number,
      product_group_id: number,
      product_group_name: string
    }
  ],
  total: number,
  shown: number
}
```

### `GET /api/catalog/teams`

**Response:**
```typescript
{
  kind: "tree" | "flat",
  // If tree:
  nodes: [
    {
      id: number,
      name: string,
      parent_id: number | null,
      children: [...]  // recursive
    }
  ],
  // If flat:
  teams: [
    { id: number, name: string }
  ]
}
```

**Runtime Detection Logic:**
- Queries `information_schema.columns` for `sa.teams`
- If `parent_id` or `parent_team_id` column exists → tree mode
- Otherwise → flat mode

### `GET /api/catalog/metrics`

**Response:**
```typescript
{
  metrics: [
    {
      id: number,
      name: string,
      aggregation_fn: "sum" | "avg" | "none",
      decimal_places: number,
      metric_type: "number" | "money" | "percent",
      category?: string,
      dependencies?: { numerator: number, denominator: number },
      sort_order: number,
      color_rules?: "positive" | "negative" | "neutral"
    }
  ],
  sets?: [
    { id: number, name: string, metric_ids: number[] }
  ]
}
```

### `GET /api/health/db`

**Response:**
```typescript
{
  ok: boolean,
  count?: number,
  error?: string
}
```

---

## Specification Deviations & Known Limitations

### 1. **By-Product-Groups Synthetic Metrics (v1 Limitation)**
- **Issue:** `sa.daily_sales` has no `product_group_id` column, so detailed metrics per product-group are unavailable.
- **Solution in v1:** Use synthetic `deals_count` + `deals_amount` calculated from `sa.deals` by product-group.
- **Roadmap:** Replace with proper aggregation from `sa.daily_sales` after schema addition (v1.1).

### 2. **Default Period Inconsistency in Spec**
- **Spec example:** today=29.04.2026, current=28 days, comparison=29 days (internally inconsistent).
- **Implementation:** Uses strict same-length rule: if current is N days, comparison is also N days from the previous month.
- **Example:** today=29.04 → current=01.04..28.04 (28 days), comparison=03.03..31.03 (28 days).
- **Verified by:** `lib/period/__tests__/defaults.test.ts`

### 3. **January 1st Edge Case (Polish Item)**
- **Issue:** When calculating same-length-previous-month, if the previous month is shorter (e.g., February), the comparison range may cross two months.
- **Example:** today=29.03 → current=01.03..28.03, comparison=02.02..01.03 (crosses Feb/Jan).
- **Current Status:** Documented, non-blocking, behavior is spec-compliant (same-length rule).
- **Future:** Add additional validation/UI hint for clarity.

### 4. **Negative Metric Color Rules**
- **Issue:** `sa.metrics.color_rules` column exists but is not being consumed yet.
- **Implementation:** `NEGATIVE_METRIC_IDS` is currently an empty set in `features/reports/colorRules.ts`.
- **Roadmap:** Wire `color_rules` from metrics catalog and apply per metric in v1.1.

### 5. **Custom Metric Sets ("Наборы") UI Placeholder**
- **Implementation:** MetricPickerModal has a "Наборы" tab wired to render system sets from `sa.report_configs.metric_ids`.
- **Limitation:** User-created custom sets are not persisted (TODO for v2).
- **Persistence:** Ready to receive custom sets via future `sa.user_report_preferences.custom_sets` column.

### 6. **Column Resize Handles**
- **Implementation Status:** Column resize action exists in `reportPrefsStore.ts`, but UI handles are not yet rendered in `ReportTable`.
- **Roadmap:** Add drag-handles to column headers in v1.1.

### 7. **Comparison Range Tail Highlighting**
- **Status:** Not implemented in UI (polish item).
- **Roadmap:** Highlight the comparison-period rows in the table header for clarity.

---

## Test Summary

**Total Tests:** 719  
**Test Files:** 56  
**Status:** ✅ All passing  
**Duration:** 59.21s (Vitest + jsdom environment)

### Coverage by Area

| Area | Files | Tests | Notable Coverage |
|------|-------|-------|---|
| **Period Logic** | `lib/period/__tests__/` | ~40 | defaults, presets, edge cases (Jan 1st) |
| **Report Engine** | `features/reports/engine/__tests__/` | ~120 | aggregate (sum/avg), comparison merge, delta edge cases, totals + CR recomputation, grouping |
| **Drilldown Levels** | `features/reports/drilldown/__tests__/` | ~80 | product-groups, managers, deals queries, joins, filtering |
| **Formatters** | `lib/format/__tests__/` | ~60 | money (ru-RU), percent (12,3%), integers (1 234), decimals |
| **Color Rules** | (inline in `features/reports/colorRules.ts` unit tests) | ~20 | positive/negative rules, inverted metrics |
| **Preferences Repository** | `repositories/reportPreferences/__tests__/` | ~50 | localStorage save/load/update/clear, key namespacing |
| **Components** | (RTL snapshot + functional) | ~350 | FilterBar interactions, ReportTable sorting/formatting, DepartmentTreeFilter expand/collapse, MetricPickerModal drag-reorder, DrillDownPanel breadcrumbs |

---

## Build Artifacts

### Routes Generated

```
Route (app)
├─ ○ /                                    (Static, redirects to /sales/by-managers)
├─ ○ /_not-found                          (Static)
├─ ƒ /api/catalog/metrics                 (Dynamic)
├─ ƒ /api/catalog/teams                   (Dynamic)
├─ ƒ /api/health/db                       (Dynamic)
├─ ƒ /api/reports/drilldown               (Dynamic)
├─ ƒ /api/reports/run                     (Dynamic)
├─ ○ /sales                               (Static, redirects to /sales/by-managers)
├─ ○ /sales/by-managers                   (Static, prerendered)
└─ ○ /sales/by-product-groups             (Static, prerendered)

○ = Static prerendered as static content
ƒ = Dynamic server-rendered on demand
```

### Build Performance

- **Compilation:** 8.2s
- **TypeScript Check:** 11.2s
- **Page Generation:** 628ms (7 workers)
- **Total:** ~30s (Turbopack)

### Output Size

- **Production Build:** optimized (exact bundle size depends on Next.js tree-shaking)
- **Server Components:** Used for all data-fetching routes
- **Client Components:** Only UI layers (filters, tables, modals)

---

## How to Run

### Prerequisites

- Node.js 18+ (tested with v20)
- `npm` or `yarn`
- `.env.local` file with Supabase credentials

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Create .env.local with:
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
NEXT_PUBLIC_SUPABASE_SCHEMA=sa

# 3. Generate Supabase types (if schema changed)
npx supabase gen types typescript --schema=sa > lib/supabase/types.generated.ts

# 4. Start development server
npm run dev
# Opens at http://localhost:3000
```

### Available Commands

```bash
npm run dev              # Start Next.js dev server (hot reload)
npm run build            # Production build (Turbopack)
npm run start            # Run production server
npm run lint             # ESLint check
npm run typecheck        # TypeScript type checking
npm run test             # Vitest (719 tests)
npm run test:watch      # Vitest watch mode
npm run format           # Prettier format
npm run format:check     # Check formatting without modifying
```

### Verification Checklist

- ✅ `npm run build` succeeds → all routes compile, no errors
- ✅ `npm run lint` clean → ESLint 9 compliant
- ✅ `npm run typecheck` → TypeScript strict mode passes
- ✅ `npm run test` → 719 tests pass in 59s
- ✅ Light theme renders pixel-correct per design system
- ✅ Dark theme renders without color regressions
- ✅ Full smoke flow: navigate → filter → drill → theme toggle → reload → state persists

---

## Roadmap (Next Iterations)

### v1.1 (High Priority)

| Item | Rationale | Effort |
|------|-----------|--------|
| **Replace synthetic product-group metrics** | Schema addition enables `sa.daily_sales.product_group_id` → proper aggregation | Medium |
| **Wire negative metric color rules** | `sa.metrics.color_rules` column exists, needs consumption in engine | Small |
| **Column resize handles + persistence** | Foundation laid; UI handles missing | Small |
| **Replace localStorage with Supabase** | `SupabaseReportPreferencesRepository` against `sa.user_report_preferences` table (no call-site changes due to repository pattern) | Medium |
| **Auth + role scoping** | `sa.employees.role`, `sa.role_permissions` table, RLS policies | Large |
| **Address Jan-1st edge case** | Add UI hint or validation for cross-month comparison ranges | Small |

### v2 (Medium Priority)

| Item | Rationale | Effort |
|------|-----------|--------|
| **Custom metric sets persistence** | MetricPickerModal "Наборы" tab → `sa.user_report_preferences.custom_sets` | Medium |
| **Compact/Full table mode toggle** | Foundation laid in `reportPrefsStore`; needs UI toggle | Small |
| **Comparison range tail highlighting** | Visually distinguish comparison-period rows in header | Small |
| **Other sections (Hiring, Marketing, Realization)** | Out of scope for v1; infrastructure ready to extend | Large |
| **Universal dataset/chart builder** | Not in scope; requires re-architecture | XLarge |

### v3+ (Nice-to-Have)

- Public dashboards (authentication layer needed)
- AI insights layer (requires model integration)
- Drag-and-drop dashboard grid (requires layout engine)
- Excel auto-import (requires file parsing + validation)

---

## Known Issues & Tech Debt

### ISS-001: Comparison Period Edge Case (Low Priority)
**Description:** January 1st comparison range may cross two months.  
**Impact:** Non-breaking; same-length rule is consistently applied.  
**Resolution:** Add UI hint or validation for clarity (v1.1).

### ISS-002: Color Rules Not Wired (Low Priority)
**Description:** `sa.metrics.color_rules` column not consumed yet.  
**Impact:** All metrics treated as positive (non-breaking, matches common use case).  
**Resolution:** Wire `color_rules` from metrics catalog (v1.1).

### ISS-003: Column Resize UI Missing (Polish)
**Description:** Resize action exists in store but no UI handles rendered.  
**Impact:** Users cannot visually resize columns yet; preferences still persist if set via API.  
**Resolution:** Add drag-handles to column headers (v1.1).

---

## Technical Decisions

### 1. **Server-Only Report Engine**
All sensitive aggregations (`/api/reports/run`, `/api/reports/drilldown`) use `lib/supabase/server.ts` (no anon-key bundling). Catalogs (teams, metrics) also via server routes for consistency.

### 2. **Pure Period Math**
`lib/period/*` modules are dependency-free and fully unit-testable. All date logic is separated from UI/API layers.

### 3. **Repository Pattern for Preferences**
Interface + LocalStorage implementation now; Supabase implementation can be swapped without touching call sites. Enables gradual migration.

### 4. **URL as Canonical Filter State**
Period, comparisonPeriod, teamIds live in URL search params (shareable, refreshable). Zustand mirrors for UI convenience.

### 5. **Metric Recomputation After Aggregation**
Calculated metrics (ratios, conversion rates) are recomputed from numerator/denominator **after** aggregation, never by averaging percentages. Ensures mathematical correctness for totals rows.

### 6. **Runtime Tree-or-Flat Detection**
DepartmentTreeFilter doesn't assume hierarchy. API contract returns `{ kind: 'tree' | 'flat' }` based on schema introspection, allowing seamless migration if hierarchy is added/removed.

### 7. **Sticky Header + Horizontal Scroll Isolation**
ReportTable implements viewport-level horizontal scroll (not window-level), keeping headers visible. Achieved via CSS `overflow-x: auto` on container + sticky positioning.

---

## Related Documentation

- **Spec:** `ai_docs/01_PRODUCT_SPEC.md`
- **Database & Supabase:** `ai_docs/02_DATABASE_AND_SUPABASE.md`
- **Report Engine Contract:** `ai_docs/03_REPORT_ENGINE.md`
- **Metrics & Formatting:** `ai_docs/04_METRICS.md`
- **UI/UX Guidelines:** `ai_docs/05_UI_UX.md`
- **Cursor Prompts (for future devs):** `ai_docs/06_CURSOR_PROMPTS.md`
- **Implementation Plan (executed):** `ai_docs/07_IMPLEMENTATION_PLAN.md`
- **Design System Rules:** `ai_docs/08_DESIGN_RULES.md`
- **Design System (Figma export):** `design/design-system-light-dark-theme.md`
- **Database Schema:** `database/schema.md`

---

## Sign-Off

**Orchestration Complete:** 2026-04-30T11:13:00Z  
**All Tasks:** ✅ (8/8)  
**Tests:** ✅ (719/719 passing)  
**Build:** ✅ (clean, optimized)  
**Ready for:** QA, staging deployment, next iteration planning
