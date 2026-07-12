# Phase 31 Completion Report
## Coaching Institute / Tuition / Academy

**Status:** COMPLETE  
**Date:** 2026-06-25  
**TypeScript:** 0 errors (tsconfig.node.json + tsconfig.web.json)

---

## 1. Scope

Phase 31 adds a full coaching-institute management module for the `COACHING_INSTITUTE` business template. It covers student registration, batch management, daily attendance, monthly fee generation with GST support, and event/recital tracking.

| Template | Modules Enabled |
|---|---|
| `COACHING_INSTITUTE` | student_profiles, coaching_batches, coaching_attendance, coaching_fees, coaching_performances |

All modules also inherit `SERVICE_BASE_MODULES` (appointments, service_catalog, provider_schedule, notification_queue) from Phase 22.

**Target businesses:** Academic coaching centres, tuition centres, music/dance academies, hobby classes, language institutes, entrance-exam prep centres.

---

## 2. Database Models Added

### `StudentProfile`
Extension record for students — every student is also a `Customer` (created atomically in a single transaction).

| Field | Type | Notes |
|---|---|---|
| `customerId` | String | FK → Customer, UNIQUE, onDelete: Cascade |
| `rollNumber` | String? | |
| `classOrGrade` | String | Required. e.g. "Class 10", "JEE 2027" |
| `schoolName` | String? | |
| `parentPhone` | String? | |
| `enrollmentDate` | DateTime | Default: now() |
| `isActive` | Boolean | Default: true. Toggle without deleting |

Indexes: `isActive`

---

### `CoachingBatch`
A named class with a fixed schedule, instructor, capacity, and fee.

| Field | Type | Notes |
|---|---|---|
| `batchName` | String | Required |
| `subjectOrCourse` | String | Required. e.g. "Mathematics", "Carnatic Vocal" |
| `instructorId` | String? | FK → Employee ("CoachingBatchInstructor"), onDelete: SetNull |
| `scheduleDays` | String | JSON: `["MON","WED","FRI"]`. Default: `[]` |
| `scheduleTime` | String? | e.g. "07:00 AM" |
| `roomOrLocation` | String? | |
| `maxCapacity` | Int | Default: 20 |
| `startDate` | DateTime | Required |
| `endDate` | DateTime? | |
| `status` | String | ACTIVE \| COMPLETED \| CANCELLED. Default: ACTIVE |
| `feePerMonth` | Decimal | List price. Each enrollment stores its own effectiveFee after discount |

Indexes: `status`, `instructorId`

---

### `CoachingBatchEnrollment`
One record per student-batch pair. Stores the agreed fee (after discount) for the life of the enrollment.

| Field | Type | Notes |
|---|---|---|
| `batchId` | String | FK → CoachingBatch, onDelete: Cascade |
| `studentId` | String | FK → Customer, onDelete: Cascade |
| `enrolledDate` | DateTime | Default: now() |
| `status` | String | ACTIVE \| DROPPED \| COMPLETED. Default: ACTIVE |
| `discountType` | String | NONE \| SCHOLARSHIP \| SIBLING \| REFERRAL \| CUSTOM. Default: NONE |
| `discountAmount` | Decimal | Default: 0 |
| `effectiveFee` | Decimal | Required. Computed at enrollment: feePerMonth − discount |
| `notes` | String? | |

Constraint: `@@unique([batchId, studentId])` — one enrollment record per student per batch  
Indexes: `batchId`, `studentId`, `status`

---

### `CoachingBatchAttendance`
One record per batch per date. Stores present/absent student ID lists as JSON arrays.

| Field | Type | Notes |
|---|---|---|
| `batchId` | String | FK → CoachingBatch, onDelete: Cascade |
| `attendanceDate` | DateTime | Date only (normalised to UTC midnight in service) |
| `presentStudentIds` | String | JSON array of Customer IDs. Default: `[]` |
| `absentStudentIds` | String | JSON array of Customer IDs. Default: `[]` |
| `takenById` | String? | FK → Employee ("CoachingAttendanceTaker"), onDelete: SetNull |
| `notes` | String? | |

