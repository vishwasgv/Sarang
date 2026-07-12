# Phase 24 — Medical Template: Completion Report

**Date:** 2026-06-23
**Status:** COMPLETE — TypeScript: 0 errors (both configs)
**Templates:** `GP_CLINIC` (visit notes + token queue), `SPECIALIST_CLINIC` (visit notes + referral fields)

---

## What Was Built

### 24.1 — Database Schema (2 new models + 2 back-relations on Appointment)

| Addition | Purpose |
|---|---|
| `VisitNote` | SOAP consultation note — 1:1 with Appointment, finalized flag makes it permanently read-only |
| `TokenQueue` | GP daily patient token queue — auto-increment per day, status flow WAITING → CALLED → SEEN/SKIPPED |
| `Appointment.visitNote VisitNote?` | Back-relation for include in getByDate query |
| `Appointment.tokenQueueEntry TokenQueue?` | Back-relation for token → appointment linkage |

FK semantics: `VisitNote.appointmentId → Appointment (Cascade)`, `TokenQueue.appointmentId → Appointment (SetNull)`.

Unique constraints: `VisitNote.appointmentId` (1:1 enforce), `TokenQueue(queueDate, tokenNumber)` (no duplicate tokens per day).

### 24.2 — Migration

`prisma/migrations/20260623000003_phase24_medical/migration.sql`

SQLite `CREATE TABLE` for VisitNote and TokenQueue. All indexes and constraints included. No existing tables altered.

### 24.3 — Permission Seeding

`src/main/database/seed.ts` extended with:
- `clinicalNotes.view` — View Clinical Notes
- `clinicalNotes.write` — Create & Edit Clinical Notes

Assigned to: **Admin** and **Manager** roles only. Cashier / Staff / Kitchen Staff do NOT get these permissions, matching the spec's "owner + practitioner only" restriction.

### 24.4 — Module Gates

`TemplateModule` extended with `'visit_notes'` and `'token_queue'` in both:
- `src/main/services/industry-template.service.ts`
- `src/renderer/src/app/store/industry.store.ts`

Updated template module lists:
- `GP_CLINIC`: `[...SERVICE_BASE_MODULES, 'visit_notes', 'token_queue']`
- `SPECIALIST_CLINIC`: `[...SERVICE_BASE_MODULES, 'visit_notes']`

### 24.5 — Backend Services (2 new files)

**`visit-note.service.ts`** — 5 functions:

| Function | What it does |
|---|---|
| `getVisitNote(appointmentId)` | Fetch note by appointment ID with full appointment context; writes VIEW audit log |
| `createVisitNote(payload)` | Create SOAP note with all 12 fields + audit CREATE log |
| `updateVisitNote(payload)` | Partial update; blocked if `isFinalized = true`; audit UPDATE log |
| `finalizeVisitNote(id)` | Sets `isFinalized = true`, `finalizedAt = now()`; audit FINALIZE log |
| `listVisitNotes(filters)` | Paginated list with search, isFinalized filter, date range |

**`token-queue.service.ts`** — 7 functions:

| Function | What it does |
|---|---|
| `getTodayQueue(date?)` | All tokens for a given day ordered by tokenNumber |
| `getQueueStats(date?)` | Counts by status + currentToken (last CALLED entry) |
| `createToken(payload)` | Auto-increments tokenNumber for today (MAX + 1), creates token |
| `callToken(id)` | Sets status = CALLED, calledAt = now() |
| `markSeen(id)` | Sets status = SEEN, seenAt = now() |
| `skipToken(id)` | Sets status = SKIPPED |
| `resetToken(id)` | Sets status = WAITING, clears calledAt/seenAt |

### 24.6 — IPC Handlers (2 new files)

| Handler | Channels | Permission |
|---|---|---|
| `visit-note.handler.ts` | `visitNotes:list`, `visitNotes:get`, `visitNotes:create`, `visitNotes:update`, `visitNotes:finalize` | `clinicalNotes.view` / `clinicalNotes.write` |
| `token-queue.handler.ts` | `tokenQueue:today`, `tokenQueue:stats`, `tokenQueue:create`, `tokenQueue:call`, `tokenQueue:seen`, `tokenQueue:skip`, `tokenQueue:reset` | `billing.view` / `billing.createInvoice` |

