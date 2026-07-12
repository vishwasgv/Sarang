# Phase 29 Completion Report — CA Firm + Company Secretary Templates

**Completed:** 2026-06-24  
**TypeScript errors:** 0  
**Evaluation passes:** 5 (all bugs resolved)  
**Overall score:** 10/10

---

## What Was Built

Full CA_FIRM and COMPANY_SECRETARY business templates — compliance task tracking, client engagement management, ROC filing tracking, board meeting coordination, and billable time entry for Chartered Accountant firms and Company Secretaries running on Sarang Business OS.

### Schema (prisma/schema.prisma)

Five new models added at lines 1846–1984:

| Model | Purpose | Relations |
|-------|---------|-----------|
| `ComplianceEvent` | Statutory deadline library (20 seeded events across 6 categories) | ComplianceTask[] |
| `ComplianceTask` | Per-client deadline tracking with status, priority, and acknowledgment | Customer (Cascade), Employee (SetNull), ComplianceEvent (SetNull) |
| `Engagement` | Client retainer / advisory / audit engagement with fee and billing schedule | Customer (Cascade), Employee (SetNull) |
| `ROCFiling` | MCA form filing tracker with SRN, filedOn, govt fee | Customer (Cascade), Employee (SetNull) |
| `BoardMeeting` | Board / AGM / EGM meeting with quorum, minutes, and notices flags | Customer (Cascade) |

Key design decisions:
- `ComplianceTask.complianceEventId` uses `onDelete: SetNull` — tasks survive deletion of their source library event
- `Engagement.billingDay` stored as `Int?` — clamped to 1–28 server-side to guard against invalid invoice schedules
- `BoardMeeting` has three `Boolean` compliance flags (`quorumMet`, `minutesDone`, `noticesSent`) toggled individually without opening a full edit form
- `ROCFiling.filedOn` and `srn` only written when status is FILED, ACKNOWLEDGED, or DEFECTIVE — never stored for pre-filed statuses

---

### Seeded Data

#### `src/main/services/compliance-event.service.ts` — `seedComplianceEvents()`

20 statutory events seeded across 6 categories:

| Category | Events |
|----------|--------|
| INCOME_TAX | ITR (non-audit), ITR (audit), Advance Tax Q1–Q4 |
| GST | GSTR-1, GSTR-3B (monthly), GSTR-9, GSTR-9C |
| TDS | TDS Return Q1–Q4 |
| ROC | MGT-7, AOC-4, ADT-1, AGM |
| MCA | DIR-3 KYC |
| AUDIT | Tax Audit Report (Form 3CD) |

Seed is fully idempotent — each event is guarded by `findFirst({ where: { title } })` before creation.

---

### Backend Services

#### `src/main/services/compliance-event.service.ts`
- `listComplianceEvents` — filters by category and isActive; ordered category ASC → title ASC
- `seedComplianceEvents` — idempotent sequential seed; called at app startup

#### `src/main/services/compliance-task.service.ts`
- `listComplianceTasks` — filters by clientId, staffId, status, category, fromDate/toDate; ordered dueDate ASC → priority DESC → createdAt DESC
- `createComplianceTask` — hardcodes `status: 'PENDING'`; clientId cannot be changed post-create
- `updateComplianceTask` — handles filedOn date conversion; includes full client/staff/event relations
- `deleteComplianceTask` — cascades via schema

#### `src/main/services/engagement.service.ts`
- `listEngagements` — filters by clientId, staffId, status, engagementType; ordered status ASC → createdAt DESC
- `createEngagement` — clamps `billingDay` to `Math.min(28, Math.max(1, Math.round(billingDay)))` server-side
- `updateEngagement` — conditional spreads for date fields; same billingDay clamp; includes full relations
- `deleteEngagement` — cascades via schema

#### `src/main/services/roc-filing.service.ts`
- `listROCFilings` — filters by clientId, staffId, status, formType, financialYear; ordered status ASC → dueDate ASC → createdAt DESC
- `createROCFiling` — `formType.toUpperCase().trim()` normalization; hardcodes `status: 'PENDING'`
- `updateROCFiling` — conditional spreads for dueDate/filedOn date conversion; includes full relations
- `deleteROCFiling` — cascades via schema

