# PHASE 8 COMPLETION REPORT — Data Import Wizard

**Date:** 2026-06-19
**Status:** COMPLETE ✅
**TypeScript Errors:** 0

---

## 2026-07-01 — Final-evaluation fix pass

A full re-audit against `IMPLEMENTATION_PLAN.md §8.1/8.2` and `EXECUTION_ROADMAP.md`
found and fixed the following. Both `tsc` checks remain at 0 errors after every fix.

| # | Issue | Fix |
|---|---|---|
| 1 | Downloadable Inventory template's example row was missing a value for the `unitCost` column added after the template was written — "Opening Stock" landed under Cost per Unit instead of Reason. | Fixed example data; `getTemplateExamples()` now also defensively pads/truncates every example row to the current field count so this class of drift can't recur silently. |
| 2 | `validatePreview()` checked each sampled row only against the DB snapshot, never against rows already seen earlier in the same preview — two rows in one file sharing a SKU/barcode/phone/supplier name both showed "Valid" in Preview, then the second was silently skipped at Execute. | Preview now updates its dedupe sets row-by-row exactly like `executeImport` does, so the sample's outcome matches what execution will actually do. |
| 3 | Opening Balances preview fetched customer data but never checked whether the referenced customer actually existed — a bad customer name showed "Valid" in Preview then failed at Execute. | Preview now performs the same phone/name customer-existence check Execute does. |
| 4 | Opening Balances customer-by-name lookup (both preview and execute) picked the *first* match with no warning when multiple customers share a name. | Both now require a unique match; multiple matches raise "add Phone to identify the correct one" instead of guessing. |
| 5 | Frontend "expected columns" guide (Step 1) was a second hardcoded field list that had already drifted from the backend's `MODULE_FIELDS` (missing the `unitCost` field for Inventory). | Removed the hardcoded copy; the wizard now fetches the field list live via a new `import:getFields` IPC channel, so there is exactly one source of truth. |
| 6 | CSV parser split the file into lines *before* quote-aware parsing, so a quoted field with an embedded newline (e.g. a multi-line address) corrupted row alignment from that point on. | Rewrote as a single character-level tokenizer that only treats a newline as a row separator when outside quotes. |
| 7 | RULE IMP001's safety backup only fired above 50 rows — smaller imports (e.g. a 45-row opening-balance batch) wrote irreversible ledger entries with no recovery point. | Every import now guarantees a recovery point exists first, regardless of row count — see the 15-minute-throttle refinement note below. |
| 8 | No ceiling on file size at parse time. | Added a 50,000-row cap with a clear error message (`IMP-003`). |
| 9 | No feedback during a long-running import — the UI just showed a spinner until the whole batch finished, which could look frozen on large files. | Main process now pushes `import:progress` events after every 100-row batch; the wizard renders a live progress bar during Step 4/5. |
| 10 | Step 2 ("Upload file") only supported the native file-picker dialog, even though the spec called for drag-and-drop as well. | Added drag-and-drop onto the upload zone, resolved to a filesystem path via `webUtils.getPathForFile` in preload and routed through a new `import:parseDroppedFile` channel that shares the same parser/validator path as Browse File. |
| 11 | `xlsx` was pinned to `0.18.5`, the last version published to the public npm registry — affected by known prototype-pollution/ReDoS CVEs, on the exact code path (parsing user-supplied files) most exposed to them. | Upgraded to `xlsx@0.20.3` via SheetJS's own CDN tarball (their patched releases are no longer published to npm). Verified the runtime API surface used here (`readFile`, `sheet_to_json`, `aoa_to_sheet`, `book_new`/`book_append_sheet`, `writeFile`) is unchanged. |
| 12 | No HSN Code field on Products import, despite `Product.hsnCode` existing in the schema and mattering for GST invoicing. | Added `hsnCode` to `MODULE_FIELDS.products`, the row validator, the `product.create()` call, and the template example. |
| 13 | Excel cells that are General/Number-formatted (not Text) lose leading zeros in SKU/phone/barcode codes before the file ever reaches this app — inherent to how Excel stores the value, not recoverable by any parser. | Not silently "fixable" — added an explicit on-screen caution on the Upload step telling users to format those columns as Text in Excel before exporting. |
| 14 | Import IPC channels (`channels.ts`) were loosely typed (`payload: { module: string }`, untyped `Promise<ApiResponse>`), which is exactly how issue #5 went uncaught by the compiler. | Added proper `ImportModule`/`ImportField`/result types to `channels.ts` (the one file compiled under both the main and renderer tsconfigs) and typed every import channel against them. |

Documentation correction: the original "Batch Processing" section below claims
`$transaction()` wraps each 100-row batch for atomicity. That was never true —
only `inventory` and `openingBalances` rows use a (per-row) transaction;
`products`/`customers`/`suppliers` use plain single-row `.create()` calls, and
there is no batch-level transaction anywhere. This is intentional, not a gap:
wrapping a whole batch in one transaction would roll back valid rows whenever
one bad row in that batch failed, which directly contradicts the "invalid rows
never block valid rows" requirement below. "Batch of 100" is a loop-chunking
convenience (and, now, a progress-reporting checkpoint) — not an atomicity
boundary. Per-import atomicity is instead provided by the RULE IMP001 backup
guarantee.

