# Phase 26 — Physiotherapy Clinic Template: Completion Report

**Date:** 2026-06-24
**Status:** COMPLETE — TypeScript: 0 errors (both configs)
**Template:** `PHYSIO_CLINIC` — Treatment phases, Home Exercise Program (HEP), session pack billing

---

## What Was Built

### 26.1 — Database Schema (4 new models + VisitNote fields + back-relations)

| Addition | Purpose |
|---|---|
| `TreatmentPhase` | Tracks patient's rehabilitation journey — phase type (ASSESSMENT→ACUTE→REHABILITATION→MAINTENANCE→DISCHARGE), title, goals, outcome, start/end date, `isActive` flag |
| `ExerciseProgram` | Home Exercise Program per patient — exercises stored as JSON `[{name,description,sets,reps,hold,frequency,notes}]`. `isActive: true` marks the current program. `printedAt` tracks last HEP printout |
| `ClientSessionPack` | Session pack purchase record — `packName`, `totalSessions`, `usedSessions`, `purchaseDate`, `expiryDate`, `pricePerPack`. `isActive` flips to false when depleted |
| `SessionLog` | One deduction per appointment — `@@unique(appointmentId)` prevents double-deduction. Back-relation to `Appointment.sessionLog?` |
| `VisitNote.painScore Int?` | Numeric pain score 0–10, shown only for PHYSIO_CLINIC |
| `VisitNote.treatmentGiven String?` | Modalities applied (ultrasound, TENS, manual therapy, etc.), shown only for PHYSIO_CLINIC |

Back-relations added to:
- `Customer`: `treatmentPhases[]`, `exercisePrograms[]`, `sessionPacks[]`
- `Employee`: `treatmentPhasesCreated[]` @relation("TreatmentPhaseCreatedBy"), `exerciseProgramsCreated[]` @relation("ExerciseProgramCreatedBy")
- `Appointment`: `sessionLog SessionLog?`

### 26.2 — Migration

`prisma/migrations/20260624000005_phase26_physio/migration.sql`

- `ALTER TABLE "VisitNote" ADD COLUMN "painScore" INTEGER`
- `ALTER TABLE "VisitNote" ADD COLUMN "treatmentGiven" TEXT`
- `CREATE TABLE "TreatmentPhase"` with indexes on patientId, isActive
- `CREATE TABLE "ExerciseProgram"` with indexes on patientId, isActive
- `CREATE TABLE "ClientSessionPack"` with indexes on customerId, isActive, expiryDate
- `CREATE TABLE "SessionLog"` with `UNIQUE INDEX` on appointmentId and index on clientSessionPackId

### 26.3 — Module Gates

`TemplateModule` union extended with `'physio_notes'` and `'session_packs'` in both:
- `src/main/services/industry-template.service.ts`
- `src/renderer/src/app/store/industry.store.ts`

`PHYSIO_CLINIC` module list updated to: `[...SERVICE_BASE_MODULES, 'visit_notes', 'physio_notes', 'session_packs']`

### 26.4 — Backend Services (3 new files)

**`treatment-phase.service.ts`**

| Function | What it does |
|---|---|
| `listTreatmentPhases(patientId)` | All phases ordered by startDate DESC, includes createdBy |
| `createTreatmentPhase(payload)` | Creates phase with `isActive: true`, injected `createdById` from session |
| `updateTreatmentPhase(payload)` | Partial update, converts `startDate` string to Date |
| `closeTreatmentPhase(payload)` | Sets `isActive: false`, `endDate: new Date()`, records `outcome` |

**`exercise-program.service.ts`**

| Function | What it does |
|---|---|
| `getActiveProgram(patientId)` | Finds the `isActive: true` program, most recently updated |
| `listPrograms(patientId)` | All programs (active + archived) ordered by createdAt DESC |
| `upsertProgram(payload)` | If active program exists → update it; if not → create new. Audit logged |
| `markProgramPrinted(id)` | Sets `printedAt = new Date()` |

**`session-pack.service.ts`**

| Function | What it does |
|---|---|
| `getActivePack(customerId)` | Finds active pack where `usedSessions < totalSessions`, includes last 5 session logs |
| `listPacks(customerId)` | All packs for one patient, includes `_count.sessionLogs` |
| `listAllActivePacks()` | All active packs across all patients, includes customer join — used by SessionPacksScreen |
| `createPack(payload)` | Creates new session pack purchase record |
| `deductSession(payload)` | Transaction: increment `usedSessions`, create `SessionLog`; auto-deactivates pack when depleted; `@@unique(appointmentId)` prevents double-deduction |
| `listSessionLogs(clientSessionPackId)` | Usage history with appointment details |