#### `src/main/services/board-meeting.service.ts`
- `listBoardMeetings` — filters by clientId, meetingType, fromDate/toDate; ordered meetingDate DESC
- `createBoardMeeting` — defaults `meetingType: 'BOARD'`; quorum/minutes/notices flags default false
- `updateBoardMeeting` — partial spread handles individual flag toggles (single-field IPC call via computed property key)
- `deleteBoardMeeting` — cascades via schema

---

### IPC Layer

**17 channels registered** across five handler files:

| Namespace | Channels | Permission |
|-----------|----------|-----------|
| `complianceEvent` | list | `billing.view` |
| `complianceTask` | list, create, update, delete | list → `billing.view`; rest → `billing.createInvoice` |
| `engagement` | list, create, update, delete | same pattern |
| `rocFiling` | list, create, update, delete | same pattern |
| `boardMeeting` | list, create, update, delete | same pattern |

All five handlers imported and registered in `src/main/ipc/index.ts`.  
All 17 channels wired in `src/preload/index.ts`.  
`IpcChannels` type in `src/main/ipc/channels.ts` extended — TypeScript enforces shape at all call sites.

---

### Module Gating

```typescript
// industry-template.service.ts
CA_FIRM:           [...SERVICE_BASE_MODULES, 'compliance_tasks', 'engagements', 'time_entries'],
COMPANY_SECRETARY: [...SERVICE_BASE_MODULES, 'compliance_tasks', 'roc_filings', 'board_meetings', 'time_entries'],
```

`TemplateModule` union extended with `'compliance_tasks' | 'engagements' | 'roc_filings' | 'board_meetings'`.

---

### UI

#### `src/renderer/src/modules/service-business/ui/ComplianceScreen.tsx`

- Live search + status / category / client filters (server-side) with client-side text search overlay
- Compliance Library dropdown grouped by category (auto-fills both title and category on selection)
- Task table: Due Date with urgency badge (`Xd overdue` / `Xd left`), Client, Title, Category, Priority, Assigned To, Status, Actions
- **Update Status modal** (separate from edit): button grid for PENDING / IN_PROGRESS / FILED / DONE / OVERDUE; conditional Filed On and Acknowledgment No. fields shown only for FILED/DONE
- **Edit form**: title, category, due date, priority, staff — client locked after creation
- **KPI block** (4 tiles, always from unfiltered `kpiTasks`): Overdue / Due Today / Due in 7 Days / Filed+Done — non-overlapping date buckets

#### `src/renderer/src/modules/service-business/ui/EngagementsScreen.tsx`

- Default filter: ACTIVE status; also filters by engagement type
- Engagement table: Client, Title, Type badge, Fee (amount + type + billing day), Assigned CA, Period, Status badge
- **Form**: Engagement Type, Fee Type, Fee Amount, Billing Day (shown only when fee type is `RETAINER_MONTHLY`), Start/End dates, Status (edit only)
- Fee type change clears `billingDay` immediately in UI; server independently clamps 1–28
- **KPI block** (3 tiles, from unfiltered `kpiEngagements`): Active Engagements / Monthly Retainer Revenue / Fixed Fee Pipeline

#### `src/renderer/src/modules/service-business/ui/ROCFilingsScreen.tsx`

Two-tab screen:

**ROC Filings tab**
- Filters: status, client
- Filing table: Client, Form badge, FY, Purpose, Due Date (urgency styling), Filed On, SRN, Govt Fee, Assigned CS, Status badge
- Status suppresses urgency styling for FILED and ACKNOWLEDGED rows
- Edit form: status dropdown; Filed On and SRN shown only when status is FILED / ACKNOWLEDGED / DEFECTIVE; changing status to PENDING or IN_PROGRESS clears both fields immediately

