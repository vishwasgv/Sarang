# Phase 54G — Rental Business Vertical + Hybrid Business Operations — Technical Spec

Two independent, small-to-medium pieces requested together in the same session: (1) a small, contained fix letting any business combine retail/wholesale/trade feature sets ("Hybrid Business Operations" — **already shipped**, see Section 0), and (2) a new dedicated **Rental** business vertical, generic enough to serve tents/utensils/clothing/accessories/cars/bikes/short-stay homes/artificial jewellery/gaming stations/electronics/furniture rental businesses without 10 separate parallel builds.

## Section 0 — Hybrid Business Operations (COMPLETE, documented here for the record)

**Finding, confirmed against actual code before building anything**: the backend already fully supports combining any business type's modules — `updateEnabledModules()` in `industry-template.service.ts` persists `enabledModules` as an independent JSON array, decoupled from `businessType`, and is already exercised today for `barcode_generation`/`barcode_printing`/`loose_billing`. The only real gap was that `IndustrySettingsScreen.tsx`'s template picker is a single-select radio button — switching to "Distributor / Wholesale" replaces a Retail shop's module set instead of adding to it.

**Also confirmed, changing the original scope**: no new `Customer.customerType` field was needed. `billing.service.ts`'s credit-limit check already only fires for a customer who actually has `creditLimit > 0` set — a walk-in retail customer defaults to 0 and is completely unaffected regardless of whether `credit_limit_enforcement` is turned on business-wide. `bulk_orders` is a separate screen staff opt into per sale, never applied to a normal Billing Screen transaction. All 5 candidate modules (`returns`, `area_pricing`, `credit_limit_enforcement`, `bulk_orders`, `outstanding_analytics`) were confirmed safe to combine with zero cross-contamination risk between a business's retail and wholesale flows.

**Shipped**: a new "Additional Business Features" section in Settings (`BusinessFeaturesSection` in `SettingsScreen.tsx`), exposing the same toggle mechanism `BarcodeSection` already used, for these 5 modules. Live-UAT'd: toggled `bulk_orders` on for a `MANUFACTURING` business without switching business type, confirmed via direct API call that `enabledModules` now includes it independent of `businessType`, confirmed the sidebar picked it up immediately.

**Terminology labels** (the third candidate win) was deliberately not built in this pass — lower value than the other two, no adaptive-terminology system exists to extend, and would need its own design (which labels change for which module combinations) rather than reusing an existing mechanism. Flagged as a real, disclosed follow-up candidate, not silently dropped.

---

## Section 1 — Rental vertical: audit findings / research (confirmed before designing)

- **No existing rental-shaped model.** `Property` (Real Estate, Phase 32) has `listingType: SALE|RENT|LEASE` with `monthlyRent`/`securityDeposit`, but it's a **long-term tenancy** model (list a property, negotiate, one lease) — no checkout/return cycle, no hourly/daily rate tiers, no reusable-inventory concept. This spec's Rental vertical is a different, complementary shape (short-term, reusable-asset, checkout→return) and does not touch or duplicate `Property`.
- **`ProductSerial`** (Electronics/IMEI tracking) is the closest existing precedent for a per-unit trackable asset — `status: AVAILABLE|SOLD` — but it's a one-way **sale** model (a sold serial never comes back). Rental needs the same "one row per physical unit" shape but with a status that cycles (`AVAILABLE → RENTED → AVAILABLE`), which is genuinely a new model, not reusable as-is.
- **`Appointment`'s double-booking prevention** (`findProviderConflict` in `appointment.service.ts`) is the exact interval-overlap formula this spec reuses for unit-level rental conflicts: `newStart < existingEnd && existingStart < newEnd`, generalized from same-day minutes-of-day to full multi-day `DateTime` ranges.
- **`generateDrivingSessionInvoice`** (`driving.service.ts`) is the exact pattern this spec reuses for rental invoicing: an atomic claim-sentinel on the booking's own `invoiceId` (prevents double-invoicing under a race), a find-or-create placeholder `Product` for line items, then `billingService.createInvoice()` — not a parallel billing engine.
- **`scheduleContractRenewalNotifications`** (`pest-contract.service.ts`, F.10) is the exact pattern this spec reuses for "return due soon" reminders — a manual-send `NotificationQueue` row, never auto-delivered, consistent with this project's hard offline/zero-cost constraint.
- **Section 7A's "reclassify at display time, don't persist a stale status" rule** (Compliance Task Report, F.9) directly informs this spec's decision NOT to persist an `OVERDUE` booking status — it's computed live (`status === 'CHECKED_OUT' && endDateTime < now`) wherever needed, avoiding a background job and avoiding the stale-status bug class entirely.