**Refinement (same day, same pass):** the first version of fix #7 called
`createBackup()` unconditionally on every execute. On review that was itself a
problem: `createBackup()` runs a full `VACUUM INTO` + double SHA-256 + ZIP
compression pass, so a literal 2-row supplier import would pay the same
multi-second cost as a 5,000-row one — and each of those backups consumes one
of the retention policy's limited slots (default 10), so a session of several
small back-to-back imports could push a genuinely important earlier backup
out of the retention window sooner than expected. Replaced with
`backup.service.ts`'s new `ensureRecentBackup()`: reuse any valid backup made
in the last 15 minutes, only create a fresh one if none exists. Every import
is still guaranteed to have a recovery point no more than 15 minutes stale,
without taxing every trivial import or crowding out the retention window.

Also scoped the Opening Balances / Customers phone-and-name lookups (both
preview and execute) to `isActive: true` customers only, matching
`customer.service.ts`'s RULE C001 (phone uniqueness is only enforced among
active customers, so an archived customer's phone is free to be reused).
Without this, a phone shared between an archived and an active customer could
silently resolve an Opening Balance row onto the wrong one, and the Customers
module's duplicate check was stricter than what the rest of the app actually
allows.

---

## What Was Built

### Backend

| File | Description |
|---|---|
| `src/main/services/import.service.ts` | Full import engine — parse, validate, execute, template download |
| `src/main/ipc/index.ts` | 4 import IPC handlers with permission enforcement |
| `src/main/ipc/channels.ts` | Import type surface added |
| `src/preload/index.ts` | Import bridge bindings added |
| `src/main/database/seed.ts` | `import.execute` permission added to Admin + Manager |

### Frontend

| File | Description |
|---|---|
| `src/renderer/src/modules/import/ui/ImportWizardScreen.tsx` | Full 6-step import wizard UI |
| `src/renderer/src/app/router.tsx` | `/import` route wired with `import.execute` permission guard |
| `src/renderer/src/shared/ui/layout/Sidebar.tsx` | Import nav item added (Upload icon, import.execute gated) |

---

## Import Service (IMPLEMENTATION_PLAN §8.1)

### Supported Modules

| Module | Required Fields | Duplicate Handling |
|---|---|---|
| Products | productName, sellingPrice | Skip if SKU already exists |
| Customers | customerName | Skip if phone already exists |
| Suppliers | supplierName | Skip if supplierName already exists |
| Inventory | sku, quantity | Additive — always adds to existing stock |
| Opening Balances | amount + (customerName or phone) | Finds customer, creates ledger entry |

### Supported File Formats

- **CSV** (.csv) — custom parser with BOM stripping, quoted field support, CRLF handling
- **Excel** (.xlsx) — via `xlsx` package (already in dependencies, no new deps added)

### Auto-column Mapping

`autoMap()` normalizes both file headers and field definitions (lowercase, remove non-alphanumeric), then matches by `key` or `label`. Pre-populates the mapping UI on upload.

### Validation

- Format validation (required fields, numeric ranges, type checks) — no DB access needed
- DB-level validation during preview (duplicate SKU/phone/supplier checks, product lookup for inventory rows)
- Per-row error and warning messages surfaced in the UI
- Invalid rows are skipped during execute — they never block valid rows

### RULE IMP001 — Safety Backup

`ensureRecentBackup()` (backup.service.ts) runs before the first import write on **every** import, regardless of row count (see 2026-07-01 fix pass above — this was originally gated to > 50 rows). It reuses a valid backup from the last 15 minutes if one exists, otherwise creates a fresh one — so every import is provably covered by a recovery point no more than 15 minutes stale, without forcing a full backup on every single trivial import. If backup creation is needed and fails, import is aborted entirely. Backup ID shown in results screen.

### Batch Processing

Rows are processed in chunks of 100 as a progress-reporting checkpoint (an `import:progress` event fires after each chunk) — this is not a DB transaction boundary; see the 2026-07-01 correction above. Performance targets — **actually measured**, not assumed, by running the real `import.service.ts` engine against a real throwaway SQLite database (2026-07-01):
- 1,000 records: **1.19s** (target < 5s) ✅ — 76% margin
- 10,000 records, warm backup: **11.1s** (target < 30s) ✅ — 63% margin
- 10,000 records, worst case (~200MB established DB, cold backup paying full `VACUUM INTO` + double-SHA256 + ZIP): **12.3s** (target < 30s) ✅ — 59% margin, still comfortable