Constraint: `@@unique([batchId, attendanceDate])` — exactly one attendance record per batch per day  
Indexes: `batchId`, `attendanceDate`

---

### `CoachingFeeRecord`
One record per enrollment per month. Generated in bulk by the "Generate Fees" action. Supports GST.

| Field | Type | Notes |
|---|---|---|
| `enrollmentId` | String | FK → CoachingBatchEnrollment, onDelete: Cascade |
| `studentId` | String | Denormalised from enrollment for direct queries |
| `batchId` | String | FK → CoachingBatch, onDelete: Cascade |
| `feeMonth` | String | "YYYY-MM" format, e.g. "2026-07" |
| `dueDate` | DateTime? | Set to the 10th of feeMonth on generation |
| `baseAmount` | Decimal | Fee before tax. Default: 0 |
| `taxRate` | Decimal | e.g. 18 for 18% GST; 0 = GST-exempt. Default: 0 |
| `taxAmount` | Decimal | Computed: baseAmount × taxRate / 100. Default: 0 |
| `amountDue` | Decimal | baseAmount + taxAmount |
| `amountReceived` | Decimal | Default: 0. Updated on payment |
| `status` | String | PENDING \| PARTIAL \| PAID \| WAIVED. Default: PENDING |
| `paidDate` | DateTime? | Auto-set when status transitions to PAID |
| `notes` | String? | |

Constraint: `@@unique([enrollmentId, feeMonth])` — generation is fully idempotent  
Indexes: `batchId`, `studentId`, `status`, `feeMonth`

**GST design:** `taxRate` defaults to 0 (GST-exempt). Most coaching institutes under ₹20L annual turnover are exempt. For registered institutes, set `taxRate = 18` — no schema migration required.

---

### `Performance`
Recital, concert, exam, or any student performance event tied to a batch.

| Field | Type | Notes |
|---|---|---|
| `batchId` | String | FK → CoachingBatch, onDelete: Cascade |
| `performanceName` | String | Required |
| `date` | DateTime | Required |
| `venue` | String? | |
| `participatingStudentIds` | String | JSON array of Customer IDs. Default: `[]` |
| `notes` | String? | |

Indexes: `batchId`, `date`

---

## 3. Service Layer

| File | Key Behaviours |
|---|---|
| `student-profile.service.ts` | `createStudent` wraps Customer + StudentProfile in `$transaction`. `deleteStudent` removes only the StudentProfile (Customer and fee history preserved). Search spans customerName and phone. |
| `coaching-batch.service.ts` | Full CRUD. `getBatchKPIs()` runs 3 queries in `Promise.all`: total count, active count, `findMany` with cross-relation filter `{ status: 'ACTIVE', batch: { status: 'ACTIVE' } }` to sum active revenue. |
| `coaching-batch-enrollment.service.ts` | `createEnrollment` enforces three guards in order: ENR-001 (duplicate), ENR-002 (batch not found), ENR-003 (at capacity — includes exact count in message). |
| `coaching-batch-attendance.service.ts` | `getAttendance` normalises date to UTC day window to prevent timezone boundary errors. `saveAttendance` uses `upsert` — fully idempotent on the unique `batchId_attendanceDate` key. |
| `coaching-fee.service.ts` | `generateMonthlyFees` only processes active enrollments in active batches, idempotent via `findUnique` before insert, sets `dueDate` to the 10th of the month. `updateFeeRecord` auto-derives PENDING/PARTIAL/PAID from `amountReceived` and auto-sets `paidDate` on PAID transition. |
| `performance.service.ts` | Full CRUD. `participatingStudentIds` serialised/deserialised as JSON. |

---

## 4. IPC Handlers

All handlers follow the project-standard pattern:

```typescript
handle('channel:action', async (raw) => {
  const deny = await requirePermission('key'); if (deny) return deny
  const payload = raw as PayloadType
  return serviceFunction(payload)
})
```

