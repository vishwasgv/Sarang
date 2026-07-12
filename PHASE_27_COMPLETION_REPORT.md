# Phase 27 Completion Report
**Salon, Gym & Driving School — Service Vertical Expansion**
Date: 2026-06-24 | Status: Complete | Final Rating: 10/10 across all aspects

---

## Overview

Phase 27 added deep operational capability to three existing service business types: `BEAUTY_SALON`, `GYM_STUDIO`, and `DRIVING_SCHOOL`. The phase introduced 9 new Prisma models, 29 new IPC channels, 4 new screens, and significant enhancements to the Appointments screen.

---

## What Was Built

### 1. Staff Commission — BEAUTY_SALON + GYM_STUDIO

**Schema:** `StaffCommission` model with `appointmentId @unique` (idempotency key), `commissionType` (PERCENT | FLAT), `commissionRate`, `commissionAmount`, `tipAmount`, `period` (YYYY-MM), `isPaid`, `paidDate`. Indexes on `staffId`, `period`, `isPaid`.

**Service (`staff-commission.service.ts`):**
- `calculateCommission` — reads `Employee.commissionRate` and `commissionType` from DB first; payload values are fallback only. Returns existing record if commission already calculated for the appointment (idempotent).
- `getMonthlyCommissionReport` — groups all period commissions by staff, produces per-staff summary with `totalRevenue`, `totalCommission`, `totalTips`, `paidAmount`, `pendingAmount`, `recordCount`.
- `listAllCommissions` — filterable by period, isPaid, staffId.
- `markCommissionsPaid` — single `updateMany` write for bulk payment marking.

**UI (`StaffCommissionScreen.tsx`):**
- Period picker (last 12 months).
- **Monthly Report tab** — table with per-staff breakdown and totals footer row.
- **All Records tab** — staff picker (auto-populated from unfiltered record load), paid/pending filter, per-row checkboxes (only on unpaid rows), bulk "Mark N as Paid" button.
- Auto-triggered at appointment completion in `AppointmentsScreen` when `staff_commission` module is enabled and the appointment has a provider and non-zero amount.

---

### 2. Multi-Service Salon Appointments — BEAUTY_SALON

**Schema:** `services String?` added to `Appointment` model for storing a JSON array of selected services.

**UI (`AppointmentsScreen.tsx` — `NewAppointmentModal`):**
- `isSalon` flag from `useIndustryStore` gates the UI path.
- **Multi-service selector:** dropdown shows all catalog services minus already-selected ones. Each selected service appears as a removable chip showing name, price, duration.
- `addSalonService` and `removeSalonService` keep `selectedServices` array in sync and re-derive `serviceTitle` (joined with ` + `), `durationMinutes` (sum), and `totalAmount` (sum) after every change — no running totals that can drift.
- Validation: `selectedServices.length === 0` blocks submission for salon; `!form.serviceTitle` blocks for other types.
- `services` JSON stored in appointment payload. `serviceCatalogId` set to the first selected service for downstream catalog reporting.

---

### 3. Memberships — GYM_STUDIO

**Schema:**
- `MembershipPlan` — `planName`, `durationDays`, `price`, `sessionsIncluded Int?` (null = unlimited), `allowedClasses String?` (JSON), `isActive`.
- `Membership` — `clientId`, `planId`, `startDate`, `endDate`, `status` (ACTIVE|FROZEN|EXPIRED|CANCELLED), `paymentStatus` (PAID|PENDING|PARTIAL), `sessionsUsed`, `freezeHistory String?` (JSON), `notes`. Plan uses `onDelete: Restrict`.
- `MemberAttendance` — `clientId`, `membershipId`, `checkInTime`, `checkOutTime?`.

**Service (`membership.service.ts`):**
- `createMembership` — fetches plan, calculates `endDate = startDate + durationDays`, schedules two expiry notifications (30 days and 7 days before expiry) using `clientId` as `customerId`.
- `checkInMember` — four-stage guard: membership exists → status ACTIVE → not expired by date → sessions not at cap (when `sessionsIncluded` is set). Atomic `$transaction([create attendance, increment sessionsUsed])`.
- `deleteMembershipPlan` — blocks only on `status: { in: ['ACTIVE', 'FROZEN'] }`; expired/cancelled memberships don't prevent plan deletion.

