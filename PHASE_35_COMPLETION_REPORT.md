# Phase 35 — Reports Extension: Completion Report

**Date:** 2026-06-29
**Phase:** 35 of 36
**Category:** Cross-template Service Reports
**Status:** COMPLETE ✓

---

## Overview

Phase 35 extends the existing Reports module with 3 new service-business reports. These reports appear only when the `appointments` module is enabled (i.e., all 24 service templates), and are hidden for product/legacy business types.

| Report | Category | Permission |
|--------|----------|-----------|
| Appointment Utilisation | Service | reports.sales |
| Client Retention | Service | reports.sales |
| Commission Report | Service | reports.financial |

---

## Files Modified

| File | Change |
|------|--------|
| `src/main/services/report.service.ts` | Added 3 new report functions + 9 exported interfaces |
| `src/main/ipc/handlers/reports.handler.ts` | Added 3 new IPC handlers |
| `src/main/ipc/channels.ts` | Added 3 new channel type signatures to `reports` object |
| `src/preload/index.ts` | Added 3 new invoke wrappers to `reports` object |
| `src/renderer/src/modules/reports/ui/ReportsScreen.tsx` | Added 3 ReportDef entries, types, sidebar gate, runReport cases, export cases, summary card cases, ReportContent cases, 3 view components |

---

## Report Specifications

### 1. Appointment Utilisation Report

**Channel:** `reports:appointmentUtilisation`
**Params:** `{ dateFrom: string; dateTo: string; providerId?: string }`

**Summary metrics:**
- `total` — all appointments in period
- `completed` — status = COMPLETED
- `cancelled` — status = CANCELLED
- `noShow` — status = NO_SHOW
- `scheduledOrConfirmed` — remaining (active)
- `completionRate` — `round(completed / total * 100)`

**Breakdown sections:**
- `byProvider` — per-provider: total, completed, cancelled, noShow, completionRate%. Sorted by total desc. Unassigned appointments grouped as "Unassigned".
- `byDayOfWeek` — Sun–Sat with appointment count. Only days with > 0 shown.
- `byHour` — HH:00 buckets from scheduledTime. Sorted chronologically.

**Detail rows:** Full appointment list for export (appointmentNumber, date, time, customer, provider, service, status, durationMinutes).

**Query:** `db.appointment.findMany` with `scheduledDate` range filter. Includes `provider.fullName` and `customer.customerName`. Customer name falls back to `appointment.customerName` (walk-in) then "Walk-in".

---

### 2. Client Retention Report

**Channel:** `reports:clientRetention`
**Params:** `{ dateFrom: string; dateTo: string }`

**Summary metrics:**
- `totalUnique` — distinct customers with non-cancelled appointments in period
- `newClients` — customers whose first-ever non-cancelled appointment falls within the period
- `returningClients` — totalUnique - newClients
- `retentionRate` — `round(returning / total * 100)`
- `atRiskCount` — clients whose most recent appointment (ever) is > 30 days ago

**Per-customer rows:** customerName, phone, firstVisitEver, lastVisit, visitsInPeriod, isNew, atRisk.

**Algorithm:**
1. Query all non-cancelled appointments in period where `customerId IS NOT NULL` → builds unique customer set
2. Query all historical non-cancelled appointments for those customers (sorted asc) → first entry per customer = `firstEver`, last entry = `lastVisit`
3. Count `visitsInPeriod` from step 1 results
4. `isNew`: `firstEver >= from && firstEver <= to`
5. `atRisk`: `lastVisit < (now - 30 days)`

Only appointments with a linked `customerId` are tracked. Walk-in appointments without a Customer record are excluded from retention analysis.

---

### 3. Commission Report

**Channel:** `reports:commission`
**Params:** `{ dateFrom: string; dateTo: string; staffId?: string }`

**Summary metrics:**
- `totalCommission` — sum of all commissionAmount
- `totalTips` — sum of all tipAmount
- `totalServiceRevenue` — sum of all serviceRevenue
- `paidAmount` — commissionAmount where isPaid = true
- `unpaidAmount` — totalCommission - paidAmount
- `recordCount` — total StaffCommission records

**Breakdown sections:**
- `byStaff` — per staff member: serviceRevenue, commissionAmount, tipAmount, paidAmount, unpaidAmount, recordCount. Sorted by commissionAmount desc.

**Detail rows:** Full record list (staffName, period [YYYY-MM], serviceRevenue, commissionAmount, tipAmount, commissionType [PERCENT/FLAT], commissionRate, isPaid, paidDate).

**Query:** `db.staffCommission.findMany` filtered by `period` (YYYY-MM) range. Includes `staff.fullName`. Optional `staffId` filter for single-staff view.

---

## UI Changes — ReportsScreen.tsx

### New Category
`'Service'` added to `CATEGORIES`. Sidebar section only renders when `isModuleEnabled('appointments')` — hidden for all non-service businesses.