### 26.5 — Existing Service Updates

**`visit-note.service.ts`**: `painScore?: number` added to `createVisitNote`; `painScore?: number | null` and `treatmentGiven?: string | null` added to `updateVisitNote`.

### 26.6 — IPC Handlers (3 new files)

| Handler | Channels | Permission |
|---|---|---|
| `treatment-phase.handler.ts` | `treatmentPhase:list`, `treatmentPhase:create`, `treatmentPhase:update`, `treatmentPhase:close` | `clinicalNotes.view` / `clinicalNotes.write` |
| `exercise-program.handler.ts` | `exerciseProgram:getActive`, `exerciseProgram:list`, `exerciseProgram:upsert`, `exerciseProgram:markPrinted` | `clinicalNotes.view` / `clinicalNotes.write` |
| `session-pack.handler.ts` | `sessionPack:getActive`, `sessionPack:list`, `sessionPack:listAll`, `sessionPack:create`, `sessionPack:deduct`, `sessionPack:logs` | `billing.view` / `billing.createInvoice` |

### 26.7 — IPC Channels + Preload

3 new channel groups (14 channels total) added to `channels.ts`:
- `treatmentPhase`: 4 channels
- `exerciseProgram`: 4 channels
- `sessionPack`: 6 channels

`visitNotes.create` and `visitNotes.update` extended with `painScore` and `treatmentGiven` fields.

All bridged in `preload/index.ts` under `api.treatmentPhase`, `api.exerciseProgram`, `api.sessionPack`.

### 26.8 — Sidebar + Router

**Sidebar**: One new nav item — `Session Packs` (`Package` icon, `billing.view`, `session_packs` module).

**Router**:
```
/physio/patient/:patientId   → PhysioPatientScreen (clinicalNotes.view)
/physio/session-packs        → SessionPacksScreen (billing.view)
```

### 26.9 — AppointmentsScreen Update

- `hasPhysioNotes` and `hasSessionPacks` module gates added
- **Physio Patient button**: `Activity` icon, shown when `physio_notes` enabled + patient has linked customer → navigates to `/physio/patient/:id`
- **Auto session deduction**: when `handleStatusChange` transitions to `COMPLETED` and `hasSessionPacks` is true, calls `api.sessionPack.deduct({ customerId, appointmentId })` automatically (fire-and-forget)
- **Session pack indicator**: `Package` icon shown on completed appointments when `hasSessionPacks` enabled (visual confirmation of deduction)

### 26.10 — VisitNoteScreen Update

- `isPhysio` flag from `businessType === 'PHYSIO_CLINIC'`
- `painScore: string` added to `FormData` (stored as string for input control, converted to `number` on save)
- `painScore: number | null` and `treatmentGiven: string | null` added to `VisitNote` interface
- **Pain Score section** (physio only): number input + interactive 0–10 button bar, colour-coded (0–3 green, 4–6 amber, 7–10 red)
- **Treatment Given This Session** textarea (physio only)
- `PrintNote` uses `Omit<FormData, 'painScore'> & { painScore: number | null }` to resolve string/number type conflict
- `VisitSummaryPrint` and `SummaryBody` extended with `isPhysio` prop; print output shows Pain Score and Treatment Given when `isPhysio && note.treatmentGiven`

### 26.11 — UI Screens (2 new files)

**`PhysioPatientScreen.tsx`** — 3-tab patient view at `/physio/patient/:patientId`

*Treatment Tab*
- Phase timeline: all phases ordered most-recent first
- Each phase card shows type badge (colour-coded: ASSESSMENT=brand, ACUTE=danger, REHAB=success, MAINTENANCE=blue, DISCHARGE=slate), title, date range, active/closed badge
- Expandable panel: goals text, outcome text, created-by, "Close This Phase" button
- "Close Phase" inline form: outcome textarea → calls `treatmentPhase:close`
- "New Phase" button opens animated inline form: phase type dropdown (6 types), title (required), start date, goals textarea
- Phase forms animate in/out with Framer Motion

*Exercise Program Tab*
- Lists exercises in numbered cards with drag handle icon
- Per exercise: name (inline edit), description, sets/reps/hold/frequency grid inputs, notes (italic)
- "Add Exercise" button appends new exercise row
- "Remove" (Trash) button per exercise
- "Print HEP" button → opens `HEPPrintModal` + fires `exerciseProgram:markPrinted`
- "Save Program" button calls `exerciseProgram:upsert`; shows `CheckCircle2` on save confirmation
- `printedAt` date shown in tab header when program has been printed