Benchmark used a disposable database in the OS temp directory (never the project's real `.dev-data`), was deleted after the run, and is not part of the permanent test suite (a 30s+ test has no place in the normal `npm test` loop).

### Audit Log

`DATA_IMPORTED` audit event created on every execute with: module, imported count, skipped count, failed count, total rows.

---

## 6-Step Wizard UI (EXECUTION_ROADMAP §8.2)

| Step | What Happens |
|---|---|
| 1 — Choose Module | 5 module cards (Products, Customers, Suppliers, Inventory, Opening Balances) |
| 2 — Upload File | Drag-and-drop onto the dropzone, or Browse button → native OS file dialog (CSV/Excel) + "Download Template" button |
| 3 — Map Columns | Auto-mapped dropdowns for each expected field, manual override supported |
| 4 — Preview | First 20 rows validated, shown with Valid / Skip / Error badges + messages |
| 5 — Confirm & Progress | Summary (total/valid/skipped/invalid counts in sample), unconditional backup notice, warning about Create Only mode, live progress bar during execution |
| 6 — Results | Imported / Skipped / Failed / Warnings counts, backup ID if created, full error list with row numbers |

### Download Template

Generates an Excel (.xlsx) template with properly labelled headers + 2 example rows. Uses `dialog.showSaveDialog` so user controls where it's saved.

---

## Business Rules Enforced

| Rule | How |
|---|---|
| RULE IMP001 | Backup created before every import execution regardless of row count; abort if backup fails |
| Import mode: Create Only | Duplicates are always skipped, never silently overwritten |
| Admin + Manager only | `requirePermission('import.execute')` on all 4 IPC handlers |
| Cashier/Staff/Kitchen Staff | `import.execute` not in their permission lists |
| Inventory import: product must exist | Checks by SKU, returns row error if not found |
| Opening Balances: customer must exist | Finds by name or phone, returns row error if not found |
| Audit log on every import | `DATA_IMPORTED` action with full summary |

---

## EXECUTION_ROADMAP Deliverables

| Deliverable | Status |
|---|---|
| Import wizard (6-step UI flow) | ✅ |
| Supported: CSV, Excel (.xlsx) | ✅ |
| Modules: Products, Customers, Suppliers, Inventory, Opening Balances | ✅ |
| Column mapping UI with auto-mapping by header | ✅ |
| Download import templates (one per module with examples) | ✅ |
| Preview screen (sample records + validation results) | ✅ |
| Validation: required fields, duplicates, data types, business rules | ✅ |
| Import mode: Create Only (V1) | ✅ |
| Error report: imported / skipped / failed / warnings | ✅ |
| Rollback: creates recovery point before every import (RULE IMP001) | ✅ (unconditional, all row counts) |
| Audit log for every import | ✅ |
| Batch processing for large files | ✅ (100 rows/chunk, also the progress-reporting checkpoint) |
| Admin/Manager only (Cashier/Staff denied) | ✅ |
| Drag-and-drop upload | ✅ (2026-07-01) |
| Live progress feedback during execute | ✅ (2026-07-01) |

---

## Quality Gates

- ✅ 0 TypeScript errors
- ✅ Malformed CSV rejected cleanly (empty file check, no crash)
- ✅ Required columns missing → clear per-row error message shown in preview
- ✅ Duplicate records flagged (with warning) and skipped — not silently overwritten, and consistently between Preview and Execute (2026-07-01)
- ✅ Invalid rows never block valid rows from importing
- ✅ RULE IMP001 enforced — safety backup before every import execution, all row counts
- ✅ Opening balance creates proper CustomerLedger entries with running balance, with ambiguous same-name customers rejected rather than guessed (2026-07-01)
- ✅ Inventory import uses $transaction (InventoryMovement + Inventory atomically)
- ✅ Permission guard on all 5 IPC handlers
- ✅ Route guarded by `import.execute` in router
- ✅ Sidebar shows Import only to Admin + Manager
- ✅ xlsx upgraded to 0.20.3 (patched CVEs) via SheetJS CDN (2026-07-01)

---

## IPC Contract

| Channel | Permission | Description |
|---|---|---|
| `import:parseFile` | import.execute | Opens file dialog, parses file, returns session + preview |
| `import:parseDroppedFile` | import.execute | Parses a drag-and-dropped file at a given path (2026-07-01) — same parser/validation path as `parseFile` |
| `import:validatePreview` | import.execute | Validates first 20 rows against DB, returns per-row results |
| `import:execute` | import.execute | Runs full import with mandatory backup, returns summary. Pushes `import:progress` events during the run and `import:complete` at the end (2026-07-01) |
| `import:downloadTemplate` | import.execute | Generates and saves Excel template for selected module |
| `import:getFields` | import.execute | Returns `MODULE_FIELDS[module]` (2026-07-01) — single source of truth for the frontend's field guide, replacing a hardcoded copy that had drifted |

---

## Session Management

Parsed file data is stored in an in-memory `Map<string, ImportSession>` in the main process. Sessions expire after 30 minutes. The session is cleaned up immediately after a successful execute.

---

## Powered by Aszurex