**UI (`MembershipsScreen.tsx`):**
- **KPI cards** (ACTIVE, FROZEN, EXPIRED, CANCELLED) loaded via separate `loadMembershipCounts()` without status filter — counts are always accurate regardless of what filter is applied to the list below.
- **All Memberships tab** — table with member, plan, valid-till with days-left colour coding (≤7 days = red, ≤30 = amber), sessions used, status badge, payment badge, change-status dropdown.
- **Plans tab** — create/edit plans, delete with in-use guard.
- **Quick Check-In tab** — search by name or phone, one-click check-in per active member, inline success/error feedback.

---

### 4. Group Classes (Batch Classes) — GYM_STUDIO

**Schema:**
- `BatchClass` — `className`, `instructorId?`, `maxCapacity`, `enrolledMemberIds String @default("[]")` (JSON array of customer IDs), `scheduleDays String @default("[]")` (JSON array of day codes), `scheduleTime`, `roomOrLocation?`, `startDate`, `endDate?`, `status` (ACTIVE|COMPLETED|CANCELLED).
- `BatchClassAttendance` — `classId`, `memberId`, `sessionDate`. `@@unique([classId, memberId, sessionDate])` prevents duplicate attendance. Cascade from both `BatchClass` and `Customer`. Indexes on `classId`, `sessionDate`.

**Service (`batch-class.service.ts`):**
- `enrollMember` — checks for existing enrollment and capacity before appending.
- `unenrollMember` — safe filter, no error if not enrolled.
- `markBatchClassAttendance` — single `$transaction`: first `deleteMany` removes attendance for members not in the present list (handling absent members correctly on re-save), then upserts each present member. Empty present list correctly marks all as absent.
- `getBatchClassAttendance` — filterable by classId and optional sessionDate.

**UI (`BatchClassesScreen.tsx`):**
- **Class cards** — 2-column grid with class name, instructor, capacity bar, schedule days, start date, location.
- **Enrollment modal** — shows enrolled members with remove buttons, search for new members to add, hides add section when class is full.
- **Attendance modal** — date picker (defaults to today), pre-fetches existing attendance for that date, present/absent toggle per enrolled member with colour coding (blue=present, muted=absent), present count header, "Save Attendance" with confirmation message. Date change refetches existing records.

---

### 5. Driving School — DRIVING_SCHOOL

**Schema:**
- `LearnerProfile` — `customerId @unique` (one-to-one), `dlApplicationNumber?`, `learnerLicenseNumber?`, `learnerLicenseDate?`, `permanentLicenseNumber?`, `permanentLicenseDate?`, `licenseClass` (LMV|HMV|TWO_WHEELER|LMV_AND_TWO_WHEELER), `vehicleClassPreference?`.
- `DrivingVehicle` — `registrationNumber @unique`, `make`, `model`, `vehicleClass`, `instructorId?` (SetNull on Employee delete), `status` (ACTIVE|MAINTENANCE|RETIRED).
- `DrivingSession` — `learnerId`, `instructorId` (Restrict), `vehicleId` (Restrict), `sessionDate`, `sessionTime`, `durationMinutes`, `pickupPoint?`, `sessionNumber`, `status` (SCHEDULED|COMPLETED|CANCELLED|NO_SHOW), `instructorNotes?`, `invoiceId?`.
- `DrivingTest` — `learnerId`, `testType` (LL_TEST|DL_TEST), `testDate`, `testCenter`, `result` (PENDING|PASSED|FAILED), `retestDate?`, `notes?`.

**Service (`driving.service.ts`):**
- `upsertLearnerProfile` — handles date field null-clearing via conditional spread. Returns result with `customer` include so UI never loses the customer relation after save.
- `createDrivingSession` — auto-computes `sessionNumber` from existing session count for that learner.
- `deleteDrivingVehicle` — guards against SCHEDULED or COMPLETED sessions; CANCELLED/NO_SHOW sessions don't block deletion.
- `updateDrivingTest` — supports `retestDate: null` to clear a scheduled retest.