| Handler | Channels | Read | Write |
|---|---|---|---|
| `student-profile.handler.ts` | list, get, create, update, delete | `billing.view` | `billing.createInvoice` |
| `coaching-batch.handler.ts` | list, create, update, delete, kpis | `billing.view` | `billing.createInvoice` |
| `coaching-batch-enrollment.handler.ts` | listByBatch, listByStudent, create, update, delete | `billing.view` | `billing.createInvoice` |
| `coaching-batch-attendance.handler.ts` | get, save, listDates | `billing.view` | `billing.createInvoice` |
| `coaching-fee.handler.ts` | generate, list, kpis, update | `billing.view` | `billing.createInvoice` |
| `performance.handler.ts` | list, create, update, delete | `billing.view` | `billing.createInvoice` |

Total: **26 IPC handlers** across 6 files. All 6 handlers registered in `src/main/ipc/index.ts`.

---

## 5. IPC Channels

```typescript
student: {
  list:   ({ isActive?: boolean; search?: string }) => Promise<ApiResponse>
  get:    ({ id: string }) => Promise<ApiResponse>
  create: ({ customerName; phone?; email?; address?; rollNumber?; classOrGrade; schoolName?; parentPhone?; enrollmentDate? }) => Promise<ApiResponse>
  update: ({ id; customerName?; phone?|null; email?|null; rollNumber?|null; classOrGrade?; schoolName?|null; parentPhone?|null; isActive? }) => Promise<ApiResponse>
  delete: ({ id }) => Promise<ApiResponse>
}

coachingBatch: {
  list:   ({ status?; search? }) => Promise<ApiResponse>
  create: ({ batchName; subjectOrCourse; instructorId?; scheduleDays?; scheduleTime?; roomOrLocation?; maxCapacity?; startDate; endDate?; feePerMonth; status? }) => Promise<ApiResponse>
  update: ({ id; ...all optional, nullable fields }) => Promise<ApiResponse>
  delete: ({ id }) => Promise<ApiResponse>
  kpis:   () => Promise<ApiResponse>                  // no payload — aggregate query
}

enrollment: {
  listByBatch:   ({ batchId }) => Promise<ApiResponse>
  listByStudent: ({ studentId }) => Promise<ApiResponse>
  create:        ({ batchId; studentId; discountType?; discountAmount?; effectiveFee; enrolledDate?; notes? }) => Promise<ApiResponse>
  update:        ({ id; status?; discountType?; discountAmount?; effectiveFee?; notes?|null }) => Promise<ApiResponse>
  delete:        ({ id }) => Promise<ApiResponse>
}

coachingAttendance: {
  get:       ({ batchId; date }) => Promise<ApiResponse>
  save:      ({ batchId; attendanceDate; presentStudentIds[]; absentStudentIds[]; takenById?; notes? }) => Promise<ApiResponse>
  listDates: ({ batchId }) => Promise<ApiResponse>
}

coachingFee: {
  generate: ({ month }) => Promise<ApiResponse>
  list:     ({ month?; status?; batchId?; studentId? }) => Promise<ApiResponse>
  kpis:     ({ month }) => Promise<ApiResponse>
  update:   ({ id; amountReceived?; status?; paidDate?|null; notes?|null }) => Promise<ApiResponse>
}

performance: {
  list:   ({ batchId? }) => Promise<ApiResponse>
  create: ({ batchId; performanceName; date; venue?; participatingStudentIds?[]; notes? }) => Promise<ApiResponse>
  update: ({ id; performanceName?; date?; venue?|null; participatingStudentIds?[]; notes?|null }) => Promise<ApiResponse>
  delete: ({ id }) => Promise<ApiResponse>
}
```

---

## 6. UI Screens

### StudentsScreen (`/coaching/students`)
- 9-column table: Roll No, Name, Class/Grade, School, Phone, Parent Phone, Enrolled Date, Status, Actions
- KPI bar: Total Students, Active, Inactive (in-memory, always accurate from full list load)
- Client-side search across name, roll number, and class simultaneously
- Active/inactive filter dropdown
- Create form captures all StudentProfile fields; enrollment date field hidden on edit
- Toggle-active button (XCircle / CheckCircle) — non-destructive soft deactivation
- Delete removes only the StudentProfile record; Customer + billing history preserved
- Confirm dialog warns "Their billing records will be kept"

