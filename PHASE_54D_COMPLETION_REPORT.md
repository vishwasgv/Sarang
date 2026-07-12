# Phase 54D — Billing Persistence, Search, Disk Usage & Returns Correctness: Completion Report

## Scope

Another ad-hoc pre-Phase-55 audit-then-fix pass. User asked to verify: (1) every bill/patient-report/other-report gets saved; (2) disk usage stays reasonable; (3) sales can be viewed by date/month/year/**time**; (4) invoices get a searchable number; (5) bills can be searched by phone; (6) customer lookup-by-phone at billing with minimal required fields; (7) returns correctly reflect across billing, analytics, reports, and inventory. Three parallel research agents audited these areas against the real codebase before any code changed.

## Already correct — confirmed, not rebuilt

- **Invoice persistence**: `createInvoice` runs entirely inside one Prisma `$transaction`; any failure (including a DB-level unique-constraint collision) rolls back completely — no partial/lost bill is possible.
- **Invoice numbering**: `INV-2026-000001` format, sequence stored in `Setting` and incremented atomically inside the same transaction as invoice creation, plus a DB-level `@unique` constraint as a second guarantee.
- **Patient record persistence**: `VisitNote`/`LabTestOrder` both write to SQLite immediately on every create/update/finalize call — no auto-save gap beyond the inherent "unsaved text before you click Save" case common to any form.
- **Customer phone search + minimal-fields creation**: the POS customer picker already searches by phone (`customer.service.ts`'s `searchCustomers`), and the quick-add modal only requires a name — phone and everything else is optional, matching the Zod schema.
- **Backups & disk hygiene**: backups are already ZIP-compressed with an enforced retention count (`backup_retention_count`, default 10); logo/product images are stored as file paths, never as DB blobs.

## Real gaps and bugs found and fixed

**1. Invoice search couldn't find bills by phone** — `billingService.listInvoices`'s search only matched `invoiceNumber`/`customer.customerName`. Added `customer.phone` to the same `OR` clause. Also retranslated the (previously untranslated, English-only-despite-13-locale-files) search placeholder across all 13 locales.

**2. `AuditLog` grew completely unbounded** — every mutation (and some views) logged forever with zero pruning anywhere in the codebase. Added `pruneOldAuditLogs()` (`audit.service.ts`), mirroring the existing `backup_retention_count` Setting pattern — configurable via `audit_log_retention_days`, defaulting to a generous 730 days (audit trails carry compliance/dispute value; this isn't an aggressive space-saving measure). Runs on every launch via the existing self-healing `seedDefaultData()` path.

**3. No real "sales by time" view** — day/week/month/year grouping and arbitrary custom date ranges already worked fine, but hour-of-day was only a generic Dashboard "Today" convenience, not integrated into the Sales Report itself. Added a `byHour` breakdown to `generateSalesReport` (busiest hours across the *entire* selected range, not just today), with a bar chart on-screen and in the printed PDF.

**4. Returns — three real correctness bugs, one real inventory gap, all found by the audit and fixed:**
- **Profit was understated** — `computeProfit()` summed `quantity × costPrice` for every invoice regardless of type. A RETURN invoice item stores quantity as *positive* (used to restock inventory) — only the money fields are negative — so a return's cost was being **added to COGS a second time** instead of subtracted back out, double-punishing profit. Fixed with a type-aware sign flip.
- **Top Products / Top Categories inflated "units sold"** — same root cause: `quantitySold`/`itemsSold` summed the positive return quantity instead of subtracting it, while revenue already netted correctly via `lineTotal`. Fixed the same way in both functions.
- **Outstanding Report showed stale balances after a return** — `generateOutstandingReport` sums `invoice.balanceAmount` directly (needed for its per-invoice aging buckets), but `createReturn` never touched the *original* invoice's own balance — only the aggregate `CustomerLedger`/`customer.outstandingBalance` used by the Dashboard and Customer Ledger Report. A return against a still-unpaid invoice left the Outstanding Report showing the full original amount owed while the Dashboard correctly showed it reduced. Fixed by having `createReturn` reduce the original invoice's `balanceAmount` (capped at zero, marking it `PAID` if fully cleared) inside the same transaction — re-read fresh to avoid the same TOCTOU class of bug the file's own prior-returns check already guards against.
- **Batch-tracked stock (Pharmacy/Agri Inputs) never got restocked on return** — only the generic `Inventory.quantity` did. `batch.service.ts` already had a `restoreBatchStockFIFO()` function built for exactly this (currently used by invoice cancellation) but `returns.service.ts` never called it. Wired it in — a one-line, no-op-safe fix reusing existing code, not new logic.

## Verification

- **0 TypeScript errors** both configs.
- **823/823 tests pass** (was 809 at Phase 54C's close — 14 new tests: phone-search regression, `pruneOldAuditLogs` retention/fallback behavior, Sales Report `byHour` bucketing and cancelled-invoice exclusion, the COGS/quantitySold return-sign regressions, and three new returns.service tests covering the original-invoice-balance reduction, its zero-floor/PAID-marking, and the "already fully paid, don't touch it" case).
- **Live end-to-end verification, not just unit tests**: created a real customer + a real ₹1,500 unpaid (CREDIT) invoice for 3 units, confirmed it's found by searching the customer's phone number, processed a real partial return (1 unit), and confirmed via direct API calls — not mocks — that the original invoice's balance dropped from ₹1,500 to exactly ₹1,000, the Outstanding Report showed that same ₹1,000 for the customer (previously it would have kept showing ₹1,500), and the Sales Report's new hourly breakdown populated correctly. All test data cleaned up afterward.

## Final state

0 TS errors both configs, 823/823 tests (was 809 at Phase 54C's close). Every real gap and bug the audit surfaced was fixed and independently re-verified live against the real database — not just patched and assumed correct.