## Section 2 — Scope to deliver

**2.1 — Schema.**

`Product` gains 4 nullable/defaulted fields (additive, no impact on non-rental businesses):
```
isRentable            Boolean  @default(false)
rentalTrackingType    String?                    // 'UNIT' | 'BULK'
rentalRates           String   @default("[]")    // JSON: [{basis:'HOUR'|'DAY'|'WEEK'|'MONTH'|'YEAR', amount:number}]
rentalSecurityDeposit Float?
```
`UNIT` items (a specific car, bike, home, gaming station) get individually tracked rows in a new `RentalUnit` model, mirroring `ProductSerial`'s shape but with a cyclable status:
```
model RentalUnit {
  id             String   @id @default(cuid())
  productId      String
  unitLabel      String                          // e.g. "KA01AB1234", "Console #3", "Villa - Sea View"
  status         String   @default("AVAILABLE")  // AVAILABLE | RENTED | MAINTENANCE | RETIRED
  conditionNotes String?
  purchaseDate   DateTime?
  unitCost       Float    @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  bookingItems RentalBookingItem[]
  @@index([productId])
  @@index([status])
}
```
`BULK` items (tents, chairs, utensils, costumes-by-size) reuse the existing `Inventory.quantity` for total-owned count — no per-unit identity needed, availability is computed (Section 2.3), not tracked as a status field.

The booking itself:
```
model RentalBooking {
  id                       String    @id @default(cuid())
  bookingNumber            String    @unique
  customerId               String
  status                   String    @default("RESERVED") // RESERVED | CHECKED_OUT | RETURNED | CANCELLED — OVERDUE is computed, never stored (see Section 1)
  startDateTime            DateTime
  endDateTime              DateTime
  securityDepositCollected Float     @default(0)
  securityDepositRefunded  Float?
  lateFeeAmount            Float     @default(0)
  damageChargeAmount       Float     @default(0)
  checkoutNotes            String?
  returnNotes              String?
  checkedOutAt             DateTime?
  returnedAt               DateTime?
  cancelledAt              DateTime?
  invoiceId                String?   @unique
  notes                    String?
  createdById              String?
  createdAt                DateTime  @default(now())
  updatedAt                DateTime  @updatedAt
  customer Customer @relation(fields: [customerId], references: [id])
  invoice  Invoice? @relation(fields: [invoiceId], references: [id])
  items    RentalBookingItem[]
  @@index([customerId])
  @@index([status])
  @@index([startDateTime, endDateTime])
}

model RentalBookingItem {
  id           String  @id @default(cuid())
  bookingId    String
  productId    String
  rentalUnitId String?                     // set only for UNIT-tracked items
  quantity     Float   @default(1)          // used for BULK items; always 1 for UNIT items
  rateBasis    String                       // HOUR | DAY | WEEK | MONTH | YEAR — snapshot at booking time
  rateAmount   Float                        // snapshot at booking time — a later catalog rate change never rewrites history
  lineTotal    Float                        // rateAmount × duration-in-rateBasis-units × quantity, computed at booking time
  conditionOut String?
  conditionIn  String?
  createdAt    DateTime @default(now())
  booking    RentalBooking @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  product    Product       @relation(fields: [productId], references: [id])
  rentalUnit RentalUnit?   @relation(fields: [rentalUnitId], references: [id])
  @@index([bookingId])
  @@index([productId])
  @@index([rentalUnitId])
}
```