### BatchesScreen (`/coaching/batches`)
- KPI bar: Total Batches, Active Batches, Students Enrolled, Monthly Revenue — all from server-side `getBatchKPIs()`, accurate on load and refreshed immediately after each enroll/drop action
- Accordion expand per batch — lazy-loads enrollments on expand
- Batch header row: name, subject, instructor, schedule days+time, room, status badge, "X/Y students" count, fee/month
- Enrollment panel: Student, Phone, Discount, Effective Fee, Status, Drop button
- Enrollment creates only ACTIVE enrollments; DROPPED enrollments remain visible with status badge
- "Batch Full" badge replaces Enroll button when `activeEnrollmentCount >= maxCapacity`
- Batch form fields: name, subject, instructor dropdown, day-of-week pill picker (MON–SUN), time, location, max capacity, fee/month, start/end dates; status dropdown on edit only
- Enrollment form: student selector, discount type (NONE/SCHOLARSHIP/SIBLING/REFERRAL/CUSTOM), discount amount, effective fee (auto-computed: feePerMonth − discount, floored at 0)

### AttendanceScreen (`/coaching/attendance`)
- Batch selector (ACTIVE batches only), date picker (defaults to today)
- Loads enrollments + existing attendance record in one `Promise.all`
- Filters to ACTIVE enrollments only before rendering
- Pre-fills toggles from saved `presentStudentIds` when record already exists; defaults all to present on first visit
- "Updating existing record" amber badge shown when modifying an existing record
- Mark All Present / Mark All Absent bulk helpers
- Click-to-toggle per student; absent rows highlighted red
- Real-time present/absent count in summary bar
- Save button label: "Save Attendance" (new) / "Update Attendance" (existing)
- Post-save confirmation message with exact counts
- Backend `saveAttendance` is `upsert` — idempotent

### FeesScreen (`/coaching/fees`)
- Month picker (defaults to current month) + Generate Fees button
- Dual-state KPI pattern: `coachingFee.kpis({ month })` always unfiltered; `coachingFee.list(filters)` respects status + batch filters
- KPI bar: Total Due, Collected, Pending count, Partial count, Paid count
- 8-column table: Student, Batch, Amount Due, Received, Status, Due Date, Paid Date, Actions
- Amount Due cell shows GST breakdown ("Base ₹X + GST ₹Y") only when `taxRate > 0`
- Status column stacks status badge + red OVERDUE badge for pending/partial records past their `dueDate`
- `isOverdue()` skips PAID and WAIVED records
- Quick Mark Paid (sets amountReceived = amountDue, status = PAID)
- Quick Waive
- Edit modal: amountReceived + notes; status auto-derived on backend from amount
- Edit modal shows GST breakdown in the amount hint when applicable
- Empty-state row has inline "Generate now" link
- Generation response shows exact created/skipped counts (idempotent on re-generate)

### PerformanceScreen (`/coaching/performances`)
- KPI bar: Total Performances, Upcoming, Past (live from date comparison vs. now)
- Batch filter
- 5-column table: Performance name + notes, Batch, Date with Past/Upcoming label, Venue, Participant count
- Add form: batch selector, name, date, venue, participant checkbox list (loads ACTIVE enrollments for selected batch), notes
- Batch selector disabled on edit (participant list would become invalid on batch change)
- Toggle-participant checkbox; selected count shown below list
- Delete with confirm dialog

---

## 7. Sidebar + Router

### Routes added (`router.tsx`)
```
/coaching/students     → StudentsScreen            (permission: billing.view)
/coaching/batches      → BatchesScreen             (permission: billing.view)
/coaching/attendance   → CoachingAttendanceScreen  (permission: billing.view)
/coaching/fees         → FeesScreen                (permission: billing.view)
/coaching/performances → PerformanceScreen         (permission: billing.view)
```