`visitNotes:create` also fetches `getCurrentSession()` to inject `createdBy: session.userId` automatically.

### 24.7 — IPC Channels + Preload

12 new typed channels added to `channels.ts` (5 visitNotes + 7 tokenQueue).
All bridged in `preload/index.ts` under `api.visitNotes` and `api.tokenQueue`.

### 24.8 — Appointment Service

`getAppointmentsByDate` now includes:
```ts
visitNote: { select: { id: true, isFinalized: true } }
```
This allows AppointmentsScreen to show per-appointment note status badges without a separate API call.

### 24.9 — Sidebar

Two new nav items:
- `Token Queue` — `Hash` icon, `billing.view` permission, `token_queue` module — visible only to GP_CLINIC
- `Clinical Notes` — `Stethoscope` icon, `clinicalNotes.view` permission, `visit_notes` module — visible to GP + Specialist

### 24.10 — Router

```
/clinical/queue              → TokenQueueScreen (billing.view)
/clinical/visit/:appointmentId → VisitNoteScreen (clinicalNotes.view)
/clinical/notes              → ClinicalNotesListScreen (clinicalNotes.view)
```

### 24.11 — AppointmentsScreen Update

Added `visitNote: { id, isFinalized } | null` to the Appointment interface.
Added `FileText` icon button per appointment row, visible only when `visit_notes` module is enabled AND user has `clinicalNotes.view`:
- Grey: no note yet → navigate to `/clinical/visit/:id`
- Amber: note exists, not finalized
- Green: note finalized

### 24.12 — UI Screens (3 new files)

**`TokenQueueScreen.tsx`**
- Header: date + "Add Walk-in" button (gated by `billing.createInvoice`)
- Big "Now Serving" display: current token number and patient name
- Count chips: Waiting / Called / Seen / Skipped
- "Call Next" button → calls lowest WAITING tokenNumber
- Queue list split into three sections: Currently Called / Waiting / Completed
- Per-token actions: Call (phone icon), Mark Seen (check), Skip (arrow), Reset (undo)
- Active token row highlighted in amber
- `AddTokenModal`: patientName, age, gender, phone, notes → issues next token

**`VisitNoteScreen.tsx`**
- Route: `/clinical/visit/:appointmentId`
- Header: back button, appointment context, Finalized badge, Print + Save + Finalize buttons
- SOAP sections: Patient Info (name, age, chief complaint), S, O, A, P, Follow-up
- Referral section shown only when `businessType === 'SPECIALIST_CLINIC'`
- Fields become read-only when `isFinalized = true`
- "Save Note" creates or updates (via `visitNotes:create` if no note exists yet, `visitNotes:update` otherwise)
- "Finalize" makes the note permanently read-only + shows finalized banner
- "Print Summary" button opens `VisitSummaryPrint` modal

**`ClinicalNotesListScreen.tsx`**
- Sidebar nav destination: `/clinical/notes`
- Filter chips: All / In Progress / Finalized
- Debounced search by patient name
- Cards: patient name, age, chief complaint preview, diagnosis preview, date/time, provider, status badge
- Click → navigates to `/clinical/visit/:appointmentId`

**`VisitSummaryPrint`** (component inside VisitNoteScreen.tsx)
- Same print pattern as VaccinationCertificate: `print:hidden` overlay + `print:block` A4 layout
- Content: clinic header (from businessStore), patient info, SOAP sections, follow-up box, referral box (specialist only), doctor signature + clinic stamp, Aszurex footer

---

## Files Created / Modified

