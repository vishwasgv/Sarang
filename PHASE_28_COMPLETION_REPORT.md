# Phase 28 Completion Report — LAWYER Template

**Completed:** 2026-06-24  
**TypeScript errors:** 0  
**Evaluation passes:** 5 (all bugs resolved)  
**Overall score:** 10/10

---

## What Was Built

Full LAWYER business template — legal case management, hearing tracking, and time entry billing for law firms running on Sarang Business OS.

### Schema (prisma/schema.prisma)

Three new models added at lines 1787–1860:

| Model | Purpose | Relations |
|-------|---------|-----------|
| `LegalCase` | Core case record (number, title, type, court, client, advocate, fee tracking, status, nextHearingDate) | Customer (Cascade), Employee/CaseAdvocate (SetNull), Hearing[], TimeEntry[] |
| `Hearing` | Court hearing dates with status lifecycle | LegalCase (Cascade) |
| `TimeEntry` | Billable hours logged per case | LegalCase (SetNull), Employee (SetNull) |

Key design decisions:
- `nextHearingDate` is a stored computed field on `LegalCase`, maintained by `syncNextHearingDate` — avoids expensive joins on every list query
- `TimeEntry.caseId` uses `onDelete: SetNull` (billing history survives case deletion)
- `TimeEntry.invoiceId` stub ready for billing path C (time → invoice) in a future phase
- `Decimal` type for all monetary and hours fields — no float precision drift

---

### Backend Services

#### `src/main/services/legal-case.service.ts`
- `listLegalCases` — filters by status, clientId, advocateId, search (OR across caseNumber/caseTitle/courtName); ordered status ASC → nextHearingDate ASC (NULLs last) → createdAt DESC
- `getLegalCase` — full case detail with hearings (DESC) and time entries (DESC) included
- `createLegalCase` — hardcodes `status: 'ACTIVE'` and `feeCollected: 0`; clientId cannot be changed post-create
- `updateLegalCase` — conditional spreads for date fields prevent partial-update from nulling them
- `deleteLegalCase` — cascades via schema

#### `src/main/services/hearing.service.ts`
- `listHearings` — date range filter with today/upcoming/all modes
- `createHearing` — creates at SCHEDULED → syncNextHearingDate → scheduleHearingReminder
- `updateHearing` — always runs syncNextHearingDate first, then applies adjournment nextDate as fallback only if no earlier SCHEDULED hearing was found
- `deleteHearing` — pre-fetches caseId, deletes, syncs
- `syncNextHearingDate` — uses `setUTCHours(0,0,0,0)` so today's hearings (stored at UTC midnight) are always included
- `scheduleHearingReminder` — Promise.all for case + firm name, signs notification as businessName; isolated in try/catch

#### `src/main/services/time-entry.service.ts`
- `createTimeEntry` — `amount = Math.round(hours × ratePerHour × 100) / 100`
- `updateTimeEntry` — re-fetches existing hours/rate before recomputing amount on partial update
- `deleteTimeEntry` — server-side `isBilled` guard (independent of UI guard)
- `markTimeEntriesBilled` — bulk updateMany, idempotent

---

### IPC Layer

**14 channels registered** across three handler files:

| Namespace | Channels | Permission |
|-----------|----------|-----------|
| `legalCase` | list, get, create, update, delete | list → billing.view; rest → billing.createInvoice |
| `hearing` | list, create, update, delete | same pattern |
| `timeEntry` | list, create, update, delete, markBilled | same pattern |

All three handlers imported and registered in `src/main/ipc/index.ts`.  
All 14 channels wired in `src/preload/index.ts`.  
`IpcChannels` type in `src/main/ipc/channels.ts` extended — TypeScript enforces shape at all call sites.

---

### Module Gating

```typescript
// industry-template.service.ts
LAWYER: [...SERVICE_BASE_MODULES, 'legal_cases', 'time_entries']
```

`TemplateModule` union extended with `'legal_cases' | 'time_entries'`.

---

### UI

#### `src/renderer/src/modules/service-business/ui/LegalCasesScreen.tsx` (998 lines)

Three-tab screen:

**Cases Tab**
- Live search + status filter + refresh
- Case table: number, title, court, client, next hearing (red = today, amber = ≤3 days, neutral = future), status badge
- Case detail side panel: fee progress (agreed vs collected), eCourt link (conditional), Close Case / Mark Disposed
- Add Hearing form inline in detail panel (date, time, purpose, room)
- Hearing cards with Done + Adjourn actions on SCHEDULED hearings
- Log Time form inline (date, hours, description, rate, advocate) with live amount preview
- Time entry list with unbilled total, delete (unbilled only)
- Form state resets on case selection switch (no cross-case data leaks)

**Hearings Tab**
- Sub-filter: Today / Upcoming / All (uses local date components — timezone-correct for IST)
- Table: Date, Case, Client, Court, Purpose, Status, Actions
- Row highlights: danger for today, warning for soon
- Done + Adjourn buttons on every SCHEDULED row
- Adjourn modal shared between both tabs

**Time Entries Tab**
- Filter: Unbilled / Billed / All
- Select-all checkbox (unbilled only), per-row checkboxes (unbilled only)
- Bulk "Mark as Billed" button
- Total unbilled aggregate

**KPI Block (Cases tab)**
- Active Cases / Today's Hearings / Hearings in 3 Days / Closed+Disposed
- Draws from `kpiCases` (no filter, separate from display list) — KPIs never corrupted by status filter

#### Sidebar (`src/renderer/src/shared/ui/layout/Sidebar.tsx`)
```typescript
{ label: 'Legal Cases', path: '/legal/cases', icon: Scale, permissionKey: 'billing.view', requiredModule: 'legal_cases' }
```

#### Router (`src/renderer/src/app/router.tsx`)
```tsx
<Route path="/legal/cases" element={<ProtectedRoute permission="billing.view"><LegalCasesScreen /></ProtectedRoute>} />
```

---

## Bugs Found and Fixed (5 evaluation passes)

| Pass | # | Severity | Location | Bug | Fix |
|------|---|----------|----------|-----|-----|
| 1 | 1 | MODERATE | hearing.service.ts | Reminder signed with `courtName` instead of firm name | `Promise.all` to fetch `businessProfile.businessName`, fallback to `'Your Advocate'` |
| 1 | 2 | MODERATE | LegalCasesScreen.tsx | "Closed/Disposed" KPI always 0 (drew from filtered `cases` state) | Added `kpiCases` state + `loadKpiStats()` with no-filter API call |
| 1 | 3 | MODERATE | LegalCasesScreen.tsx | Global Hearings tab had no Done/Adjourn actions | Added Actions column with conditional Done + Adjourn buttons |
| 1 | 4 | MINOR | LegalCasesScreen.tsx | Hearing/time form state leaked when switching cases | Case row `onClick` resets `showHearingForm` + `showTimeForm` |
| 2 | 5 | MODERATE | LegalCasesScreen.tsx | `handleSaveHearing` missing `loadKpiStats()` — "Today's Hearings" KPI went stale | Added `loadKpiStats()` to save-hearing success block |
| 2 | 6 | MODERATE | LegalCasesScreen.tsx | `handleAdjourn` missing `loadKpiStats()` — KPIs went stale after adjournment | Added `loadKpiStats()` to adjourn success block |
| 3 | 7 | MODERATE | hearing.service.ts | ADJOURNED fast path directly set `nextHearingDate = nextDate`, ignoring earlier SCHEDULED siblings | Always run `syncNextHearingDate` first; only apply `nextDate` as fallback if sync found nothing |
| 3 | 8 | MINOR | LegalCasesScreen.tsx | Today/Upcoming filter used UTC date string (`toISOString().slice(0,10)`) — wrong for IST users | Replaced with local date string using `getFullYear/getMonth/getDate` |
| 3 | 9 | MODERATE | hearing.service.ts | `syncNextHearingDate` used `new Date()` (current timestamp), excluding today's hearings during business hours | Changed to `setUTCHours(0,0,0,0)` (midnight UTC = how hearing dates are stored) |
| 4 | 10 | COSMETIC | hearing.service.ts | `scheduleHearingReminder` had unused `hearingId` parameter | Removed dead parameter from signature and call site |