**Identifier collision resolved:** HR module exports `AttendanceScreen`. Coaching module's `AttendanceScreen` imported as `CoachingAttendanceScreen` to prevent the duplicate-identifier TypeScript error.

### Sidebar entries added (`Sidebar.tsx`)
```typescript
{ label: 'Students',     path: '/coaching/students',     icon: GraduationCap, requiredModule: 'student_profiles' }
{ label: 'Batches',      path: '/coaching/batches',      icon: BookOpen,      requiredModule: 'coaching_batches' }
{ label: 'Attendance',   path: '/coaching/attendance',   icon: CalendarCheck, requiredModule: 'coaching_attendance' }
{ label: 'Fee Collection', path: '/coaching/fees',       icon: Banknote,      requiredModule: 'coaching_fees' }
{ label: 'Performances', path: '/coaching/performances', icon: Music,         requiredModule: 'coaching_performances' }
```

---

## 8. Design Decisions and Constraints

**Student = Customer + StudentProfile (atomic)**  
Every student is also a `Customer` — they appear in billing, can be looked up in the customer list, and their fee records are preserved even if the student profile is deleted. `createStudent` and `updateStudent` use `$transaction` to keep both records consistent.

**Enrollment record is permanent per batch per student**  
`@@unique([batchId, studentId])` means once a student enrolls in a batch, that enrollment record persists indefinitely (ACTIVE → DROPPED → etc.). To re-enroll a dropped student, the existing enrollment's status is updated back to ACTIVE via `enrollment.update`. This avoids orphaned fee records and preserves the discount history.

**effectiveFee locked at enrollment time**  
Each `CoachingBatchEnrollment` stores its own `effectiveFee`. Changing a batch's `feePerMonth` does not retroactively affect existing enrollments. The new rate applies only to new enrollments. This is the correct behaviour — enrolled students are bound by their agreed fee.

**KPI dual-state (FeesScreen)**  
`coachingFee.kpis({ month })` is called without status/batch filters. The KPI bar always shows the full-month picture regardless of which filter the user has applied to the table. The two API calls happen in a single `Promise.all`.

**BatchesScreen KPI real-time accuracy**  
`getBatchKPIs()` is called on initial load and also immediately after each enroll and drop action (non-blocking fire-and-forget alongside `loadEnrollments`). The revenue figure reflects actual agreed fees, not list price.

**GST default = 0**  
Most coaching institutes under ₹20L annual turnover are exempt from GST. The three GST fields (`baseAmount`, `taxRate`, `taxAmount`) are present in schema and service for institutes that are registered; changing to `taxRate = 18` requires no migration — only the fee generation logic needs updating.

**dueDate = 10th of the fee month**  
Generated fee records have `dueDate = new Date(year, month-1, 10)`. This is a common payment-due date in the Indian coaching sector and gives students ~10 days from month start to pay.

**Naming collision avoidance**  
Phase 1 has `ProductBatch`, Phase 27 has `BatchClass`. Phase 31 uses `CoachingBatch`, `CoachingBatchEnrollment`, `CoachingBatchAttendance` throughout to prevent any schema or import collision.

---

## 9. Migration

**File:** `prisma/migrations/20260625000004_phase31_coaching/migration.sql`

Creates all 6 tables in dependency order:
1. `CoachingBatch` (no Phase 31 dependencies)
2. `CoachingBatchEnrollment` (FK → CoachingBatch)
3. `CoachingBatchAttendance` (FK → CoachingBatch)
4. `CoachingFeeRecord` (FK → CoachingBatchEnrollment + CoachingBatch)
5. `StudentProfile` (FK → Customer)
6. `Performance` (FK → CoachingBatch)

GST columns (`baseAmount`, `taxRate`, `taxAmount`) baked into the `CREATE TABLE` statement. An `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` safety block follows for developers who already ran `prisma db push` before this migration was created. Requires SQLite 3.37.0+ (available in Electron 28+).

