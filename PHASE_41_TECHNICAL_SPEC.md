# Phase 41 — Appointment, Session Pack, Membership & Driving School Invoicing: Technical Spec

## 1. Why this phase exists

The Phase 40 final evaluation (2026-07-04) found that its own audit method — grep every
`invoiceId` field in the schema for a function that populates it — hadn't been applied
exhaustively. Three more entities have the exact same dormant-stub problem the four
Phase 40 functions (and the Engagement fix) closed:

- **`Appointment.invoiceId`** — dormant across **all 24 service templates** (confirmed:
  `industry-template.service.ts`'s `SERVICE_BASE_MODULES` includes `appointments` and every
  `TEMPLATE_DEFAULTS` entry spreads it). Billing today is 100% manual and disconnected —
  staff type/edit `totalAmount` on the appointment, then separately create an invoice via
  the generic Billing screen with no link back.
- **`Membership.invoiceId`** (GYM_STUDIO) — same shape as the 6 already-fixed entities:
  `Membership.plan.price` gives a clean amount, `paymentStatus` (PAID/PENDING/PARTIAL) is
  tracked manually today with no real invoice ever generated.
- **`DrivingSession.invoiceId`** (DRIVING_SCHOOL) — the least-ready of the three: there is
  **no pricing field anywhere** for a driving lesson today, no per-session fee, no
  package/course price. Billing must currently happen entirely outside the system.

A 4th gap surfaced during this audit that isn't in the schema's `invoiceId` grep because
it's more fundamental: **`ClientSessionPack` (prepaid session packs) has no invoice
linkage or tax fields at all.** This matters for correctness, not just completeness —
`AppointmentsScreen.tsx`'s pack-redemption path (`SessionLog` creation on completion)
never touches `Appointment.totalAmount`, so a pack-redeemed appointment still carries its
normal service price. If appointment invoicing is built without accounting for this, a
client who already paid for a pack of 10 sessions would get a **second, duplicate
invoice** every time they used one. The correct fix is to invoice the pack **once, at
purchase time** (this is where the real revenue event happens) and skip/block invoicing
on any appointment that redeemed a pack session.

**Founder decisions (2026-07-04)**, in order:
1. Include session-pack purchase invoicing in this phase (not deferred).
2. Appointment invoicing supports **both** a single-appointment action and a
   TimeEntry-style batch (multi-select several appointments into one invoice).
3. Driving school gets **both** a simple per-session fee (immediate, ad-hoc billing) **and**
   a full package/course model (N-lesson bundles sold and invoiced as one unit) — not a
   simple-only fix.

## 2. Key design facts established this audit (read before objecting to any choice below)

- `ServiceCatalog` already has `taxRate Float @default(0)` and `sacCode String?` **set by
  the business owner when they configure their own service list.** This is the existing,
  correct mechanism for per-vertical tax treatment — a GP clinic sets `taxRate: 0` for a
  consultation (healthcare GST-exempt), a salon sets `taxRate: 18` for a haircut. **No
  hardcoded per-vertical SAC/GST mapping is needed or wanted** — every invoice-generation
  function in this phase reads tax treatment from what the business already configured,
  never guesses it. This also means: an appointment **must have a `serviceCatalogId`** to
  be auto-invoiced (so we have a real tax rate to use) — a free-text appointment with no
  catalog link is rejected with a clear message; the business still has manual invoicing
  (path J) available, exactly as today.
- Salon multi-service appointments (`services` JSON: `[{id, name, price, duration}]`, `id`
  = `ServiceCatalog.id`) get **one invoice line item per selected service**, each using
  that specific service's own `taxRate`/`sacCode` — not a single lumped line.
- `getAppointmentStats().totalRevenue` is dead code (fetched, never rendered, not wired
  into Reports) — there is no existing user-facing number this phase could contradict by
  adding real invoicing on top.
- `StaffCommission` (Phase 27 salon/gym) computes off `Appointment.totalAmount` at
  COMPLETED time and freezes the result. This phase's invoice functions read
  `totalAmount` but never write to it, so no desync risk is introduced.
- `checkInMember`/membership session tracking has its own cap logic independent of
  billing — untouched by this phase.

## 3. Schema changes (additive only — no renames, no drops, no `NOT NULL` without a default)

```prisma
model ClientSessionPack {
  // ...existing fields unchanged...
  taxRate   Float   @default(18)   // set at pack creation, mirrors ServiceCatalog's pattern
  sacCode   String?
  invoiceId String?
}

model DrivingSession {
  // ...existing fields unchanged...
  sessionFee          Decimal?          // ad-hoc per-session fee; null if this session is billed via a package instead
  packageEnrollmentId String?           // set if this session was redeemed against a DrivingPackageEnrollment — mirrors Appointment/SessionLog
  packageEnrollment   DrivingPackageEnrollment? @relation(fields: [packageEnrollmentId], references: [id], onDelete: SetNull)
}

model DrivingPackage {
  id             String   @id @default(cuid())
  packageName    String                                    // "10-Lesson LMV Package"
  totalSessions  Int
  price          Decimal
  vehicleClass   String   @default("LMV")                  // LMV|TWO_WHEELER|HMV
  isActive       Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  enrollments DrivingPackageEnrollment[]

  @@index([isActive])
}

model DrivingPackageEnrollment {
  id            String    @id @default(cuid())
  learnerId     String
  packageId     String
  sessionsUsed  Int       @default(0)
  purchaseDate  DateTime  @default(now())
  invoiceId     String?
  notes         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  learner  Customer       @relation(fields: [learnerId], references: [id], onDelete: Cascade)
  package  DrivingPackage @relation(fields: [packageId], references: [id], onDelete: Restrict)
  sessions DrivingSession[]

  @@index([learnerId])
}
```