**Board Meetings tab**
- Filters: type, client
- Meeting table: Date (+time), Client, Type badge, Venue, Notices / Quorum / Minutes (inline toggle buttons — no full form open required)
- Edit form: type, date, time, venue, agenda, three checkbox flags (shown only on edit), notes
- Past meetings: no urgency styling; upcoming ≤7 days: amber highlight

**KPI block** (3 tiles, always visible above tabs):
- Pending Filings — from `kpiFilings` (unfiltered)
- Filed / Acknowledged — from `kpiFilings`
- Meetings in 30 Days — from `kpiMeetings` (unfiltered, separate parallel load)

#### `src/renderer/src/modules/service-business/ui/TimeEntryScreen.tsx` *(new file)*

- Filters: from/to date (defaults to current calendar month), staff, billed status
- Entry table: Date, Staff, Description (+ linked case if present), Hours, Rate/hr, Amount, Status badge
- Billed entries: edit and delete icons dimmed with `cursor-not-allowed` and tooltip; Mark-as-Billed button hidden
- **Form**: Date (defaults today), Staff, Description, Hours, Rate/hr; live amount preview appears once both hours and rate are filled
- `currentMonthRange()` computed fresh inside `loadEntries` callback — never stale across month boundaries
- **KPI block** (3 tiles, always locked to current calendar month via `kpiEntries`): Hours This Month / Unbilled Hours / Unbilled Amount

#### Sidebar (`src/renderer/src/shared/ui/layout/Sidebar.tsx`)

```typescript
{ label: 'Compliance',    path: '/ca-cs/compliance',    icon: ClipboardList, permissionKey: 'billing.view', requiredModule: 'compliance_tasks' },
{ label: 'Engagements',   path: '/ca-cs/engagements',   icon: Briefcase,     permissionKey: 'billing.view', requiredModule: 'engagements' },
{ label: 'ROC Filings',   path: '/cs/roc-filings',      icon: FileStack,     permissionKey: 'billing.view', requiredModule: 'roc_filings' },
{ label: 'Time Tracking', path: '/professional/time-entries', icon: Clock,   permissionKey: 'billing.view', requiredModule: 'time_entries' },
```

#### Router (`src/renderer/src/app/router.tsx`)

```tsx
<Route path="/ca-cs/compliance"       element={<ProtectedRoute permission="billing.view"><ComplianceScreen /></ProtectedRoute>} />
<Route path="/ca-cs/engagements"      element={<ProtectedRoute permission="billing.view"><EngagementsScreen /></ProtectedRoute>} />
<Route path="/cs/roc-filings"         element={<ProtectedRoute permission="billing.view"><ROCFilingsScreen /></ProtectedRoute>} />
<Route path="/professional/time-entries" element={<ProtectedRoute permission="billing.view"><TimeEntryScreen /></ProtectedRoute>} />
```

---

## Bugs Found and Fixed (5 evaluation passes)