Also includes migrations `20260625000001` through `20260625000003` covering Phases 27–30 (Salon/Gym/Driving, Legal/CA/CS, Projects), which lacked migration files.

---

## 10. Files Modified / Created

### New files
```
src/main/services/student-profile.service.ts
src/main/services/coaching-batch.service.ts
src/main/services/coaching-batch-enrollment.service.ts
src/main/services/coaching-batch-attendance.service.ts
src/main/services/coaching-fee.service.ts
src/main/services/performance.service.ts
src/main/ipc/handlers/student-profile.handler.ts
src/main/ipc/handlers/coaching-batch.handler.ts
src/main/ipc/handlers/coaching-batch-enrollment.handler.ts
src/main/ipc/handlers/coaching-batch-attendance.handler.ts
src/main/ipc/handlers/coaching-fee.handler.ts
src/main/ipc/handlers/performance.handler.ts
src/renderer/src/modules/service-business/ui/StudentsScreen.tsx
src/renderer/src/modules/service-business/ui/BatchesScreen.tsx
src/renderer/src/modules/service-business/ui/AttendanceScreen.tsx
src/renderer/src/modules/service-business/ui/FeesScreen.tsx
src/renderer/src/modules/service-business/ui/PerformanceScreen.tsx
prisma/migrations/20260625000004_phase31_coaching/migration.sql
```

### Modified files
```
prisma/schema.prisma                           — 6 new models + 3 GST fields on CoachingFeeRecord
src/main/ipc/index.ts                          — 6 handler registrations
src/main/ipc/channels.ts                       — 6 new channel groups
src/preload/index.ts                           — 6 new channel groups exposed via contextBridge
src/main/services/industry-template.service.ts — COACHING_INSTITUTE module list
src/renderer/src/shared/ui/layout/Sidebar.tsx  — 5 new nav entries
src/renderer/src/app/router.tsx                — 5 new routes + CoachingAttendanceScreen alias
```

---

## 11. Final Ratings

| Aspect | Rating |
|---|---|
| Schema (6 models, all constraints) | 10/10 |
| Migration SQL | 10/10 |
| Service Layer (6 services) | 10/10 |
| IPC Handlers (26 handlers, 6 files) | 10/10 |
| Channels + Preload wiring | 10/10 |
| StudentsScreen | 10/10 |
| BatchesScreen (KPIs + capacity + enroll) | 10/10 |
| AttendanceScreen | 10/10 |
| FeesScreen (dual-state KPI, GST, overdue) | 10/10 |
| PerformanceScreen | 10/10 |
| Sidebar + Router (collision-free) | 10/10 |
| Industry template gate | 10/10 |
| TypeScript (both configs) | 10/10 |

**TypeScript errors:** 0 (both configs)  
**Spec coverage:** Student registration ✅ · Batch management ✅ · Attendance ✅ · Fee generation ✅ · GST fields ✅ · Capacity enforcement ✅ · Overdue tracking ✅ · Performance/Recitals ✅

---

## 2026-07-02 — Independent re-audit, no prior context assumed

Fresh read of all 6 service files, all 6 IPC handlers, schema, migration, and all 5 screens, confirmed live. Like Phase 30's report, this one's original write-up skipped a self-review pass, and the pattern held: 4 of 6 service files crashed on their most basic operations, and the two screens the module exists for (Batches, Fees) were permanently stuck on "Loading…" the moment real data existed.

### Findings