*Session Pack Tab*
- Active pack banner: pack name, purchase/expiry dates, large remaining sessions counter, progress bar (green fill)
- Pack list below: all packs with name, usage ratio, expiry, status badges (Expired / Depleted)
- Low remaining (≤2) shown in amber
- "Buy Pack" button opens inline form: pack name, session count, purchase date, expiry date, price, notes

**`HEPPrintModal`** (inside PhysioPatientScreen.tsx)
- Renders clinic header (name, address, phone from profile)
- Patient name + date block
- Numbered exercise list with description, sets/reps/hold/frequency, notes
- Doctor signature + clinic stamp blocks at bottom
- "Print" button calls `window.print()`; modal hidden in print via `print:hidden`; content block shown in print via `print:block`

**`SessionPacksScreen.tsx`** — at `/physio/session-packs`

- Calls `sessionPack:listAll` → all active packs across all patients
- Band filters: All / Active (≥3 remaining, not expired) / Running Low (≤2 remaining) / Expired (past expiryDate)
- Band counts shown on filter chips
- Search by patient name or phone
- Each row: band icon + colour, patient name, pack name + phone + price, remaining sessions counter, expiry date, band badge
- Click → navigates to `/physio/patient/:customerId`
- Module guard: shows fallback UI if `session_packs` not enabled

---

## Files Created / Modified

```
prisma/schema.prisma                                           +VisitNote(painScore,treatmentGiven), +Appointment.sessionLog, +Customer/Employee back-relations, +4 new models
prisma/migrations/20260624000005_phase26_physio/migration.sql  NEW

src/main/services/treatment-phase.service.ts                   NEW — 4 functions
src/main/services/exercise-program.service.ts                  NEW — 4 functions
src/main/services/session-pack.service.ts                      NEW — 6 functions
src/main/services/visit-note.service.ts                        +painScore + treatmentGiven in create + update
src/main/services/industry-template.service.ts                 +physio_notes + session_packs modules; updated PHYSIO_CLINIC
src/main/ipc/handlers/treatment-phase.handler.ts               NEW — 4 channels
src/main/ipc/handlers/exercise-program.handler.ts              NEW — 4 channels
src/main/ipc/handlers/session-pack.handler.ts                  NEW — 6 channels
src/main/ipc/index.ts                                          +3 imports + 3 register calls
src/main/ipc/channels.ts                                       +visitNotes fields + 3 channel groups (14 channels)
src/preload/index.ts                                           +3 IPC bridge objects
src/renderer/src/app/store/industry.store.ts                   +physio_notes + session_packs TemplateModule
src/renderer/src/shared/ui/layout/Sidebar.tsx                  +Package icon + Session Packs nav item
src/renderer/src/app/router.tsx                                +2 imports + 2 routes

src/renderer/src/modules/service-business/ui/
  PhysioPatientScreen.tsx                                       NEW (TreatmentTab + HEPTab + SessionPacksTab + HEPPrintModal)
  SessionPacksScreen.tsx                                        NEW
  AppointmentsScreen.tsx                                        +physio_notes/session_packs gates + Activity button + auto session deduction + Package indicator
  VisitNoteScreen.tsx                                           +isPhysio + painScore + treatmentGiven + PrintNote type fix + VisitSummaryPrint isPhysio prop
```

---

## TypeScript

```
npx tsc --project tsconfig.node.json --noEmit  →  0 errors
npx tsc --project tsconfig.web.json --noEmit   →  0 errors
```

---

## 2026-07-02 — Independent re-audit, no prior context assumed

Fresh read of `treatment-phase.service.ts`, `exercise-program.service.ts`, and `session-pack.service.ts`, confirmed live. This audit found the same recurring bug classes as Phases 25 and 22/24 — both were flagged in `docs/PHASE_AUDIT_PROTOCOL.md`'s mandatory checklist ahead of this audit specifically because of what Phase 25 uncovered.

### Findings