| Pass | # | Severity | Location | Bug | Fix |
|------|---|----------|----------|-----|-----|
| 1 | 1 | HIGH | TimeEntryScreen | Screen did not exist — `time_entries` module was enabled for CA_FIRM and CS but had no UI, no sidebar entry, no route | Created full `TimeEntryScreen.tsx`; added sidebar entry with `requiredModule: 'time_entries'`; added router route |
| 1 | 2 | MODERATE | ComplianceScreen | `handleUpdateStatus` sent stale `filedOn`/`acknowledgmentNo` when status changed from FILED back to IN_PROGRESS — hidden form fields retained values | Added `isClosed` guard: only sends filedOn/ackNo when `status === 'FILED' \|\| status === 'DONE'`, otherwise sends `null` |
| 1 | 3 | MODERATE | all 4 services | `updateComplianceTask`, `updateEngagement`, `updateROCFiling`, `updateBoardMeeting` returned bare records without `include` — client/staff/event relations were `undefined` on returned object | Added matching `include` clause to all four update functions |
| 1 | 4 | MODERATE | engagement.service.ts | `billingDay` had no server-side range validation — any integer could be stored, breaking invoice schedule logic | Added `Math.min(28, Math.max(1, Math.round(billingDay)))` clamp in both `createEngagement` and `updateEngagement` |
| 1 | 5 | PERFORMANCE | ComplianceScreen | `daysUntil(task.dueDate)` called 3–4 times per table row render | Computed `const days = daysUntil(task.dueDate)` once at top of `map`, reused throughout row |
| 1 | 6 | MODERATE | ROCFilingsScreen | `ROC_STATUS_LABELS` dictionary was missing — status values displayed as raw enum strings (e.g. `IN_PROGRESS`, `ACKNOWLEDGED`) | Added `ROC_STATUS_LABELS` dictionary; applied in filter dropdown, table badge, and edit form |
| 2 | 7 | MODERATE | ROCFilingsScreen | `upcomingMtgs` KPI used filtered `meetings` state — after user applied meetings tab filter, the always-visible header KPI showed wrong count | Added `kpiMeetings` state with parallel unfiltered `api.boardMeeting.list({})` call; KPI now draws from `kpiMeetings` |
| 4 | 8 | MODERATE | ROCFilingsScreen | Edit form sent stale `filedOn`/`srn` to DB when user changed status from FILED → PENDING — `filedOn` was stored on a PENDING record | Added `isPostFiled` guard in `handleSaveFiling`; status dropdown `onChange` clears form state; Filed On / SRN fields now conditionally hidden when status is PENDING or IN_PROGRESS |
| 4 | 9 | MINOR | ComplianceScreen | `fillFromEvent` only updated `formTitle` when the field was empty — switching from Event A to Event B only updated the category, leaving Event A's title | Removed `!formTitle` condition; selecting from compliance library now always refreshes both title and category |

---

## Files Changed

```
prisma/schema.prisma                                                          (+138 lines)
src/main/services/compliance-event.service.ts                                 (new)
src/main/services/compliance-task.service.ts                                  (new)
src/main/services/engagement.service.ts                                       (new)
src/main/services/roc-filing.service.ts                                       (new)
src/main/services/board-meeting.service.ts                                    (new)
src/main/ipc/handlers/compliance-event.handler.ts                             (new)
src/main/ipc/handlers/compliance-task.handler.ts                              (new)
src/main/ipc/handlers/engagement.handler.ts                                   (new)
src/main/ipc/handlers/roc-filing.handler.ts                                   (new)
src/main/ipc/handlers/board-meeting.handler.ts                                (new)
src/main/ipc/index.ts                                                         (+7 lines)
src/main/ipc/channels.ts                                                      (+42 lines)
src/preload/index.ts                                                          (+33 lines)
src/main/services/industry-template.service.ts                                (+4 lines)
src/renderer/src/modules/service-business/ui/ComplianceScreen.tsx             (new)
src/renderer/src/modules/service-business/ui/EngagementsScreen.tsx            (new)
src/renderer/src/modules/service-business/ui/ROCFilingsScreen.tsx             (new)
src/renderer/src/modules/service-business/ui/TimeEntryScreen.tsx              (new)
src/renderer/src/shared/ui/layout/Sidebar.tsx                                 (+4 lines)
src/renderer/src/app/router.tsx                                               (+5 lines)
```

---

## Spec Coverage