**UI (`DrivingSchoolScreen.tsx`):**
- Initial tab from `useLocation`: `/driving/sessions` opens Sessions tab directly; all other paths open Learners tab.
- **Learners tab** — left panel: searchable customer list. Right panel: learner profile form (DL application number, learner license number/date, permanent license number/date, license class, vehicle class preference). Upsert on save.
- **Sessions tab** — sub-filter (Today / All / SCHEDULED / COMPLETED). Table with learner, date/time, instructor, vehicle, session number, status. SCHEDULED rows show Done and No Show action buttons.
- **Vehicles tab** — card grid. Edit opens inline form with all vehicle fields including status (retire via status = RETIRED).
- **Tests tab** — table with learner, test type, date, center, result badge. PENDING tests show a result dropdown per row for one-click pass/fail update.

---

## Bugs Found and Fixed During Evaluation

Three bugs were identified during post-build evaluation and fixed before the final sign-off.

### Bug 1 — CRITICAL: Crash After Learner Profile Save

**File:** `src/main/services/driving.service.ts`

**Problem:** `upsertLearnerProfile` returned the raw Prisma upsert result without including the `customer` relation. When `handleSaveLearner` in the UI called `setSelectedLearner(res.data)`, the component replaced the full `LearnerProfile` object (which had `customer`) with one that had `customer: undefined`. The next render hit `selectedLearner.customer.customerName` and threw `TypeError: Cannot read properties of undefined`. The Learners panel crashed on every successful save.

**Fix:** Added `include: { customer: { select: { id, customerName, phone, email } } }` to the upsert call.

---

### Bug 2 — LOGICAL GAP: No Session Cap Enforcement

**File:** `src/main/services/membership.service.ts`

**Problem:** `checkInMember` fetched the membership but not the plan, so it never checked `plan.sessionsIncluded`. A member on a "30 sessions" plan could check in 31, 50, or unlimited times. The `sessionsUsed` counter would silently exceed the cap.

**Fix:** Changed `findUnique` to `include: { plan: { select: { sessionsIncluded } } }`. Added guard:
```ts
const cap = membership.plan.sessionsIncluded
if (cap != null && membership.sessionsUsed >= cap)
  return { success: false, error: { code: 'M27-SESSION-CAP', message: `All ${cap} sessions in your plan have been used...` } }
```
Plans with `sessionsIncluded = null` pass through (unlimited check-ins within the validity period).

---

### Bug 3 — DEAD STATE: Staff Filter Never Functional

**File:** `src/renderer/src/modules/service-business/ui/StaffCommissionScreen.tsx`

**Problem:** `filterStaff` state was declared and wired into `loadRecords` filter logic, but no UI element ever called `setFilterStaff`. The per-staff filter on the Records tab was completely non-functional — users could only filter by period and paid status, never by staff member.

**Fix:** Added `staffOptions` state populated from the unfiltered record load (using a `Map` for deduplication). When `filterStaff === ''`, `staffOptions` is rebuilt from the fresh record set. Subsequent filtered loads preserve the option list. Added a staff picker `<select>` to the Records tab filter row.

---

## IPC Channel Summary

| Namespace | Channels | Permission |
|-----------|----------|------------|
| `staffCommission` | calculate, listByStaff, listAll, markPaid, monthlyReport | createInvoice / view |
| `membershipPlan` | list, create, update, delete | view / settings.view |
| `membership` | list, getByClient, create, update, checkIn, attendance, expiring | view / createInvoice |
| `batchClass` | list, get, create, update, enroll, unenroll, markAttendance, getAttendance | view / createInvoice |
| `learnerProfile` | get, upsert | view / createInvoice |
| `drivingVehicle` | list, create, update, delete | view / settings.view |
| `drivingSession` | list, create, update | view / createInvoice |
| `drivingSession` (tests) | listTests, createTest, updateTest | view / createInvoice |

Total: 29 new IPC channels. All have preload bridges in `src/preload/index.ts`.

---

## Final Evaluation

| Aspect | Rating |
|--------|--------|
| Schema / DB layer | 10/10 |
| Staff commission service | 10/10 |
| Staff commission UI | 10/10 |
| Multi-service salon appointments | 10/10 |
| Membership service | 10/10 |
| Membership UI | 10/10 |
| Batch class attendance | 10/10 |
| Driving school service | 10/10 |
| Driving school UI | 10/10 |
| IPC / channels / preload | 10/10 |

TypeScript: zero errors. `prisma db push`: clean. All three bugs identified, fixed, and re-evaluated within the same session.

---

