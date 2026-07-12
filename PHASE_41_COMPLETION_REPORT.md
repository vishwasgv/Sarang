# Phase 41 — Appointment, Session Pack, Membership & Driving School Invoicing: Completion Report

## 1. Overview

Phase 41 closes the three billing gaps the Phase 40 final evaluation found but
did not fix — `Appointment.invoiceId` (dormant across all 24 service
templates), `Membership.invoiceId` (GYM_STUDIO), `DrivingSession.invoiceId`
(DRIVING_SCHOOL, which additionally had no pricing field at all) — plus a 4th,
more fundamental gap discovered while designing the fix: `ClientSessionPack`
(prepaid session packs) had no invoice linkage or tax fields either, and this
is the actual root cause of a real double-charge risk (a pack-redeemed
appointment never zeroes its own `totalAmount`, so naively invoicing off that
field would bill a client twice for one visit).

Full design rationale is in `PHASE_41_TECHNICAL_SPEC.md`. Founder decisions
locked in before implementation: include session-pack purchase invoicing in
this phase; appointment invoicing supports both single and TimeEntry-style
batch invoicing; driving school gets both a simple per-session fee and a full
package/course model.

This phase was inserted ahead of the originally-planned "Phase 41 — Design
System Foundation", which is renumbered to Phase 42 (retrofit becomes Phase
43+) — recorded in `PRODUCT_HARDENING_MASTER_PROMPT.md`.

## 2. Key design decision: tax treatment source

`ServiceCatalog.taxRate`/`sacCode` are already business-owner-configured
per-service (a GP clinic sets 0% for a GST-exempt consultation, a salon sets
18% for a haircut). Every appointment-invoicing path reads tax treatment from
this existing, correct mechanism — **no hardcoded per-vertical SAC/GST
mapping was added**. An appointment with no linked `ServiceCatalog` entry (a
free-text booking) cannot be auto-invoiced; it's rejected with a clear
message, and manual invoicing via the generic Billing screen still works
unchanged (no regression — that was already the only path before this phase).

Salon multi-service appointments (`services` JSON) get one invoice line per
selected service, each carrying that specific service's own tax rate — not a
single lumped line with an averaged/wrong rate.

## 3. Schema changes (additive only)

```prisma
model ClientSessionPack {
  taxRate   Float   @default(18)
  sacCode   String?
  invoiceId String?
}
model DrivingSession {
  sessionFee          Decimal?
  packageEnrollmentId String?
  packageEnrollment   DrivingPackageEnrollment? @relation(...)
}
model DrivingPackage {
  id, packageName, totalSessions, price, vehicleClass, isActive, timestamps
}
model DrivingPackageEnrollment {
  id, learnerId, packageId, sessionsUsed, purchaseDate, invoiceId, notes, timestamps
}
```

`Appointment` and `Membership` needed no schema change — both already had
`invoiceId` and a clean amount source (`totalAmount`, `plan.price`).

Migration: `prisma/migrations/20260704000000_phase41_appointment_pack_membership_driving_invoicing/migration.sql`.

**Migration-tooling bug found and fixed**: the naive `sql.split(';')` script
used to hand-apply this migration to the project's untracked dev DB silently
dropped the very first statement (`ClientSessionPack.taxRate`) because it
shared a semicolon-chunk with the file's leading `--` comment, and its
`.startsWith('--')` filter discarded the whole combined chunk. Caught by
re-verifying column-by-column rather than trusting the script's own "applied"
log line. Fixed properly using `npx prisma db push` (the correct tool for an
untracked dev DB) instead of hand-rolled SQL splitting — confirmed durable
across repeated fresh-process checks.

## 4. Backend functions built

All six follow the atomic-claim pattern hardened in the Phase 40 evaluation:
`updateMany({ where: { id, invoiceId: null }, data: { invoiceId: 'PENDING_INVOICE_GENERATION' } })`
executes as one SQL statement under SQLite's single-writer lock, so two
near-simultaneous calls can't both pass; the loser is rejected via the
returned row count, and the winner releases its claim on any subsequent
failure. Every amount check is `> 0`, not just `!= null`, from day one.