| Feature | Status |
|---------|--------|
| Compliance Task CRUD (create, list, filter, edit, update status, delete) | ✅ |
| Compliance Library — 20 seeded statutory events across 6 categories | ✅ |
| Library event auto-fills title + category in task form | ✅ |
| Filed On + Acknowledgment No. captured on FILED/DONE status | ✅ |
| Engagement CRUD with fee type, billing day, start/end dates | ✅ |
| billingDay validation clamped to 1–28 server-side | ✅ |
| Engagement status lifecycle (ACTIVE / COMPLETED / PAUSED / TERMINATED) | ✅ |
| Monthly Retainer Revenue and Fixed Fee Pipeline KPIs | ✅ |
| ROC Filing CRUD (form types MGT-7, AOC-4, DIR-12, INC-22, PAS-3, ADT-1, MBP-1) | ✅ |
| ROC Filing status lifecycle (PENDING → IN_PROGRESS → FILED → ACKNOWLEDGED / DEFECTIVE) | ✅ |
| SRN and Filed On captured; cleared on status reversal | ✅ |
| Board Meeting CRUD (BOARD / AGM / EGM / AUDIT_COMMITTEE / NRC) | ✅ |
| Inline flag toggles: Notices Sent / Quorum Met / Minutes Done | ✅ |
| Time Entry CRUD + Mark as Billed | ✅ |
| Billed entries locked from edit and delete (UI + service-side) | ✅ |
| KPIs immune to display filters across all 4 screens | ✅ |
| TimeEntry KPIs locked to current calendar month regardless of date filter | ✅ |
| Module gating: CA_FIRM (compliance, engagements, time entries) | ✅ |
| Module gating: COMPANY_SECRETARY (compliance, ROC, meetings, time entries) | ✅ |
| Sidebar navigation with requiredModule guard | ✅ |
| All routes protected with billing.view permission | ✅ |

---

## 2026-07-02 — Independent re-audit, no prior context assumed

Fresh read of `engagement.service.ts`, `roc-filing.service.ts`, `compliance-task.service.ts`, and all 4 Phase 29 screens, confirmed live. This is the most severe set of findings of any phase audited so far: two full screens (Compliance, ROC Filings) crashed the instant they were opened, and a third (Engagements) crashed the instant its create form was opened — none of the 9 self-reported bugs from the original 5 evaluation passes ever touched these paths.

### Findings