```
prisma/schema.prisma                                          Appointment back-relations + VisitNote + TokenQueue models
prisma/migrations/20260623000003_phase24_medical/migration.sql NEW

src/main/services/visit-note.service.ts                        NEW — 5 functions
src/main/services/token-queue.service.ts                       NEW — 7 functions
src/main/ipc/handlers/visit-note.handler.ts                    NEW — 5 channels
src/main/ipc/handlers/token-queue.handler.ts                   NEW — 7 channels
src/main/ipc/index.ts                                          +2 imports + register calls
src/main/ipc/channels.ts                                       +2 channel groups (12 channels)
src/preload/index.ts                                           +2 IPC bridge objects
src/main/database/seed.ts                                      +clinicalNotes.view + clinicalNotes.write permissions
src/main/services/industry-template.service.ts                 +visit_notes + token_queue TemplateModule; updated GP/Specialist
src/main/services/appointment.service.ts                       +visitNote include in getAppointmentsByDate
src/renderer/src/app/store/industry.store.ts                   +visit_notes + token_queue TemplateModule
src/renderer/src/shared/ui/layout/Sidebar.tsx                  +Hash + Stethoscope icons + 2 nav items
src/renderer/src/app/router.tsx                                +3 imports + 3 routes

src/renderer/src/modules/service-business/ui/
  TokenQueueScreen.tsx                                          NEW
  VisitNoteScreen.tsx                                           NEW (includes VisitSummaryPrint component)
  ClinicalNotesListScreen.tsx                                   NEW
  AppointmentsScreen.tsx                                        +visitNote type + Notes button per appointment
```

---

## TypeScript

```
npx tsc --project tsconfig.node.json --noEmit  →  0 errors
npx tsc --project tsconfig.web.json --noEmit   →  0 errors
```

---

## 2026-07-02 — Independent re-audit, no prior context assumed

This phase shipped straight to "COMPLETE" with no internal self-review round (unlike Phases 22/23). This was its first independent scrutiny — a fresh read of `token-queue.service.ts` and `visit-note.service.ts`, confirmed live.

### Finding

| # | Severity | Finding | Where | Status |
|---|---|---|---|---|
| 1 | **Medium** | `createToken()` read the last token number for today via `findFirst`, then separately called `create()` — not wrapped in a transaction, with `TokenQueue` having `@@unique([queueDate, tokenNumber])`. Live-verified: fired two token-creation calls concurrently — the first succeeded (token #1), the second **crashed outright** with `Unique constraint failed on the fields: (queueDate, tokenNumber)`. Same check-then-write race class already found and fixed in Phase 22's appointment booking. `TokenQueueScreen.tsx`'s "Issue Token" button does correctly disable itself while saving (`loading={saving}` → the shared `Button` component sets `disabled`), so a normal double-click in one window is already blocked — the gap only surfaces under genuine concurrent calls, which is why it was tested directly at the IPC layer. | `token-queue.service.ts`'s `createToken` | **Fixed** — the numbering read and the write now run inside the same `db.$transaction()`, identical to the Phase 22 fix pattern. Verified live: re-ran the exact concurrent-call reproduction — both calls now succeed, correctly issuing tokens #1 and #2 with no crash. |

### What was verified accurate

- `visit-note.service.ts`'s finalization guard is correctly enforced on every write path — a finalized note cannot be edited or re-finalized.
- `painScore` is correctly clamped to 0–10 on both create and update.
- `VisitNote.appointmentId` and `TokenQueue.appointmentId` unique constraints correctly enforce their intended 1:1 relationships.
- `clinicalNotes.view`/`clinicalNotes.write` are properly seeded and correctly restricted to Admin + Manager only (confirmed independently by the standing permission-coverage test).
- Audit logging (`VIEW`/`CREATE`/`UPDATE`/`FINALIZE`) is consistently applied across every visit-note mutation.

### Verified live, after fix

Typechecked clean. Full Vitest suite: 250 passing (up from 246) — added 4 new regression tests in `token-queue.service.test.ts` covering first-token issuance, sequential numbering, transaction wrapping, and back-to-back calls with no collision. Relaunched the app and reproduced the original crash scenario end-to-end: same two concurrent `tokenQueue.create()` calls — both now succeed with sequential token numbers instead of the second one crashing.

### Ratings (out of 10) — after fix, re-verified live

| Aspect | Score | Why |
|---|---|---|
| Visit note service logic | 10/10 | Unchanged — already correct |
| Token queue creation | 10/10 | Live-reproduced the crash, then confirmed it's fixed with a regression test guarding it |
| Token queue status transitions | 10/10 | Unchanged — already correct |
| Permission & security model | 10/10 | Confirmed via the standing permission-coverage test |
| Day-to-day usability | 10/10 | A busy front desk issuing walk-in tokens in quick succession can no longer hit a raw crash |
| **Overall** | **10/10** | |