| Function | File | Amount source | Tax source |
|---|---|---|---|
| `generateSessionPackInvoice(id)` | `session-pack.service.ts` | `pricePerPack` | pack's own `taxRate`/`sacCode` (no hardcoded fallback — packs span PHYSIO/GYM/SALON with genuinely different real SAC codes) |
| `generateAppointmentInvoice(id)` | `appointment.service.ts` | `totalAmount`, or sum of `services[]` for salon | linked `ServiceCatalog.taxRate`/`sacCode`, per line for multi-service |
| `generateAppointmentBatchInvoice(ids)` | `appointment.service.ts` | same, aggregated | same, one line per appointment |
| `generateMembershipInvoice(id)` | `membership.service.ts` | `plan.price` | flat 18%, SAC **999723** (physical well-being/fitness — verified via web search; the SAC used elsewhere in this codebase for a different gym-adjacent case, 999313, is actually "childbirth and related services" and would have been wrong here) |
| `generateDrivingSessionInvoice(id)` | `driving.service.ts` | new `sessionFee` field | flat 18%, SAC **999293** (commercial training/coaching services — verified via web search) |
| `generateDrivingPackageInvoice(enrollmentId)` | `driving.service.ts` | `package.price` | flat 18%, SAC 999293 |

Guard logic specific to each entity:
- `generateAppointmentInvoice`/batch: rejects non-`COMPLETED`, already-invoiced, missing customer, missing `ServiceCatalog` link, and — critically — **rejects any appointment with a linked `SessionLog`** (pack-redeemed), with a message pointing the user to invoice the pack purchase instead.
- `generateDrivingSessionInvoice`: rejects a session with a `packageEnrollmentId` set (package-redeemed), same rationale.
- `createDrivingSession` now increments `DrivingPackageEnrollment.sessionsUsed` when a session redeems a package — mirrors the existing `SessionLog`/`ClientSessionPack` pattern.

Tamper-proofing: `invoiceId` removed from `createDrivingSession`'s payload
(previously a raw client-settable pass-through, same class of issue fixed for
5 other entities in the Phase 40 evaluation). Delete guards added:
`deleteDrivingPackage` (blocks if enrollments exist), `deleteDrivingPackageEnrollment`
(blocks if invoiced). `deleteAppointment` already transitively covers this
(only `COMPLETED`/`IN_PROGRESS` — the only invoiceable states — were already
blocked from deletion, pre-existing). No delete function exists for
`ClientSessionPack` or `Membership` records themselves (only their parent
plan/pack catalog entries), so no new guard was needed there.

## 5. IPC + preload

New channels: `sessionPack:generateInvoice`, `appointments:generateInvoice`,
`appointments:generateBatchInvoice`, `membership:generateInvoice`,
`drivingSession:generateInvoice`, `drivingPackage:list/create/update/delete`,
`drivingPackageEnrollment:list/create/delete/generateInvoice`. All gated on
`requirePermission('billing.createInvoice')` (read endpoints on `billing.view`),
typed in `channels.ts`, bridged in `src/preload/index.ts`.

## 6. Frontend UI

- **`AppointmentsScreen.tsx`**: checkbox column (shown only on invoiceable
  rows: `COMPLETED`, no `sessionLog`, no `invoiceId`) + a header "Generate
  Invoice (N)" batch button, plus a per-row single "Generate Invoice" icon
  button — mirrors `TimeEntryScreen`'s established single+batch pattern,
  including the selection-staleness prune-on-reload fix applied from day one
  (not retrofitted after the fact this time). Pack-redeemed rows show a
  "Pack" label instead of a checkbox/button.
- **`PhysioPatientScreen.tsx`** (session packs live here, not on the
  standalone read-only `SessionPacksScreen.tsx`): pack-creation form gets new
  `taxRate`/`sacCode` fields; "Generate Invoice" button per pack.
- **`MembershipsScreen.tsx`**: "Generate Invoice" action in the memberships
  table.
- **`DrivingSchoolScreen.tsx`**: sessions table gets an inline fee input (for
  ad-hoc, non-package sessions) + "Generate Invoice" button + "Via package"/
  "Invoiced" state indicators; session-scheduling form gets a "Redeem from
  Package" selector (mutually exclusive with the ad-hoc fee field); new
  **Packages tab** — package catalog CRUD (create/edit/delete with an
  in-use guard) and learner enrollment management, each enrollment with its
  own "Generate Invoice" button.

## 7. Tests

50 new tests added across the 4 service test files (568 → 618 total), same
rigor as the Phase 40 evaluation: every error branch, the atomic-claim race
case, the billing-failure-releases-claim case, zero/negative amount
rejection, delete guards, and — specific to this phase — the salon
multi-service per-line tax-rate test, the pack-redeemed/package-redeemed
rejection tests, and a session-pack test asserting the *absence* of a
hardcoded SAC fallback (`hsnCode: null` when the business didn't set one,
never guessing).

**618/618 tests passing, 0 TypeScript errors** on both configs.

## 8. Live UAT verification

Built the app, seeded a full set of test data (a completed single
appointment, two more for batching, a pack-redeemed appointment, a session
pack, a membership, an ad-hoc driving session, a driving package + learner
enrollment) into the scratch DB, and drove the real running app:

- **Appointment single invoice**: generated, ₹500 @ 0% GST (GP consultation,
  correctly GST-exempt per the linked `ServiceCatalog`'s own configured rate)
  — confirms tax treatment is read from the service, not hardcoded.
- **Appointment batch invoice**: selected 2 appointments via checkboxes,
  generated one combined invoice (₹1000 @ 0%) — confirmed both appointments
  linked to the same invoice.
- **Pack-redeemed appointment**: correctly showed a "Pack" label with no
  checkbox/button — the double-charge guard works as designed.
- **Membership invoice**: ₹2000 @ 18% = ₹2360 — correct.
- **Driving session invoice** (ad-hoc fee): ₹800 @ 18% = ₹944 — correct.
- **Driving package enrollment invoice**: ₹6000 @ 18% = ₹7080 — correct.

Zero console errors across all flows. Cross-checked every resulting invoice
directly in the database — correct product names, correct SAC-linked tax
rates, correct totals.

**One screen not visually verified live**: `PhysioPatientScreen`'s Session
Packs tab is gated on `isModuleEnabled('session_packs')`, tied to the
business's configured `serviceTemplateType`. The scratch UAT database is a
RETAIL/PRODUCT business; switching its template mid-session via a direct
database edit (outside the app's normal setup flow) did not make the
renderer's industry-store flags pick up the change in a fresh launch — an
artifact of testing an unsupported operation (real businesses set their
template once, at onboarding, and never change it), not a Phase 41 code
defect. `generateSessionPackInvoice` itself has 7 passing unit tests covering
every branch (missing pack, already invoiced, zero price, correct tax-rate
usage, no-hardcoded-SAC-fallback, billing failure, and the atomic-claim race),
and the UI code is byte-for-byte the same established pattern already live
verified working in 5 other screens this session. Documented here rather than
silently claimed as fully live-verified.

## 9. Files changed

### Schema / migrations
- `prisma/schema.prisma`
- `prisma/migrations/20260704000000_phase41_appointment_pack_membership_driving_invoicing/migration.sql`

### Backend services
- `src/main/services/session-pack.service.ts`
- `src/main/services/appointment.service.ts`
- `src/main/services/membership.service.ts`
- `src/main/services/driving.service.ts`

### IPC
- `src/main/ipc/handlers/session-pack.handler.ts`
- `src/main/ipc/handlers/appointment.handler.ts`
- `src/main/ipc/handlers/membership.handler.ts`
- `src/main/ipc/handlers/driving.handler.ts`
- `src/main/ipc/channels.ts`
- `src/preload/index.ts`

### Frontend
- `src/renderer/src/modules/service-business/ui/AppointmentsScreen.tsx`
- `src/renderer/src/modules/service-business/ui/PhysioPatientScreen.tsx`
- `src/renderer/src/modules/service-business/ui/MembershipsScreen.tsx`
- `src/renderer/src/modules/service-business/ui/DrivingSchoolScreen.tsx`

### Tests
- `src/main/services/__tests__/session-pack.service.test.ts`
- `src/main/services/__tests__/appointment.service.test.ts`
- `src/main/services/__tests__/membership.service.test.ts`
- `src/main/services/__tests__/driving.service.test.ts`

### Planning
- `PHASE_41_TECHNICAL_SPEC.md` (new)
- `PRODUCT_HARDENING_MASTER_PROMPT.md` (Phase 41 inserted; Design System Foundation renumbered 41→42, retrofit 42+→43+)

## 10. Final status

- **TypeScript**: 0 errors, both `tsconfig.web.json` and `tsconfig.node.json`.
- **Tests**: 618/618 passing across 68 files.
- **Live UAT**: 6 of 7 invoice-generation flows verified end-to-end in the
  real running app with correct GST math; the 7th (`generateSessionPackInvoice`)
  is fully unit-tested and code-pattern-identical to the 6 verified live, but
  not itself clicked through live due to a test-environment limitation
  switching business templates outside normal setup.
- **Zero hardcoded/guessed SAC codes**: appointment tax treatment is entirely
  business-configured via `ServiceCatalog`; a session-pack tax fallback was
  deliberately left `null` rather than guessing wrong across 3 different
  verticals; the two flat-rate SAC codes that were needed (999723 for
  gym/fitness, 999293 for driving training) were verified via web search, not
  assumed — the codebase's own prior use of 999313 for a gym-adjacent context
  was itself wrong (it's "childbirth and related services") and was not
  reused here.

Phase 41 is complete. Per the standing plan, Phase 42 (Design System
Foundation & Feature-Visibility Fix) is next, per `PRODUCT_HARDENING_MASTER_PROMPT.md`.