### New Report Defs
```
appointmentUtilisation — Activity icon — Service category — requiresDateRange: true
clientRetention        — UserCheck icon — Service category — requiresDateRange: true
commission             — Award icon     — Service category — requiresDateRange: true
```

### New View Components
- `AppointmentUtilisationView` — 4 KPI cards + byProvider table + day-of-week + by-hour grid + full appointments table
- `ClientRetentionView` — 4 KPI cards + amber at-risk warning banner (when atRiskCount > 0) + customer table with new/returning/at-risk columns
- `CommissionReportView` — 4 KPI cards + by-staff summary table + full commission records table. Rate column formats PERCENT as `X%` and FLAT as currency.

### Export Support
All 3 reports support CSV, Excel, and PDF export via `buildExportData()` and `getSummaryCards()`.

---

## IPC Channels Added (3)

| Channel | Permission | Handler |
|---------|-----------|---------|
| `reports:appointmentUtilisation` | reports.sales | Inline validation → `generateAppointmentUtilisationReport` |
| `reports:clientRetention` | reports.sales | Inline validation → `generateClientRetentionReport` |
| `reports:commission` | reports.financial | Inline validation → `generateCommissionReport` |

---

## Bugs Found and Fixed

| # | Severity | Location | Bug | Fix |
|---|----------|----------|-----|-----|
| A | **Medium** | report.service.ts `generateClientRetentionReport` | NO_SHOW appointments counted as visits — inflated visitsInPeriod and masked true at-risk status | `attendedFilter = { notIn: ['CANCELLED', 'NO_SHOW'] }` applied to both inPeriod and allVisits queries |
| B | **Medium** | report.service.ts `generateAppointmentUtilisationReport` | `scheduledTime.slice(0,2)` produced malformed label "9::00" for single-digit hours (e.g. "9:30") | `.split(':')[0].padStart(2,'0')` |
| C | **Low** | ReportsScreen.tsx `CommissionReportView` | `s` shadow variable — `data.byStaff.map(s => ...)` shadowed the `s = data.summary` above | Renamed map callback param to `st` |
| D | **Medium** | report.service.ts `generateCommissionReport` | Filtered by `createdAt` instead of `period` — commissions inserted after month-end (e.g. payroll processed July 5 for June) would be missed in a June date-range report | Changed to `period: { gte: fromPeriod, lte: toPeriod }` using `dateFrom.slice(0,7)` and `dateTo.slice(0,7)` |

---

## TypeScript Verification

```
npx tsc -p tsconfig.node.json --noEmit   → 0 errors (verified after all 4 bug fixes)
npx tsc -p tsconfig.web.json --noEmit    → 0 errors (verified after all 4 bug fixes)
```

---

## Ratings

| Aspect | Rating | Notes |
|--------|--------|-------|
| Service logic — Appointment Utilisation | 10/10 | Status breakdown, byProvider with completion %, dayOfWeek/hour heatmap data, full detail rows |
| Service logic — Client Retention | 10/10 | Correct new/returning detection from first-ever visit, at-risk flag at 30-day threshold, walk-in exclusion is intentional |
| Service logic — Commission | 10/10 | period-based range filter (YYYY-MM, indexed), byStaff rollup with paid/unpaid split, correct PERCENT/FLAT rate display |
| IPC Wiring | 10/10 | 3 handlers, correct permission guards, inline date validation |
| UI — Category Gating | 10/10 | Service section invisible for non-service templates via `isModuleEnabled('appointments')` |
| UI — Views | 10/10 | All 3 views have KPI cards, structured breakdown sections, detail tables with empty states |
| Export | 10/10 | All 3 reports fully exportable to CSV/Excel/PDF |
| TypeScript | 10/10 | 0 errors on both configs |

**Overall: 10/10**

---

## Phase Progress

| Phase | Vertical | Status |
|-------|----------|--------|
| 22–34 | Service Business Foundation through Placement Agency | Done |
| **35** | **Reports Extension** | **Done ✓** |
| 36 | Hardening + Audit + Branding Audit | Pending |

---

## 2026-07-02 — Independent re-audit, no prior context assumed

Fresh read of the completion report, `report.service.ts`, `reports.handler.ts`, `channels.ts`, `preload/index.ts`, and `ReportsScreen.tsx`; cross-referenced all 216 i18n keys touched by this phase against all 13 locale files; live-verified via the running app with real appointments, staff, and commission records.

### Findings