**2.2 — Deliberate modeling decision: availability is always computed from active bookings, never from a physical `Inventory.quantity` decrement.** A rental's stock never actually leaves the business's ownership the way a sale does — decrementing `Inventory.quantity` at checkout and incrementing it back at return would create two independent sources of truth (the raw inventory count AND the booking-overlap count) that could drift out of sync under a race or a missed edge case. Instead: `Inventory.quantity` stays "total owned," and real-time availability for any date range is always `Inventory.quantity − sum(quantity across bookings with status RESERVED or CHECKED_OUT whose [startDateTime, endDateTime) overlaps the requested range)`. This covers a *reservation* correctly blocking availability even before checkout, which a physical-decrement-at-checkout-only model would miss (two customers could both reserve the same last tent for overlapping dates if availability only checked stock at checkout time).

**2.3 — Service layer, `rental.service.ts`.**
- `checkAvailability({ productId, startDateTime, endDateTime, quantity, excludeBookingId? })`: for `UNIT` items, returns which specific `RentalUnit`s (status `AVAILABLE`, not `MAINTENANCE`/`RETIRED`) have no overlapping active booking; for `BULK` items, returns the available quantity for the range using the formula above. `excludeBookingId` is required for the "extend an existing booking" flow, so a booking doesn't conflict with itself.
- `createBooking(...)`: inside one `$transaction` — re-checks availability fresh (not against a pre-read snapshot, same reasoning `billing.service.ts`'s credit-limit check and `appointment.service.ts`'s conflict check already established: a plain pre-transaction read leaves a race window for two concurrent bookings), claims a `RentalUnit` for UNIT items (assigns the specific unit at booking time, not at checkout — so the customer/staff know exactly which car/villa is reserved), generates `bookingNumber` via `sequence.service.ts`'s `generateSequenceNumber` (prefix `RENT`), computes each line's `lineTotal` from `rateAmount × durationInRateBasisUnits × quantity`.
- `checkoutBooking(id, { checkoutNotes, conditionOut per item })`: valid only from `RESERVED`; sets `status: CHECKED_OUT`, `checkedOutAt`; for UNIT items, updates the assigned `RentalUnit.status` to `RENTED`.
- `returnBooking(id, { returnNotes, conditionIn per item, damageChargeAmount?, securityDepositRefunded? })`: valid only from `CHECKED_OUT`; computes `lateFeeAmount` automatically if `now() > endDateTime` (late days × a configurable `rental_late_fee_multiplier` Setting × the item's own daily-equivalent rate — same owner-configurable-multiplier pattern `max_discount_percent`/`allow_expired_batch_sale` already established, defaulting to a sane multiplier so it isn't a silent zero); sets `status: RETURNED`, `returnedAt`; for UNIT items, updates the assigned `RentalUnit.status` back to `AVAILABLE`. `damageChargeAmount`/`securityDepositRefunded` are staff-entered at return time, not computed — this software doesn't judge damage, a human does (same "app provides structure, owner supplies the number" philosophy as F.16's payroll deductions).
- `extendBooking(id, newEndDateTime)`: valid from `RESERVED` or `CHECKED_OUT`; re-runs `checkAvailability` with `excludeBookingId` set to itself before applying the change — rejects if the extension would conflict with another booking.
- `cancelBooking(id, reason)`: valid only from `RESERVED` (a `CHECKED_OUT` booking has physically left the building — it must be returned, not cancelled; this is a real-world constraint, not an arbitrary one). Releases the assigned `RentalUnit` back to `AVAILABLE` for UNIT items.
- `generateRentalInvoice(bookingId)`: same atomic claim-sentinel + find-or-create-placeholder-Product + `billingService.createInvoice()` pattern as `generateDrivingSessionInvoice`. Line items: each `RentalBookingItem`'s `lineTotal`, plus a "Rental Late Fee" line if `lateFeeAmount > 0`, plus a "Rental Damage Charge" line if `damageChargeAmount > 0`. Security deposit is explicitly **not** part of the invoice — it's a holding tracked only on `RentalBooking.securityDepositCollected`/`securityDepositRefunded`, not revenue (same reasoning that distinguishes a deposit from a sale in any real accounting sense).
- `scheduleReturnReminder(...)`: on checkout, queues a manual-send `NotificationQueue` reminder for 1 day before `endDateTime` (configurable lead time), same pattern as F.10's pest-contract renewal reminders — never auto-sent.