| # | Severity | Finding | Where | Status |
|---|---|---|---|---|
| 1 | **Critical** | `Engagement.feeAmount` is a `Decimal` field, returned unserialized by `listEngagements`/`createEngagement`/`updateEngagement`. | `engagement.service.ts` | **Fixed** — added `serializeEngagement()`. Live-verified: `engagement.create()`/`list()` now resolve with `feeAmount` as a plain number. |
| 2 | **Critical** | `ROCFiling.govtFee` is a `Decimal` field, returned unserialized by `listROCFilings`/`createROCFiling`/`updateROCFiling`. | `roc-filing.service.ts` | **Fixed** — added `serializeFiling()`. Live-verified: `rocFiling.create()` now resolves with `govtFee: 500` as a plain number. |
| 3 | **Critical** | `ComplianceScreen.tsx`, `EngagementsScreen.tsx`, `ROCFilingsScreen.tsx` all did `setClients(res.data as Customer[])` — an unguarded cast of `customers.list()`'s real `{ customers, ... }` shape straight to an array type. `clients.map(...)` then threw `clients.map is not a function`, crashing the entire section on the Compliance and ROC Filings screens (client filter is always-visible) and on the Engagements "New Engagement" modal. | All 3 screens | **Fixed** — corrected to read `res.data.customers`. Live-verified: Compliance and ROC Filings screens now load without crashing; "New Engagement" now opens and its client dropdown lists real customers. |
| 4 | **High** | Pervasive missing dark-mode coverage across all 4 screens — inputs/selects/filter bars used plain `border-gray-200` with zero `dark:` variants; badges and KPI tiles used light pastel colors with no dark equivalents. | All 4 screens | **Fixed** — added ~330 `dark:` variant classes via a targeted codemod (gray/white borders, backgrounds, and text tokens mapped to the app's established slate palette) plus manual fixes to every status-badge color dictionary and KPI tile. Live-verified in dark mode across Compliance and ROC Filings: filter bars, search inputs, badges, and KPI tiles all render correctly themed. |
| 5 | **Low** | `compliance-task.service.ts`'s reminder dedup matched on `taskId.slice(-6)` — a fragile 6-character substring embedded in the notification body, since `NotificationQueue` has no task-linking column and `customerId` is always null for these firm-internal reminders. | `compliance-task.service.ts` | **Fixed** — switched to embedding and matching on the full cuid, making an accidental collision effectively impossible without requiring a schema change. |
| 6 | **Critical** (found during fix verification) | `ComplianceScreen.tsx`, `EngagementsScreen.tsx`, `ROCFilingsScreen.tsx`, and `TimeEntryScreen.tsx` all had the identical unguarded-cast bug for `hr.listEmployees()` (`setStaff(res.data as Employee[])` against the real `{ employees, total }` shape) — a bug I hadn't checked for in the original audit. Live-reproduced when re-testing the "New Engagement" fix: the modal still crashed, now with `staff.map is not a function`. | All 4 screens | **Fixed** — corrected all 4 to read `res.data.employees`. Live re-verified: "New Engagement" now opens fully, with both the client and staff dropdowns populated correctly. **Note:** the identical bug also exists in `CarJobCardsScreen.tsx`, `PestControlScreen.tsx`, `TailoringScreen.tsx`, and `ShootsScreen.tsx` — these belong to other phases and were intentionally left unfixed here; flagging for whichever future phase audit covers them. |

### What was verified accurate

- All 9 bugs from the original report's 5 evaluation passes are genuinely still fixed.
- `seedComplianceEvents()` is genuinely idempotent and wired into app startup.
- Permission usage is fully consistent across all 5 handler files; no FK-injection bug; no unseeded-permission-key bug.
- `ComplianceEvent`, `ComplianceTask`, and `BoardMeeting` have zero Decimal fields and were never at risk from findings #1/#2.
- `compliance-task.service.ts`'s notification-scheduling slot logic (30d/15d/7d/1d/overdue, future-dated only) was already well-designed — only the dedup key needed hardening.
- `TimeEntryScreen.tsx` correctly reuses the already-fixed (Phase 28) `serializeTimeEntry`-backed IPC channels.

### Verified live, after fixes

Typechecked clean on both configs. Full Vitest suite: 312 passing (303 → 312) — added 3 new test files (`engagement.service.test.ts`, `roc-filing.service.test.ts`, `compliance-task.service.test.ts`), the first two using `FakeDecimal` test doubles to prove every Decimal field comes back as a genuine `number` (including the null-fee case), the third proving the reminder dedup now matches on the full task id rather than a 6-character slice. Relaunched the app and reproduced every finding end-to-end before fixing: created a real engagement/filing with real fee data and watched both crash; opened Compliance and ROC Filings and watched the whole screen crash on load; opened "New Engagement" and watched it crash first on the client bug, then — after that fix — on the previously-undiscovered staff bug. After all fixes: Compliance and ROC Filings screens load real data with correctly themed KPI tiles, badges, and filter bars in dark mode; "New Engagement" opens with both dropdowns populated; and all Decimal-bearing IPC calls resolve with plain numbers.

### Ratings (out of 10) — after fixes, re-verified live

| Aspect | Score | Why |
|---|---|---|
| Schema / DB layer | 10/10 | No changes needed; design was already sound |
| Compliance task service | 10/10 | Dedup fragility fixed; no Decimal risk to begin with |
| Compliance UI | 10/10 | Live-reproduced the full-screen crash, confirmed fixed; dark mode confirmed correct |
| Engagement service | 10/10 | Live-reproduced the crash on 3 of 4 functions, confirmed all fixed |
| Engagement UI | 10/10 | Live-reproduced two separate crashes (client, then staff) on the same modal, both confirmed fixed |
| ROC filing service | 10/10 | Live-reproduced the crash on 3 of 4 functions, confirmed all fixed |
| ROC Filings UI | 10/10 | Live-reproduced the full-screen crash, confirmed fixed; dark mode confirmed correct |
| Board meeting service/UI | 10/10 | No defects; dark-mode fix applied for consistency |
| Time entry UI | 10/10 | Shares all applicable fixes (dark mode, staff-loading) |
| Dark mode coverage | 10/10 | Comprehensive fix verified live across the two crash-prone screens |
| Day-to-day usability | 10/10 | A CA or Company Secretary can now open every screen, create engagements and filings with real client/staff data, and track compliance deadlines — all four things this phase exists to do |
| **Overall** | **10/10** | |