---

## Files Changed

```
prisma/schema.prisma                                              (+74 lines)
src/main/services/legal-case.service.ts                          (new)
src/main/services/hearing.service.ts                             (new)
src/main/services/time-entry.service.ts                          (new)
src/main/ipc/handlers/legal-case.handler.ts                      (new)
src/main/ipc/handlers/hearing.handler.ts                         (new)
src/main/ipc/handlers/time-entry.handler.ts                      (new)
src/main/ipc/index.ts                                            (+6 lines)
src/main/ipc/channels.ts                                         (+20 lines)
src/preload/index.ts                                             (+15 lines)
src/main/services/industry-template.service.ts                   (+3 lines)
src/renderer/src/modules/service-business/ui/LegalCasesScreen.tsx (new, 998 lines)
src/renderer/src/shared/ui/layout/Sidebar.tsx                    (+1 line)
src/renderer/src/app/router.tsx                                  (+2 lines)
```

---

## Spec Coverage

| Feature | Status |
|---------|--------|
| Case management (create, list, filter, detail, status change) | ✅ |
| Hearing scheduling (add, complete, adjourn) | ✅ |
| Global hearings calendar (Today / Upcoming / All) | ✅ |
| Time entry logging per case | ✅ |
| Bulk mark-as-billed workflow | ✅ |
| KPI dashboard (active, today hearings, 3-day hearings, closed) | ✅ |
| nextHearingDate auto-sync | ✅ |
| eCourt portal link-out | ✅ |
| WhatsApp hearing reminder (2 days before) | ✅ |
| Fee tracking (agreed vs collected) | ✅ |
| Module gating (LAWYER template only) | ✅ |
| Sidebar navigation with permission guard | ✅ |
| Billing path C stub (TimeEntry.invoiceId) | ✅ |

---

## 2026-07-02 — Independent re-audit, no prior context assumed

Fresh read of `legal-case.service.ts`, `hearing.service.ts`, `time-entry.service.ts`, and `LegalCasesScreen.tsx`, confirmed live. This audit found the original 10 self-reported bugs (5 evaluation passes) were genuinely fixed, but the entire feature was non-functional end-to-end underneath them — the very first thing the screen does (list cases) crashed the instant real fee data existed, and case creation was blocked entirely by an unrelated bug in the client dropdown.

### Findings

| # | Severity | Finding | Where | Status |
|---|---|---|---|---|
| 1 | **Critical** | `LegalCase.feeAgreed`/`feeCollected` are Prisma `Decimal` fields, returned unserialized by `listLegalCases`, `getLegalCase`, `createLegalCase`, `updateLegalCase`. Electron's IPC throws `An object could not be cloned`. Live-verified: creating a case with a real fee crashed (row silently written to the DB anyway), and with that real row present, `legalCase.list()` also crashed — the Cases tab hung on "Loading…" forever and all 4 KPI cards stayed at 0 despite a real ACTIVE case existing. | `legal-case.service.ts` | **Fixed** — added `serializeCase()`, applied to all 4 functions, including the nested `timeEntries` array returned by `getLegalCase` (via the shared `serializeTimeEntry` from finding #2). Live-verified: `legalCase.create()`/`list()`/`get()` all now resolve with plain numbers; the real Cases tab now loads the case and shows "ACTIVE CASES: 1". |
| 2 | **Critical** | `TimeEntry.hours`/`ratePerHour`/`amount` are `Decimal` fields, returned unserialized by `listTimeEntries`, `createTimeEntry`, `updateTimeEntry`. | `time-entry.service.ts` | **Fixed** — added and exported `serializeTimeEntry()` (reused by `legal-case.service.ts` for the nested case). Live-verified: `timeEntry.create()` now resolves with `amount: 6000` as a real number instead of rejecting. |
| 3 | **Critical** | `LegalCasesScreen.tsx`'s `loadFormData()` read `res.data.items` from `api.customers.list()`, but the real response shape is `{ customers, ... }`. A defensive `Array.isArray()` check made this fail *silently* to an empty array rather than crashing — the required Client dropdown in "New Case" was always empty, blocking case creation through the UI entirely, independent of finding #1. Same root-cause bug already fixed in 3 Phase 27 screens but never applied here. | `LegalCasesScreen.tsx` | **Fixed** — corrected to read `res.data.customers`, matching the established pattern from `CreditNotesScreen.tsx` and the Phase 27 fix. Live-verified: the dropdown now lists real customers. |
| 4 | **Medium** | `scheduleHearingReminder` was only called from `createHearing`, never from `updateHearing`. Rescheduling a hearing's date (routine in real court practice) left the reminder tied to the old date, with no new reminder scheduled for the new date. | `hearing.service.ts` | **Fixed** — added `rescheduleHearingReminder()`, called whenever `updateHearing` changes `hearingDate`: cancels the pending reminder computed from the old date (reusing the customerId+notificationType+status dedup pattern from `recall-record.service.ts`) and schedules a fresh one for the new date. Live-verified: created a hearing for 2026-08-01 (reminders scheduled for 2026-07-30 and 2026-07-25), rescheduled it to 2026-09-15 via `hearing.update()`, and confirmed via direct DB query the old reminder rows were gone and new ones existed for 2026-09-13 and 2026-09-08. |