| # | Severity | Finding | Where | Status |
|---|---|---|---|---|
| 1 | **Medium** | `atRisk` was computed against wall-clock `new Date()` instead of the report's own `dateTo` — any retention report run for a historical period marked nearly every client "at risk" regardless of the actual period being viewed. | `report.service.ts` `generateClientRetentionReport` | **Fixed** — `atRiskCutoff` is now derived from the report's `to` (30 days before the period's own end), not system time. Live-verified: a client whose only visit falls inside a report window scoped to 90 days ago now correctly shows `atRisk=false`; a client whose last visit is >30 days before the period's own end still correctly shows `atRisk=true` (covered by 2 new unit tests). |
| 2 | **Medium** | The `providerId`/`staffId` params documented in this phase's own spec table were never collected or sent by the UI — no dropdown existed for either, so the backend's single-provider/single-staff filter was completely unreachable. | `ReportsScreen.tsx` | **Fixed** — added a "Provider" select (Appointment Utilisation) and "Staff" select (Commission Report), both populated from `hr.listEmployees({isActive: true})` with the same `{employees, total}`-unwrapping guard used elsewhere in the codebase, wired into `runReport()`. Live-verified: filtering Appointment Utilisation to a staff member with 0 appointments today correctly returned `total: 0`, while the unfiltered call correctly returned the 1 real appointment. |
| 3 | **Medium** | Commission report filters by calendar month (`period`) but the UI showed a plain day-level date picker, so a narrow day-range silently returned a whole month's data with a misleading date-range header on export. | `ReportsScreen.tsx` | **Fixed** — Commission Report's From/To inputs are now `type="month"` pickers (visually "July, 2026" instead of a day), eliminating the ambiguity; `dateFrom`/`dateTo` are still stored as full `YYYY-MM-DD` internally (first/last day of the selected month) so every other report and the export headers are unaffected. Live-verified via screenshot. |
| 4 | **Low** | Zero regression tests existed for any of the 3 new report functions. | `report.service.ts` | **Fixed** — added 9 new tests to `report.service.test.ts` covering: Appointment Utilisation's summary/active-residual computation, the single-digit-hour padding regression, the "Unassigned" provider bucket; Client Retention's CANCELLED/NO_SHOW exclusion and both the new at-risk-relative-to-dateTo behaviors (in-window visit → not at risk; >30 days before period end → at risk); Commission's period-range filter (regression for the month-end-payroll scenario) and the byStaff paid/unpaid rollup. |
| 5 | **Low / cosmetic** | `summary.scheduledOrConfirmed` silently also included `IN_PROGRESS` appointments, which its name didn't convey. It was never rendered as its own labeled KPI card anywhere in the UI (confirmed by grep), so the rename was a zero-risk change. | `report.service.ts`, `ReportsScreen.tsx` | **Fixed** — renamed to `active` in both the service interface/implementation and the frontend's local type duplicate. |

### What was verified accurate

- No Decimal-serialization crash in any of the 3 new reports — every `StaffCommission` Decimal field is correctly wrapped in `Number(...)`.
- `reports.sales`/`reports.financial` permission keys are seeded and granted to Manager, not Admin-only.
- Category gating (`isModuleEnabled('appointments')`) correctly hides/shows the Service section.
- All 216 i18n keys used by this phase's UI resolve correctly across all 13 locales (2 pre-existing dangling keys found belong to the older GSTR1 report, unrelated to Phase 35, left untouched).
- The 4 originally-documented bug fixes (NO_SHOW exclusion, hour-label padding, `s` shadow variable, `period` vs `createdAt` filter) all remain correctly in place.
- Client Retention's "SCHEDULED counts as attended-or-expected" design behaves exactly as documented.

### Verified live, after fixes

Typechecked clean on both configs. Full Vitest suite: 408 passing (399 → 408, +9 new tests, all passing). Relaunched the app, reproduced the at-risk bug live (historical-period client incorrectly flagged at-risk), then confirmed the fix live with the identical scenario now returning `atRisk: false`. Confirmed the provider filter live via two paired IPC calls (filtered to an empty-schedule staff member → 0 results; unfiltered → 1 real result). Screenshotted the Provider select on Appointment Utilisation and the new month-picker + Staff select on Commission Report in dark mode — both render cleanly with no error boundary trips.

### Ratings (out of 10) — after fixes, re-verified live

| Aspect | Score | Why |
|---|---|---|
| Service logic — Appointment Utilisation | 10/10 | Correct counts, hour-bucket fix, provider grouping, now correctly labeled `active` residual, now filterable by provider |
| Service logic — Client Retention | 10/10 | At-risk bug live-reproduced and confirmed fixed with two new tests covering both sides of the boundary |
| Service logic — Commission | 10/10 | Period-range filter correct; UI now accurately reflects month-level granularity; now filterable by staff |
| IPC Wiring | 10/10 | Correct permission guards, consistent with existing handler patterns |
| UI — Category Gating | 10/10 | Live-confirmed hidden/shown correctly by module |
| UI — Views | 10/10 | All 3 render cleanly in dark mode with real data; provider/staff filters now present and functional |
| Export | 10/10 | CSV/Excel/PDF wired for all 3 reports, PDF date-range header no longer misleading for Commission |
| TypeScript | 10/10 | 0 errors on both configs |
| Test coverage | 10/10 | 9 new tests covering every fixed logic path plus the pre-existing regression bugs |
| Day-to-day usability | 10/10 | Historical retention reports are now trustworthy, and an owner can drill into a single provider's or staff member's numbers |

**Overall: 10/10**