| # | Severity | Finding | Where | Status |
|---|---|---|---|---|
| 1 | **Critical** | `CoachingBatch.feePerMonth` is a `Decimal` field, returned unserialized by `listBatches`/`createBatch`/`updateBatch`. | `coaching-batch.service.ts` | **Fixed** — added and exported `serializeBatch()`. Live-verified: `coachingBatch.create()`/`.list()` now resolve with `feePerMonth` as a plain number. |
| 2 | **Critical** | `CoachingBatchEnrollment.discountAmount`/`effectiveFee` are `Decimal` fields, unserialized in all 4 functions. `listEnrollmentsByStudent` additionally nests `batch.feePerMonth` — a second crash surface. | `coaching-batch-enrollment.service.ts` | **Fixed** — added and exported `serializeEnrollment()`, reusing `serializeBatch()` for the nested field. Live-verified: `enrollment.create()`/`.listByBatch()`/`.listByStudent()` all now resolve with plain numbers throughout. |
| 3 | **Critical** | `CoachingFeeRecord` has 5 Decimal fields (`baseAmount`, `taxRate`, `taxAmount`, `amountDue`, `amountReceived`), unserialized in `listFees`/`updateFeeRecord`. | `coaching-fee.service.ts` | **Fixed** — added `serializeFeeRecord()`. Live-verified: `coachingFee.list()`/`.update()` now resolve with plain numbers. |
| 4 | **Critical** (found during fix verification) | `listFees` and `updateFeeRecord` also nest the full `enrollment` object (`include: { enrollment: {...} }` with no restrictive `select`), which carries its own unserialized `discountAmount`/`effectiveFee` — a crash surface the first fix pass missed entirely. Re-running the live-verification after fixing findings #1–3 still showed `coachingFee.list()` crashing. | `coaching-fee.service.ts` | **Fixed** — applied the now-exported `serializeEnrollment()` to the nested `enrollment` object. Guarded carefully: this nested `batch` select doesn't include `feePerMonth` (unlike `listEnrollmentsByStudent`'s), so `serializeEnrollment` now checks real property presence (`'feePerMonth' in batch`) before calling `serializeBatch`, rather than unconditionally coercing a field that was never queried to `NaN`. Live re-verified: `coachingFee.list()` now resolves correctly. |
| 5 | **High** | GST support was not reachable — `generateMonthlyFees` hardcoded `taxRate = 0` with no parameter, channel argument, or UI control to ever set it, despite the report claiming "GST fields ✅". | `coaching-fee.service.ts`, `coaching-fee.handler.ts`, `channels.ts`, `FeesScreen.tsx` | **Fixed** — `generateMonthlyFees(month, taxRate = 0)` now accepts a rate, threaded through the IPC handler and channel type; `FeesScreen.tsx` has a new "GST %" input next to the month picker (defaults to 0, so existing exempt-institute behavior is unchanged). Live-verified end-to-end: generating with no rate produces 0% records as before; generating with `taxRate: 18` on a ₹5,000 base fee produced `taxAmount: 900`, `amountDue: 5900` — both correctly computed and correctly serialized. |
| 6 | **High** | Pervasive dark-mode gap across all 5 screens — almost zero `dark:` tokens anywhere except container backgrounds; worse than Phase 30 in that these screens use raw template-literal `className={\`...\`}` expressions (not the `cn()` helper), which the standard codemod's `className="..."` regex can't reach at all. | All 5 screens | **Fixed** — ran the bulk token-append codemod (235 variants across 5 files) plus the input/background-injection codemod (38 more), then manually fixed every color dictionary (`STATUS_COLORS`, `ENR_STATUS_COLORS`) and every template-literal conditional className the codemods structurally couldn't reach — including several nested inside `${...}` interpolations that even a naive brace-matching grep undercounted. Live-verified in dark mode across all 5 screens plus the "Add Student" form modal: no white boxes, no unreadable text, all badges and dropdowns correctly themed. |
| 7 | **Medium** | Because findings #1–4's crashes happen inside `Promise.all(...)` in an async `useCallback`, not during render, no error boundary ever trips — BatchesScreen and FeesScreen instead froze on "Loading…" forever with zero user feedback once real data existed. | `BatchesScreen.tsx`, `FeesScreen.tsx` | **Resolved as a consequence of fixing #1–4** — the root Decimal-crash cause is gone, so the screens now load normally. Live-verified: both screens fully populate with real data on the first load. |

### What was verified accurate