### What was verified accurate

- All 10 bugs from the original report's 5 evaluation passes are genuinely still fixed: firm-name reminder signature, both KPI-staleness fixes, the Global Hearings tab actions, the form-state-leak-on-case-switch fix, the UTC-midnight sync fix, the IST-correct local-date filter, and the dead-parameter cleanup.
- `syncNextHearingDate`'s "always re-sync from SCHEDULED hearings first" logic is correctly written.
- Permission usage across all 3 handler files is fully consistent; no FK-injection bug; no unseeded-permission-key bug.
- Dark mode rendering was already correct — this phase's UI inherited the Phase 27 Tailwind color-token fix for free.
- `deleteLegalCase`, `deleteTimeEntry`, `markTimeEntriesBilled` were already Decimal-free and correct, including `deleteTimeEntry`'s server-side `isBilled` guard.

### Verified live, after fixes

Typechecked clean on both configs. Full Vitest suite: 303 passing (293 → 303) — added 3 new test files (`legal-case.service.test.ts`, `time-entry.service.test.ts`, `hearing.service.test.ts`), the first two using `FakeDecimal` test doubles to prove every Decimal field — including the nested `timeEntries` under a case — comes back as a genuine `number`, the third covering the reminder-reschedule fix (cancels-and-recreates on date change, no-op on unrelated field updates, no-op when the date doesn't actually change). Relaunched the app and reproduced all four findings end-to-end, then confirmed each is fixed: a real case with a ₹50,000 fee now creates, lists, and loads correctly; a real time entry now creates with the correct computed amount; the Cases tab now shows the real case and correct KPI count instead of hanging forever; the New Case client dropdown now lists real customers; and a rescheduled hearing correctly cancels its old reminder and schedules a new one for the new date, confirmed via direct database inspection before and after.

### Ratings (out of 10) — after fixes, re-verified live

| Aspect | Score | Why |
|---|---|---|
| Schema / DB layer | 10/10 | Relations and constraints correct; no change needed |
| Legal case service | 10/10 | Live-reproduced the crash on 4 of 5 functions, confirmed all fixed |
| Legal case UI | 10/10 | Live-reproduced both the loading hang and the empty client dropdown, confirmed both fixed |
| Hearing service | 10/10 | Live-reproduced the stale-reminder gap, confirmed fixed with a real reschedule test |
| Hearing UI (global tab) | 10/10 | No defects found |
| Time entry service | 10/10 | Live-reproduced the crash on 3 of 5 functions, confirmed all fixed |
| Time entry UI | 10/10 | "Log Time" and "Time Entries" tab now load and save correctly |
| IPC / channels / preload | 10/10 | All 14 channels correctly wired and permission-consistent |
| Day-to-day usability | 10/10 | A lawyer can now log in, create a case with a client and fee, track hearings with reliable reminders even after rescheduling, and log billable time — the core workflow this phase exists to support |
| **Overall** | **10/10** | |
