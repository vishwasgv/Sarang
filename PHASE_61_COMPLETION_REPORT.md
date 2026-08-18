# Phase 61 — Purchase Side & Core Ledger Foundation: Completion Report

### Maintained by Aszurex | Vishwas G V | 2026-08-18

**Status: ✅ Complete** | Commit: `e4d3a28`

---

## Scope

**Why first**: the single largest gap the original audit found — every one of the 43 verticals, including all 26 service verticals, had zero structured procurement tracking. Directly answers a real-business field visit's own "we don't just sell, we first buy" feedback (the audit that seeded this entire roadmap, `PHASE_61_ROADMAP_MASTER_PROMPT.md` Section 0/2).

## What shipped

- `Bill`/`BillItem` — product-or-service line duality, a pattern later reused across the whole roadmap.
- `SupplierPayment` ("Payments Made"), including bulk allocation across multiple open Bills.
- `ProductCostHistory` — append-only purchase-price history, replacing a single overwritten `Product.costPrice` field.
- Customer individual/business split; Supplier bank/PAN/opening-balance fields; Expense vendor/mileage/billable-to-customer fields.
- `Invoice.ewayBillNumber`, usable independent of the opt-in Logistics module.
- 4 new reports: Purchase Register, Purchases by Vendor, Purchases by Item, AP Aging.

## Real bugs found and fixed

**3 live bugs fixed the same day, before anything else was built:**

1. "Normal Ranges" leaking into all 26 non-clinical service verticals — a wrong module gate.
2. "Clinic Holidays" hardcoded label appearing on every vertical's Provider Schedule, not just clinical ones.
3. A real GST-compliance bug, found only because the founder directly asked whether GST-on-discount was handled correctly: the global/invoice-level discount was applied *after* tax, so GST was charged on the pre-discount subtotal on every bargained sale — a genuine Section 15(3) CGST Act violation, not a cosmetic issue. Fixed with a new proportional-split allocator (`allocateGlobalDiscount()` in `currency.service.ts`) that recomputes tax per line, hand-verified on a real invoice (₹1000 taxable − ₹100 discount → GST=162, not 180).

**4 more real gaps found in the closing audit pass** (not assumed clean from the build itself):

- The `customerKind` migration backfill only defaulted *new* rows to `INDIVIDUAL` and never backfilled existing GSTIN-bearing customers to `BUSINESS`.
- "Payments Made" partial allocation across multiple Bills — an explicit acceptance-checklist line — simply didn't exist yet; built `recordBulkPayment`.
- 2 of 3 required Ask Sarang AI example questions were unanswerable.
- `Invoice.ewayBillNumber` was backend-complete but had zero UI outside the Logistics-gated Shipments screen, contradicting the spec's own "independent of Logistics" requirement — added to BillingScreen/InvoiceDetailScreen directly.

All four found and closed in the same pass, not deferred to a later phase.

## Infra lesson learned (now standing practice)

Git Bash silently mangles Windows sqlite paths passed to `prisma migrate resolve`/`status` — the command reports success while writing to nothing. Two live `_prisma_migrations` bookkeeping gaps were found this way. In every case the actual underlying schema/data changes were confirmed already correctly live via a direct `node:sqlite` query — only the migration-tracking bookkeeping was stale. Standing rule from this phase forward: run Prisma migration-tracking commands via PowerShell with an explicit absolute path, never Git Bash.

## Testing & verification

- Unit suite: **2200/2200**.
- Both tsconfigs (main + renderer) clean.
- All 13 locale JSON files verified at exact key parity.
- New E2E suite: **36/36**.

## Self-review (Section 1.6 method — 6 aspects, each /10)

| Aspect | Score | Evidence |
|---|---|---|
| Logical correctness | 10/10 | GST-on-discount bug fixed and hand-verified against a manually computed reference invoice |
| Spec coverage | 10/10 | All Section 3.1 scope items shipped, including the 4 gaps found in the closing pass |
| Day-to-day critical-feature coverage | 10/10 | Bulk payment allocation and e-way-bill UI closed after being flagged missing |
| Testing completeness | 9/10 | One disclosed, environment-blocked gap: field-order QR real-device test needs a physical phone on the same LAN as a packaged build — no such device was available |
| Language completeness | 10/10 | 13/13 locales, zero missing/extra keys |
| Manual/Tutorial/AI integration completeness | 10/10 | All 3 AI example questions answerable after the fix |

## Final state

Phase 61 is complete with one disclosed, environment-blocked testing gap (physical-device QR scan) carried forward honestly rather than silently marked done. No open items otherwise. Commit `e4d3a28` ("Complete Phase 61 (Purchase Side & Core Ledger) and Phase 62 (Banking, Ledger & Compliance Backbone)") — bundled with Phase 62's own commit since both were built in the same continuous session.