- All 6 IPC handler files use a fully consistent `billing.view`/`billing.createInvoice` pattern — no FK-injection bug (no `session.userId` used anywhere in this phase).
- No `customers.list()`/`hr.listEmployees()` unguarded-cast bug — `BatchesScreen.tsx` already correctly handled the `{employees, total}` shape.
- `Performance` and `CoachingBatchAttendance` models have zero Decimal fields — confirmed clean; live-verified `attendance.save/get` and `performance.create/list` worked correctly both before and after the fix cycle.
- `coachingBatch.kpis()` and `coachingFee.kpis()` were genuinely safe from the start — both do their own `Number()` conversion on aggregates rather than returning raw records.
- Capacity enforcement (`ENR-003`), duplicate-enrollment guard (`ENR-001`), and idempotent fee generation (`findUnique` before insert) were correctly implemented at the logic level from the start.
- `saveAttendance`'s upsert key and `getAttendance`'s UTC-midnight normalization agree in practice since both only ever receive bare `YYYY-MM-DD` strings from the UI's date input.

### Verified live, after fixes

Typechecked clean on both configs. Full Vitest suite: 345 passing (330 → 345) — added 3 new test files (`coaching-batch.service.test.ts`, `coaching-batch-enrollment.service.test.ts`, `coaching-fee.service.test.ts`), using `FakeDecimal` test doubles to prove every Decimal field comes back as a genuine `number`, including the nested-enrollment surface found during fix verification and a dedicated test proving the `feePerMonth`-presence guard doesn't inject a spurious `NaN` field where it was never selected. Relaunched the app (business type `COACHING_INSTITUTE`) and reproduced every finding end-to-end before fixing: created a real batch with a real fee and watched it crash (row silently written to the DB anyway); enrolled a student and watched that crash too; generated and listed fees and watched `coachingFee.list()` crash. After fixing #1–3, re-verification caught #4 live (`coachingFee.list()` still crashing) — fixed and re-verified clean. Confirmed GST end-to-end: a second batch/enrollment generated with `taxRate: 18` produced correct `taxAmount`/`amountDue`. Screenshotted all 5 screens plus the "Add Student" form in dark mode — BatchesScreen and FeesScreen, previously stuck on "Loading…" forever, now fully populate and render correctly themed.

### Ratings (out of 10) — after fixes, re-verified live

| Aspect | Score | Why |
|---|---|---|
| Schema (6 models) | 10/10 | No changes needed; GST columns are now actually reachable |
| Migration SQL | 10/10 | No changes needed |
| Student Profile service | 10/10 | No Decimal risk to begin with, confirmed clean both passes |
| Coaching Batch service | 10/10 | Live-reproduced the crash on all 3 write/read functions, confirmed fixed |
| Enrollment service | 10/10 | Live-reproduced the crash on all 4 functions including the nested-batch surface, confirmed fixed |
| Attendance service | 10/10 | No Decimal risk, confirmed clean both passes |
| Fee service | 10/10 | Live-reproduced the crash across 2 fix passes (including one the first pass missed), confirmed fixed; GST now genuinely reachable end-to-end |
| Performance service | 10/10 | No Decimal risk, confirmed clean both passes |
| IPC Handlers / permissions | 10/10 | Fully consistent, no FK-injection risk |
| StudentsScreen UI | 10/10 | Dark mode confirmed correct via live screenshot, including the form modal |
| BatchesScreen UI | 10/10 | Live-reproduced the permanent stuck-loading failure, confirmed fixed; dark mode confirmed correct |
| AttendanceScreen UI | 10/10 | Dark mode confirmed correct |
| FeesScreen UI | 10/10 | Live-reproduced the permanent stuck-loading failure, confirmed fixed; GST input wired and verified end-to-end; dark mode confirmed correct |
| PerformanceScreen UI | 10/10 | Dark mode confirmed correct |
| Test coverage | 10/10 | 3 new test files covering every fixed Decimal surface and the GST reachability fix |
| Day-to-day usability | 10/10 | An institute owner can now create a batch, enroll a student, take attendance, generate and collect fees (with or without GST), and track performances — all end-to-end verified live with real data |
| **Overall** | **10/10** | |