`Appointment` and `Membership` need **no schema change** — both already carry
`invoiceId` and a clean amount source (`totalAmount`, `plan.price`).

## 4. Backend service functions

All six new generate functions follow the exact pattern established and hardened in the
Phase 40 evaluation pass: atomic claim (`updateMany({ where: { id, invoiceId: null },
data: { invoiceId: 'PENDING_INVOICE_GENERATION' } })`) before any work, release the claim
on any failure path, find-or-create the `Product` row, call
`billingService.createInvoice`, finalize `invoiceId` on success, write an `AuditLog`
entry. Every amount check is `> 0`, not just `!= null` (the Phase 40 evaluation's
zero-amount fix applies from day one here, not retrofitted).

| Function | File | Amount source | Tax source | Notes |
|---|---|---|---|---|
| `generateSessionPackInvoice(packId)` | `session-pack.service.ts` | `pricePerPack` | pack's own `taxRate`/`sacCode` | Blocks if already invoiced or `pricePerPack <= 0` |
| `generateAppointmentInvoice(id)` | `appointment.service.ts` | `totalAmount`, or sum of `services[]` for salon | linked `ServiceCatalog.taxRate`/`sacCode` per line | Blocks: not `COMPLETED`, already invoiced, has a `sessionLog` (pack-redeemed — message points to the pack instead), no `serviceCatalogId` (single-service case only) |
| `generateAppointmentBatchInvoice(ids: string[])` | `appointment.service.ts` | same as above, per appointment | same as above, per line | Same blocks as single, plus: all appointments must belong to the same customer (mirrors `TimeEntry`'s client-homogeneity check) |
| `generateMembershipInvoice(id)` | `membership.service.ts` | `plan.price` | flat 18% (matches existing gym/salon convention elsewhere in the codebase — no SAC captured on `MembershipPlan` today; adding one is out of scope, flat rate matches how `staff-commission`-adjacent gym billing is already treated) | Blocks if already invoiced or `plan.price <= 0` |
| `generateDrivingSessionInvoice(id)` | `driving.service.ts` | `sessionFee` | flat 18% (transport training service; no per-session SAC captured, same rationale as Membership) | Blocks: already invoiced, `sessionFee` not set/`<= 0`, session has a `packageEnrollmentId` (package-redeemed — message points to the enrollment instead) |
| `generateDrivingPackageInvoice(enrollmentId)` | `driving.service.ts` | `package.price` | flat 18% | Blocks if already invoiced or `package.price <= 0` |

Delete guards added (mirroring `SHT-002`/`EVT-002`/`MS30-010`/`EN29-006`):
`deleteClientSessionPack`, `deleteMembership` (currently has no delete function — confirm
whether one exists; add the guard only if it does), `deleteDrivingSession`,
`deleteDrivingPackageEnrollment` — all block deletion when `invoiceId` is set.

`invoiceId` removed from every affected entity's generic `:update` payload type/IPC
handler, exactly like the Phase 40 evaluation fix (never client-settable, only the
generate function may set it).

## 5. IPC + preload

New channels: `sessionPack:generateInvoice`, `appointment:generateInvoice`,
`appointment:generateBatchInvoice`, `membership:generateInvoice`,
`drivingSession:generateInvoice`, `drivingPackage:list/create/update/delete`,
`drivingPackageEnrollment:list/create/generateInvoice`. All gated on
`requirePermission('billing.createInvoice')`, typed in `channels.ts`, bridged in
`src/preload/index.ts`.

## 6. Frontend UI

- **`AppointmentsScreen.tsx`**: per-row "Generate Invoice" button (COMPLETED, has
  `serviceCatalogId` or salon `services[]`, not pack-redeemed, not yet invoiced) — same
  shape as Shoot/Event. Plus a checkbox column + "Generate Invoice (N)" batch button —
  same shape as `TimeEntryScreen`, including the selection-staleness prune-on-reload fix
  applied from day one.
- **`SessionPacksScreen.tsx`**: `taxRate`/`sacCode` fields added to the pack-creation
  form; "Generate Invoice" button per pack.
- **`MembershipsScreen.tsx`**: "Generate Invoice" button per membership.
- **`DrivingSchoolScreen.tsx`**: `sessionFee` input added to the per-session form (for
  ad-hoc, non-package sessions) + "Generate Invoice" button; new "Packages" tab/section for
  browsing/creating `DrivingPackage`s and enrolling a learner (`DrivingPackageEnrollment`)
  with its own "Generate Invoice" button; session form gets an optional "redeem from
  package" selector that sets `packageEnrollmentId` instead of `sessionFee`.

## 7. Tests

Every new function gets the same test rigor as the Phase 40 evaluation pass: all error
branches, the atomic-claim race-rejection case, the billing-failure-releases-claim case,
zero/negative amount rejection, and the delete guards. No superficial `success === true`
assertions — specific error codes and specific call-argument shapes throughout.

## 8. Acceptance criteria

- 0 TypeScript errors, both configs.
- Full vitest suite green, including all new tests.
- Live UAT: every new "Generate Invoice" action verified end-to-end in the running app —
  correct GST math, correct product/tax treatment pulled from the business's own
  `ServiceCatalog`/pack/plan configuration, pack-redeemed appointments correctly blocked
  from double-invoicing, package-redeemed driving sessions correctly blocked the same way.
- `PHASE_41_COMPLETION_REPORT.md` written on completion, per standing process.