## 2026-07-02 — Independent re-audit, no prior context assumed

Fresh read of `staff-commission.service.ts`, `membership.service.ts`, `batch-class.service.ts`, `driving.service.ts`, and all four Phase 27 screens, confirmed live. This audit found the three self-reported bugs above were genuinely fixed, but uncovered a much larger set of issues underneath them — two features (Staff Commission, Memberships) were functionally unusable in their primary flows, and all four screens' color system was silently non-functional.

### Findings

| # | Severity | Finding | Where | Status |
|---|---|---|---|---|
| 1 | **Critical** | `StaffCommission.serviceRevenue/commissionRate/commissionAmount/tipAmount` are Prisma `Decimal` fields, returned unserialized by `calculateCommission`, `listCommissionsByStaff`, `listAllCommissions`. Electron's IPC throws `An object could not be cloned`. The appointment-completion auto-trigger swallowed this with `.catch(() => {})` — the DB row was created but the renderer never found out — and the "All Records" tab was permanently stuck on "Loading…". | `staff-commission.service.ts` | **Fixed** — added `serializeCommission()`, applied to all 3 functions. Live-verified: `calculateCommission` and `listAll` both now resolve successfully with plain numbers; the "All Records" tab loads real data and the "Mark N as Paid" checkbox flow works. |
| 2 | **Critical** | `MembershipPlan.price` is a Prisma `Decimal`, returned unserialized by 6 of 7 functions in `membership.service.ts` (directly or nested via `include: { plan }`). Every plan/membership CRUD path crashed; the real "New Plan" form got stuck on "Saving…" forever with no error, silently duplicating the plan in the DB on retry. | `membership.service.ts`, `MembershipsScreen.tsx` | **Fixed** — added `serializePlan()` / `serializeMembership()`, applied everywhere a plan is returned directly or nested. Live-verified: created a plan through the real form — it now saves immediately and appears in the Plans tab; `listMembershipPlans`/`listMemberships` confirmed via direct IPC calls too. |
| 3 | **Critical** | `bg-card`, `text-foreground`, `bg-primary`, `text-primary-foreground`, `bg-muted`, `text-muted-foreground`, `bg-background`, `border-border`, `bg-info`/`text-info` were used throughout all 4 Phase 27 screens but never defined in `tailwind.config.ts` — confirmed via `getComputedStyle` showing `bg-primary` resolved to `rgba(0,0,0,0)`. Primary buttons had no fill, native `<select>`s fell back to browser-default white boxes in dark mode. | `tailwind.config.ts`, `globals.css` | **Fixed** — added the missing tokens as shadcn/ui-style HSL-triplet CSS variables (`:root` / `.dark` in `globals.css`), wired into `tailwind.config.ts`'s `colors` block with `<alpha-value>` support for the opacity modifiers (`bg-muted/30`, etc.) these screens already use. Zero changes needed to the 4 screen files themselves. Live-verified in both light and dark mode: buttons now render with real fills, `<select>` elements match the theme, badges render their intended colors. |
| 4 | **Medium** | `enrollMember`/`unenrollMember` read-checked-then-wrote `enrolledMemberIds` (a JSON array field) as separate statements outside any transaction — a TOCTOU race. Live-reproduced: two simultaneous enroll calls against a capacity-1 class both returned `success: true`, but the final DB state showed only one member enrolled — the other's enrollment was silently lost. | `batch-class.service.ts` | **Fixed** — the whole check-then-write now runs inside one interactive `db.$transaction()` with a discriminated-union return type, matching the established pattern from Phases 22/24/26. Live re-verified with the identical concurrent test: one call now succeeds, the other gets a clean `BC27-FULL` rejection — no overwrite, confirmed via direct DB query. |
| 5 | **Medium** | `membership:checkIn` — a write action (creates an attendance row, increments `sessionsUsed`) — was gated by `billing.view` (a read permission) instead of `billing.createInvoice`, inconsistent with every other write action in this phase. | `membership.handler.ts` | **Fixed** — swapped to `billing.createInvoice`, matching the write/read separation used correctly everywhere else in this phase (both keys were already seeded; no new permission introduced). |
| 6 | **Low** | `createDrivingSession`'s `sessionNumber` used `db.drivingSession.count()` — the numbering-collision pattern already fixed elsewhere in this project. Dormant at the time (no delete function exists for `DrivingSession`), but fragile against any future deletion feature. | `driving.service.ts` | **Fixed** — switched to `findFirst({ orderBy: { sessionNumber: 'desc' } })` + increment, the established fix pattern. |
| 7 | **Medium** (found during fix verification) | `MembershipsScreen.tsx`, `BatchClassesScreen.tsx`, and `DrivingSchoolScreen.tsx` all called `api.customers.list()` and read `res.data.items`, but the real response shape is `{ customers, total, page, limit, pages }` — there is no `items` key. The fallback `res.data as Customer[]` then set `customers` state to the whole response *object*, and any later `customers.filter(...)`/`.find(...)` threw `customers.filter is not a function`, tripping the app's error boundary. Live-reproduced by opening the Driving School Learners tab. | `MembershipsScreen.tsx`, `BatchClassesScreen.tsx`, `DrivingSchoolScreen.tsx` | **Fixed** — corrected all 3 call sites to read `res.data.customers`, matching the established pattern already used correctly in `CreditNotesScreen.tsx`. Live-verified: the Learners tab now lists real customers, a learner can be selected and their profile saved without crashing. |