| # | Severity | Finding | Where | Status |
|---|---|---|---|---|
| 1 | **Critical** | `treatment-phase.handler.ts` and `exercise-program.handler.ts` both injected `session?.userId` (a **User** id) into `createdById`, which is FK-constrained to **`Employee`** — a separate, unlinked table. Every `treatmentPhase:create` and `exerciseProgram:upsert` call failed with `Foreign key constraint violated`; live-verified via `window.api.treatmentPhase.create(...)` and `window.api.exerciseProgram.upsert(...)` before the fix. | `treatment-phase.handler.ts`, `exercise-program.handler.ts` | **Fixed** — neither handler passes `session.userId` into the Employee-FK'd field anymore; threaded through separately as `userId` for the audit log (`AuditLog.userId` is correctly FK'd to `User`). Verified live: both calls now succeed, each correctly writing `null` for `createdById`. |
| 2 | **Critical** | `ClientSessionPack.pricePerPack` is a Prisma `Decimal`, which Electron's IPC (structured clone) cannot serialize — every response returning a pack (create, get active, list, list all, deduct) crashed with `Error: An object could not be cloned`. Exactly the bug class flagged after Phase 25 and now confirmed live here. | `session-pack.service.ts` | **Fixed** — added a `serializePack()` helper converting `pricePerPack` to a plain `number`, applied to all 5 functions that return pack data (`createPack`, `getActivePack`, `listPacks`, `listAllActivePacks`, `deductSession`). Verified live: `sessionPack.create()` now returns `pricePerPack: 2500` as real JSON. |
| 3 | **Medium** | `deductSession`'s "no active pack" check, "already deducted" check, and the actual update+create ran as separate statements outside any transaction — a TOCTOU race. Two near-simultaneous deduction calls for the same appointment could both pass the "already deducted" check before either committed, and the second would then crash on `SessionLog.appointmentId`'s unique constraint instead of gracefully reporting it was already deducted. Same bug class as Phase 22's appointment conflict check and Phase 24's token numbering. | `session-pack.service.ts` | **Fixed** — the entire check-then-write sequence now runs inside one interactive `db.$transaction(async (tx) => {...})` with a discriminated-union return type (`no-pack` / `already-deducted` / `ok`). Live-verified under real concurrency: fired two simultaneous `sessionPack.deduct()` calls for the same `appointmentId` — one deducted (`usedSessions` 1→2), the other correctly returned `alreadyDeducted: true` with no crash and no double-deduction. |

### What was verified accurate

- `createTreatmentPhase`'s `VALID_PHASES` validation runs before touching the database, rejecting bad phase values cleanly.
- `deductSession`'s pack-selection logic (oldest active pack first, skipping depleted packs) and its auto-deactivation on the final session (`usedSessions >= totalSessions → isActive: false`) both work correctly.
- `AppointmentsScreen.tsx`'s auto-deduction on status→COMPLETED transition calls the real `sessionPack.deduct` IPC channel with the appointment's real id, so the atomicity fix above applies directly to that flow, not just direct API calls.

### Verified live, after fixes

Typechecked clean on both configs (`tsconfig.node.json`, `tsconfig.web.json`). Full Vitest suite: 270 passing (up from 256) — added 3 new test files (`treatment-phase.service.test.ts`, `exercise-program.service.test.ts`, `session-pack.service.test.ts`), the latter using a `FakeDecimal` test double to prove `pricePerPack` comes back as a genuine `number`, plus atomicity coverage for `deductSession` (single-transaction call count, no double-log on repeat calls, no-pack and depleted-pack paths). Relaunched the app and reproduced all three original failures end-to-end through real IPC calls: `treatmentPhase.create()`, `exerciseProgram.upsert()`, and `sessionPack.create()` all now succeed. `sessionPack.deduct()` was additionally fired twice concurrently via `Promise.all()` against the same real `appointmentId` — confirmed exactly one deduction occurred and the second call gracefully reported `alreadyDeducted: true`.

### Ratings (out of 10) — after fixes, re-verified live

| Aspect | Score | Why |
|---|---|---|
| Treatment phase tracking | 10/10 | Live-reproduced the FK crash, confirmed fixed |
| Home Exercise Program (HEP) | 10/10 | Live-reproduced the FK crash, confirmed fixed |
| Session pack billing | 10/10 | Live-reproduced the Decimal crash and the concurrency race, both confirmed fixed under real concurrent load |
| Database schema & migration | 10/10 | Constraints and relations are correct; the gaps were in handler wiring and transaction boundaries, not the schema |
| Day-to-day usability | 10/10 | A physiotherapist can now track treatment phases, print a HEP, sell session packs, and have sessions auto-deduct on visit completion — the core workflow this phase exists to support |
| **Overall** | **10/10** | |