**2.4 — Dashboard alert.** New `RENTAL_DUE_TODAY`/`RENTAL_OVERDUE` entries in `getDashboardAlerts()`, same extension pattern F.5/F.8/F.9/F.15 already established — computed live from `RentalBooking` rows in `CHECKED_OUT` status, not a separate tracked flag.

**2.5 — Reports** (2 new, registered the same way F.9/F.14/F.17's reports were): **Currently Rented / Overdue** (snapshot, no date range — same shape as Batch Expiry/Blood Stock/Compliance Task) and **Rental Revenue & Utilization** (date range — revenue per item/category, and a utilization % per UNIT item: days rented ÷ days in range).

**2.6 — UI.**
- `RentalBookingsScreen.tsx` — the day-to-day operational screen: booking list (filterable by status), new-booking flow (pick customer via the existing `CustomerPicker` component from Phase 54E, pick item(s) + date range with a live availability check before submit, collect deposit), booking detail with Checkout/Return/Extend/Cancel/Generate Invoice/Print Receipt actions gated on the correct status.
- `RentalUnitsScreen.tsx` — asset roster management for UNIT-tracked items (add/edit individual units, mark under maintenance), mirroring `SerialTrackingScreen.tsx`'s existing precedent for a dedicated per-unit-asset screen separate from day-to-day transactions.
- `ProductFormModal.tsx` gains rental fields (rentable toggle, tracking type, rate table editor, deposit amount), gated on `isModuleEnabled('rental_bookings')` — same conditional-field pattern already used for `variant_tracking`'s gender field and `barcode_generation`'s barcode button.
- New `RENTAL` entry in `IndustrySettingsScreen.tsx`'s template list, `businessCategory: 'PRODUCT'`, not in `SERVICE_TEMPLATE_TYPES` (so `languageLock: 'multi'` falls out automatically, same as AGRI_INPUTS/BLOOD_BANK), default module `['rental_bookings', ...LOGISTICS_MODULES]`.
- Sidebar: "Rental Bookings", "Rental Units", gated on the new `rental_bookings` `TemplateModule`.
- New permissions `rental.view`/`rental.manage` (view bookings & catalog / create-checkout-return-cancel-invoice), seeded the same way `hr.view`/`hr.manage` are.

**2.7 — i18n.** RENTAL is a PRODUCT-category vertical with `languageLock: 'multi'` — full 12-language translation for all new UI strings, matching the AGRI_INPUTS/BLOOD_BANK precedent (not the English-locked-vertical placeholder shortcut).

## Section 3 — Explicitly out of scope

- **No calendar/visual timeline view** for bookings in this pass — a list/table view with date-range filters covers the day-to-day workflow; a drag-and-drop calendar is a real, larger UI investment that can follow if requested.
- **No multi-location fleet tracking** — consistent with F.18's explicit out-of-scope decision (monetization boundary) for this whole product.
- **No automated late-return SMS/call escalation** — the manual-send `NotificationQueue` reminder is the same offline-compatible mechanism this entire app uses everywhere else; no new automation infrastructure.
- **No damage-charge computation from photos/AI** — damage assessment is a human judgment call, staff-entered.
- **No integration with car-rental-specific concerns** (driver's license verification, insurance) or **real-estate-specific concerns** (rental agreements/stamp duty) — those are genuinely vertical-specific and out of scope for a deliberately generic module; a business needing them can still use this module for the booking/billing mechanics and handle those concerns outside the software, same as this app already does for e.g. legal compliance generally.

## Section 4 — Testing plan

- Unit: `rental.service.ts` — `checkAvailability` (UNIT conflict detection via the overlap formula, BULK quantity-sum-across-overlapping-bookings, `excludeBookingId` correctly excludes self on extend); `createBooking` (atomic unit assignment, rejects on conflict, correct `lineTotal` computation per rate basis); `checkoutBooking`/`returnBooking` (status-transition guards reject invalid states, `RentalUnit.status` cycles correctly, late fee computed only when actually late and using the configured multiplier); `extendBooking` (rejects a conflicting extension); `cancelBooking` (rejects cancelling a CHECKED_OUT booking, releases the unit); `generateRentalInvoice` (claim-sentinel prevents double-invoicing, correct line items including late fee/damage charge when present, deposit never appears on the invoice).
- Live: launch the real dev app, switch to the new RENTAL business type, create both a UNIT-tracked item (e.g. a car) and a BULK item (e.g. tents), create a real booking spanning several days, confirm a second overlapping booking attempt for the same car is correctly rejected, check the item out, return it a day late and confirm a real late fee computes, generate the invoice and confirm it reflects rental charge + late fee but not the deposit, confirm the dashboard shows an overdue alert for a different unreturned booking, confirm the two new reports render real data.

## Section 5 — Completion (2026-07-09)

Full 12-language i18n pass (rental namespace + report/dashboard keys), unit tests (`rental.service.test.ts` — 119 assertions across availability, booking lifecycle, checkout/return/late-fee, cancel, and invoice generation; plus `generateRentalStatusReport`/`generateRentalRevenueReport` cases in `report.service.test.ts`), and a full `dashboard-alerts` regression fix (the new `rentalBooking.count` query needed a mock added to the shared `analytics.service.test.ts` fixture) — 1008/1008 tests passing, 0 TypeScript errors both configs.

**Real bug found and fixed during live UAT, not caught by unit tests:** `RentalBooking.invoiceId` was originally declared as a real Prisma foreign key to `Invoice` (`invoice Invoice? @relation(fields: [invoiceId], references: [id])`). `generateRentalInvoice`'s atomic claim-sentinel — copied from `generateDrivingSessionInvoice`'s established pattern — writes the placeholder string `'CLAIMING'` into `invoiceId` before the real `Invoice` row exists, which is fine for `DrivingSession.invoiceId` (a plain unenforced `String?` with no relation) but violates a real foreign-key constraint on `RentalBooking`. Every invoice generation failed with `RENT-026: Foreign key constraint violated`, silently, since the UI's own error path just left the "Generate Invoice" button unchanged with no obvious crash. Unit tests didn't catch this because the mocked Prisma client doesn't enforce FK constraints — this is exactly the class of bug real-SQLite live UAT exists to catch. Fixed by removing the `@relation` from both `RentalBooking.invoiceId` and `Invoice.rentalBooking`, making `invoiceId` a plain reference field — matching every other "generate invoice from record" flow in this codebase (DrivingSession, DrivingPackageEnrollment, etc.), none of which use a real FK for this exact reason. Migration `20260709000008_phase54g_rental_invoiceid_drop_fk` applied to the real dev DB via the established `node:sqlite` + row-count safety check + full DB backup workflow (2→2 rows preserved).

**Live UAT (Playwright driving the real Electron app, real SQLite, no mocks) — 32/32 checks passed** on the final run: business-type switch, sidebar/dashboard rendering, UNIT product creation (car) with a DAY rate via the real Product form's rental section, BULK product creation (tents) with opening stock, Rental Unit creation, a real booking via the New Booking modal with a live availability check, a second overlapping booking for the same car correctly rejected (both the availability check and the Create button's disabled state), checkout, a second booking dated into the past to exercise the overdue path, the dashboard's `RENTAL_OVERDUE` alert, a late return computing a real late fee (₹1,500 = ₹500/day tent rate × 1.5 configured multiplier × 2 late-days, matching the unit-tested formula), invoice generation confirmed via a direct DB read to contain exactly the rental-charge line (₹1,000) and late-fee line (₹1,500) — deposit correctly absent — and both new reports (`Currently Rented / Overdue`, `Rental Revenue & Utilization`) rendering real data.

Dev environment restored after UAT: business type reverted to `MANUFACTURING` (its `IndustryTemplateSetting` row survived untouched under the per-business-type upsert, so no manual module-list restoration was needed), all UAT-created rental bookings/units/invoice hard-deleted, the UAT test product/customer rows soft-deactivated (`isActive: 0` — hard delete was blocked by other FK dependents, same as prior UAT sessions' test data), admin password re-randomized.

**Status: Phase 54G (Hybrid Business Operations + Rental vertical) is COMPLETE.**