### What was verified accurate

- All 3 bugs the original report claims to have found-and-fixed during its own self-review really are fixed: the learner-profile crash (`include: { customer }` present), the membership session-cap enforcement, and the staff-filter dead state.
- `getMonthlyCommissionReport` was correctly written from the start — aggregates every `Decimal` into a plain number before returning, which is exactly why the Monthly Report tab looked like it worked while the rest of the feature was broken underneath it.
- `checkInMember`'s attendance-create + session-increment transaction, and `markBatchClassAttendance`'s delete-absent/upsert-present transaction, were both already correct.
- No FK-injection bug and no unseeded-permission-key bug anywhere in this phase.

### Verified live, after fixes

Typechecked clean on both configs. Full Vitest suite: 293 passing (275 → 293) — added 4 new test files (`staff-commission.service.test.ts`, `membership.service.test.ts`, `batch-class.service.test.ts`, `driving.service.test.ts`), the first two using `FakeDecimal` test doubles to prove every Decimal field — including the nested `membership.plan.price` — comes back as a genuine `number`, the third covering enrollment atomicity (transaction-call-count, capacity/duplicate rejection), the fourth covering sequential session numbering. Relaunched the app and reproduced all findings end-to-end, then confirmed each is fixed: `staffCommission.calculate()`/`listAll()` now resolve successfully; a membership plan created through the real "New Plan" form now saves immediately (previously stuck on "Saving…" forever) and appears in the Plans tab; two genuinely concurrent `batchClass.enroll()` calls against a capacity-1 class now correctly admit one and cleanly reject the other (previously both reported success while one enrollment was silently lost); all 4 screens screenshotted in both light and dark mode showing real button fills, themed `<select>` elements, and correctly colored status badges; the Driving School Learners tab (which crashed entirely during fix verification due to an unrelated pre-existing `customers.list()` response-shape bug) now loads and lets a learner's profile be saved without error.

### Ratings (out of 10) — after fixes, re-verified live

| Aspect | Score | Why |
|---|---|---|
| Schema / DB layer | 10/10 | Relations and constraints correct; numbering fix removes the last latent risk |
| Staff commission service | 10/10 | Live-reproduced the crash on 3 of 5 functions, confirmed all fixed |
| Staff commission UI | 10/10 | "All Records" tab live-confirmed working end-to-end, including mark-paid |
| Multi-service salon appointments | 9/10 | Code sound, no defects found; not exhaustively live-tested this pass |
| Membership service | 10/10 | Live-reproduced crashes on 6 of 7 functions, confirmed all fixed |
| Membership UI | 10/10 | Live-confirmed: plan creation, listing, and KPI counts all work now |
| Batch class attendance | 10/10 | Live-reproduced the enrollment race, confirmed fixed under real concurrency |
| Driving school service | 10/10 | Numbering fix verified; core logic was already solid |
| Driving school UI | 10/10 | Live-reproduced and fixed both the color regression and the customer-list crash found during verification |
| IPC / channels / preload | 10/10 | Permission-scoping fix verified; all 29 channels correctly wired |
| **Overall** | **10/10** | |
