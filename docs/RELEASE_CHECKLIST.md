# Release Checklist — Sarang Business OS Lite

**Company:** Aszurex · Trust Beyond Limits
**Platform:** Windows 10/11 x64 (NSIS installer)
**Status:** Single source of truth. This file replaces two previously-separate,
unreconciled checklists that used to exist (`RELEASE_CHECKLIST.md` at the
project root, and an earlier version of this file) — they disagreed with
each other on real facts (e.g. whether the app icon was still a
placeholder) and referenced commands that didn't match this project's
actual scripts (wrong config file extension, a lint flag this project's
flat-config ESLint doesn't use, a test-coverage "minimum threshold" that
was never actually configured). Merged into one file, 2026-07-15, with
every command re-verified against the real project before being written
down here — none are copied from a generic template. If a command in this
file stops matching the real project (a script renamed, a config file
moved), fix the command here in the same change that makes it stop
matching — a checklist with stale commands is worse than no checklist,
because it fails silently.

**Installer size**: target is no longer <150MB — superseded by explicit
founder instruction once the AI Assistant module (Phase 57) shipped:
"once downloaded, internet should never be required — proceed even if it's
2GB." **Real measured installer size (2026-07-15, latest build, after the
critical Prisma-packaging fix — see Section 7): 1,109,342,592 bytes
(~1.03GB)** for `Sarang-Business-OS-Lite-Setup-1.0.0.exe` — ~7.7MB larger
than an earlier same-day measurement (1,101,620,084 bytes), consistent
with `.prisma/client`'s files now actually being included where they were
previously silently missing entirely. This is a real number from a real
build, not a projection. See `PHASE_57_TECHNICAL_SPEC.md` (this repo's
root) and `AI_ASSISTANT_MASTER_PROMPT.md` (one directory up from this repo,
at `D:\Sarang(business OS LITE)\` — not inside `sarang-business-os/`, so
don't go looking for it under `docs/`).

---

## Release Philosophy

Never release because a feature is *finished*. Release only when it is
*verified*, the product is *stable*, and user data is *protected*.

A release is **not ready** if any of these is true: a critical issue
exists, a data-loss risk exists, a backup issue exists, a migration issue
exists, a security issue exists. Any one of these blocks the release
regardless of how much else is done.

## Release Types

| Type | Example bump | Examples |
|---|---|---|
| Patch | 1.0.0 → 1.0.1 | Bug fixes, small corrections |
| Minor | 1.0.0 → 1.1.0 | New features, new reports/templates, new import types |
| Major | 1.0.0 → 2.0.0 | Architecture changes, database changes, platform expansion |

---

## 1. Pre-Build Sign-Off

### Assets
- [x] `package.json` version follows semantic versioning and matches the intended release — verified 2026-07-15: `"version": "1.0.0"`, valid semver, matches the installer's own artifact name (`Sarang-Business-OS-Lite-Setup-1.0.0.exe`) and this session's "V1, first release" context (no prior shipped version exists — see Upgrade section note).
- [x] `resources/icon.png` / `resources/icon.ico` use the founder-approved brand design (Phase 39, 2026-07-03) — confirmed real, not a placeholder, as of this checklist's last review. If this is ever reverted, update this line AND remove it from Known Limitations below in the same change — the two previous checklist files contradicted each other on exactly this point for an unknown length of time because that discipline wasn't followed.
- [x] Splash screen (`resources/splash.html`) uses the real wordmark logo (Phase 39)

### Code Quality
Run from the project root (`sarang-business-os/`):
```bash
npm run typecheck   # tsc --noEmit -p tsconfig.web.json && tsc --noEmit -p tsconfig.node.json — must show 0 errors
npm run lint        # eslint . (flat config, eslint.config.js — no --ext flag needed or supported)
npm run test        # vitest run — must show 0 failures
npm run test:coverage  # vitest run --coverage — no numeric minimum is configured in vitest.config.ts;
                       # read the report and use engineering judgment per changed area, don't expect a gate to fail automatically
```
- [x] `npm run typecheck` passes, 0 errors — verified 2026-07-15
- [x] `npm run lint` passes, 0 errors (30 pre-existing warnings, mostly `react-hooks/exhaustive-deps` — none new, none blocking) — verified 2026-07-15
- [x] `npm run test` passes, 0 failures (1154/1154, 97 files) — verified 2026-07-15
- [x] `npm run test:coverage` reviewed manually for any area touched by this release — run 2026-07-15 (overall: 50.97% statements, 40.69% branches — no blanket minimum expected, per this file's own note above). Checked the specific files this session's fixes touched: `print.service.ts` 80.92% (good — its 35 tests, including the new DB-mock added for this session's locale-formatting fix, exercise the changed code directly), `audit.service.ts` 90.9% (good). **Two real 0%-coverage files were touched**: `setup.service.ts` (the file with this session's critical schema-drift-crash fixes) and `hr.service.ts` (one of the 5 files in the 32-site raw-exception-leak fix) have **zero unit tests at all**, not just low coverage. Judgment call, not glossed over: `setup.service.ts`'s correctness rests entirely on this session's extensive LIVE e2e verification instead (`packaged-fresh-install-flow.js`, 2 clean full runs against the real packaged app) — arguably stronger evidence for the specific bugs that were fixed there (real migration/schema state, which a mocked unit test wouldn't have caught in the first place). `hr.service.ts`'s change was a narrow, mechanical, low-risk text substitution (swap `console.error`+raw-message for `logger.error`+generic-message, no business-logic change) verified by direct code review of every changed line plus `npm run typecheck`/`test` staying clean — not exercised by a fresh live test, which is a real, acknowledged gap for that file specifically, not a false claim of coverage.
- [x] Completion reports exist for every phase (65 `PHASE_*_COMPLETION_REPORT.md` files, Phases 1-57 + batches, plus a 2026-07-12 fresh audit) — verified present 2026-07-15

### Security Rules (NON-NEGOTIABLE)
```bash
# contextIsolation / sandbox / nodeIntegration / webSecurity — verify all BrowserWindow instances
grep -n "contextIsolation\|sandbox\|nodeIntegration\|webSecurity" src/main/index.ts

# Every IPC handler must gate on requirePermission() or an equivalent explicit check —
# spot-check a sample of handler files, not just the index
grep -rL "requirePermission\|requireSession" src/main/ipc/handlers/*.ts

# No hardcoded secrets/keys
grep -rn "apiKey\|apiSecret\|ACCESS_KEY\|SECRET_KEY" src/ --include="*.ts" --include="*.tsx"

# No remote module or webview (legacy Electron attack surface)
grep -rn "enableRemoteModule\|webviewTag" src/

# publish must be null (electron-builder) — this project's config is TypeScript, not JS
grep -n "publish" electron-builder.config.ts
```
- [x] `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true` on every `BrowserWindow` — verified 2026-07-15 (both windows in `src/main/index.ts`)
- [x] Every IPC handler in `src/main/ipc/handlers/*.ts` calls `requirePermission()` or `requireSession()` — verified 2026-07-15, the `grep -rL` command returned zero files
- [x] No payment processing/verification logic exists anywhere — verified 2026-07-15, grep returned zero matches
- [x] No telemetry, analytics, or tracking calls to any external endpoint — `publish: null` confirmed, and the only non-localhost `fetch` in `src/main` is `app.handler.ts`'s `app:checkForUpdates`, which is: (a) verified user-initiated only (a button on the About screen, not called from any `useEffect`/startup path), (b) sends only a `User-Agent` header to GitHub's public releases API — no business or user data — and (c) fails gracefully offline. That's disclosed version-checking, not telemetry, and is the ONE known exception to "no external calls" — if a grep for `fetch\|http.request\|https.request` in `src/main` (excluding `__tests__/` files, which call their own local test server via loopback) ever turns up a second one, that's the real thing to investigate.
- [x] No hardcoded secrets found by the grep above — verified 2026-07-15

---

## 2. Database Checklist

### Schema
- [x] `npx prisma validate` passes — verified 2026-07-15
- [x] Every new/changed model has appropriate indexes and foreign keys — the specific gaps found this session are closed: `NormalRangeReference` (new table) has both its composite unique index (`testName, gender`) and a lookup index (`testName`); `DrivingSession.packageEnrollmentId`'s missing foreign-key constraint was added (found via `prisma migrate diff`, confirmed missing via `PRAGMA foreign_key_list` before the fix, present after). **Not a full audit of every one of the 156 models in schema.prisma** — this closes the specific drift `prisma migrate diff` surfaced, not an independent review of every index's appropriateness project-wide.

### Migrations
**Known gotcha, verified on this project's real dev DB**: a bare `npx prisma
migrate status` resolves `DATABASE_URL` relative to `prisma/schema.prisma`'s
directory, which resolves to `prisma/.dev-data/sarang.db` — a different,
mostly-empty decoy file, NOT the real database the app actually uses
(`.dev-data/sarang.db` at the project root, computed as an absolute path by
`src/main/database/db.ts`). Even with the correct absolute path supplied
(see the command below), `migrate status` can still report migrations as
"not yet applied" that are **actually already live in the schema** — this project's
`_prisma_migrations` bookkeeping table has known gaps because several
migrations were historically applied via direct SQL rather than
`prisma migrate deploy`. Confirmed live: 14 migrations reported "not
applied" while their actual effect (e.g. the `AiQueryLog` table from
`20260713143951_ai_assistant_query_log`) was already present and in active
use. **Do not trust a bare `migrate status` verdict for this project** —
verify the specific schema change actually landed instead:
```bash
# Correct DB path (from project root):
DATABASE_URL="file:$(pwd)/.dev-data/sarang.db" npx prisma migrate status

# If it reports "not applied" migrations, verify their actual effect directly
# rather than assuming the schema is stale, e.g.:
node -e "const {DatabaseSync}=require('node:sqlite'); const db=new DatabaseSync('.dev-data/sarang.db'); console.log(db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name='<TableFromMigration>'\").get()); db.close()"
```
- [x] Every migration this release adds has been applied to a real test DB and its effect verified directly (not just trusted from `migrate status`) — both of this session's new migrations (`20260715173500_add_missing_normal_range_reference_table`, `20260715183500_catch_up_full_schema_drift`) were: (1) SQL-validated by replaying the full 49-migration history against a fresh in-memory DB before shipping, (2) verified via direct column/FK inspection (`PRAGMA table_info`/`PRAGMA foreign_key_list`), and (3) verified end-to-end via a real fresh-install of the packaged installer, confirming `NormalRangeReference` exists with 8 seeded rows and the full Setup-Wizard-to-first-invoice flow completes without the schema-drift crash these migrations fixed.
- [ ] Upgrade path tested — blocked, see Post-Build Verification's Upgrade section: this is V1, no prior version exists to upgrade from.
- [x] No destructive migration (column drop, type narrowing) ships without a reviewed data-preservation plan — reviewed 2026-07-15: both of this session's migrations are purely additive (`CREATE TABLE`, `ADD COLUMN` ×11 all nullable, one `ADD CONSTRAINT`-equivalent table-rebuild for a missing FK that preserves all existing rows via `INSERT...SELECT`, confirmed row-for-row via the in-memory replay test). Zero `DROP COLUMN`/type-narrowing operations in either migration.

### Backup
- [x] Manual backup creates a real file in `%APPDATA%\sarang-business-os\backups\` (path corrected — see the Upgrade section note above) — live-verified 2026-07-15 against the packaged app via `packaged-feature-smoke.js`: a real `SARANG_2026_07_15_....sarang-backup` file created, ~105-115KB across multiple runs, with a real checksum and `isValid: true`.
- [x] Restore from that backup succeeds and data matches pre-backup state — live-verified 2026-07-15 via `packaged-backup-restore.js` (7/7 passed, 2 consecutive runs): proved by actual effect, not just a success response — created a customer, backed up, created a second customer, restored, and confirmed the first customer survived while the second was correctly gone. Also confirmed `restoreBackup()`'s real safety design: it creates a fresh safety backup of the CURRENT state before restoring (so restore itself is undoable), then calls `app.relaunch()` to cleanly reconnect Prisma to the swapped DB file.
- [x] A corrupted/truncated backup file fails restore with a clear error, not a silent partial restore — live-verified 2026-07-15 via new `tests/e2e/packaged-corrupted-backup.js` (permanent asset, 6/6 passed, 2 consecutive runs against the packaged app): created a marker customer, backed up, truncated the real backup file on disk to half its size, attempted restore — correctly rejected with `BK-006` ("Checksum mismatch — file may be corrupted or tampered"), the app stayed fully responsive afterward, and the marker customer was confirmed still present (proving no silent partial restore occurred before the corruption was caught). `restoreBackup()`'s design validates the backup file BEFORE touching the live database at all, which this test confirms holds in practice.

---

## 3. Business-Logic Checklists

These are the mission-critical modules — verify each one with real data
through the real UI (or `window.api` IPC calls in a live-driven test, per
`tests/e2e/harness.js`), not by reading the code and assuming it's correct.

### Billing (Mission Critical)
- [x] Invoice creation (cash) — live-verified 2026-07-15 via `tests/e2e/suites/01-core-commerce.js`, 16/16 checks passed: correct total, correct customer linkage, real invoice-detail fetch. **Credit invoices not covered by this specific run** — see `02-service-business.js`/other suites or re-run for credit-path coverage before treating this line as fully closed.
- [x] Invoice numbering has no gaps or collisions under concurrent creation — live-verified 2026-07-15 via `12-payments-import-credit.js` (68/68 passed, reproducibly clean across 2 runs, specifically asserting on the invoice-NUMBER sequence itself, not just stock as `09-stress.js` did): fired 20 genuinely concurrent `createInvoice` calls, 4/20 succeeded (SQLite single-writer contention, expected — matches the same pattern `09-stress.js` documented), **zero duplicate invoice numbers among the successes**, and the successful batch's numbers were **perfectly consecutive** (e.g. 564-565-566-567, no gaps) — confirming `generateInvoiceNumber()`'s atomic same-transaction claim design holds under real concurrency: a losing/failed attempt never wastes or skips a number.
- [x] Discounts apply correctly to both subtotal and tax base — live-verified 2026-07-15 via `12-payments-import-credit.js`: 1 unit @ ₹1000 with a ₹100 discount and 18% tax correctly produced subtotal=1000, discount=100, **tax=162 (computed on the post-discount ₹900 base, not the raw ₹1000)**, total=1062. Confirms `currency.service.ts`'s `calculateLineTotal()` formula (discount subtracted before tax is applied) actually holds end-to-end through the real IPC path, not just in isolation.
- [x] Tax calculation matches the configured `TaxConfiguration` rates — live-verified 2026-07-15, same suite: created an invoice at a deliberately non-default 5% rate (not the common 18%, so this couldn't accidentally pass via a hardcoded rate anywhere in the pipeline) — ₹2000 × 5% = ₹100 tax, ₹2100 total, exact match.
- [x] Inventory deducts correctly on invoice creation, restores on cancellation — live-verified 2026-07-15 via `09-stress.js` (concurrent invoices decrement stock exactly, e.g. 95→91 for 4 successes) and `01-core-commerce.js` (RETURN restores balance)
- [x] Printing (58mm/80mm thermal, A4) — live-verified 2026-07-15 via `11-billing-reports-round2.js`: A4 and thermal print buttons present for Quotation, Credit Note, and Debit Note. Reprinting specifically and actual paper/PDF pixel output not verified (button presence only).
- [x] Invoice cancellation is a soft cancel (RULE B010: cancelled invoices stay visible, never hard-deleted) — live-verified 2026-07-15: cancelled invoice correctly shows a "Cancelled" badge and remains visible, and a real RETURN correctly reduced the original invoice's outstanding balance (708 → 472, the historical Phase 54D fix, re-confirmed still working)
- [x] Every billing action appears in the audit log — indirectly confirmed 2026-07-15 via `06-trust-compliance.js`'s hash-chain verification passing clean across 2607 real audit log entries (chain integrity implies entries are being written and not tampered with; did not individually confirm every billing action type has its own log entry)

### Inventory (Mission Critical)
- [x] Stock addition and reduction are correct under normal operation — live-verified 2026-07-15 via `03-logistics-manufacturing.js` (18/18 passed): GRN receipt correctly increased stock 0→20; production order correctly consumed raw material 100→90
- [x] Manual adjustments are correct and logged (`InventoryMovement`) — live-verified 2026-07-15 via new suite `tests/e2e/suites/12-payments-import-credit.js` (21/21 passed): `inventory.adjustStock({productId, quantity, reason})` correctly treats `quantity` as an absolute target (50→35 confirmed), and the resulting `InventoryMovement` row (movementType `ADJUSTMENT`, quantity -15) is queryable via `inventory.getMovements`
- [x] Negative-inventory prevention actually blocks oversell — live-verified 2026-07-15 via `09-stress.js` extreme-concurrency test (50 simultaneous invoice attempts against 1 product): stock never went negative, and the stock drop exactly matched the count of calls that reported success (no lost-update overselling)
- [x] Stock valuation matches `Σ(currentStock × costPrice)` across products — live-verified 2026-07-15 via `12-payments-import-credit.js`: `inventory.getInventoryValue()`'s reported total matched an independent `Σ quantity × averageCost` SQL query exactly (134300 == 134300) for a fresh product. Note: the real formula uses `Inventory.averageCost`, not `Product.costPrice` directly — they're equal for a fresh, unmoved product (this test's case) but can diverge after further stock movement (weighted-average).

### Customers / Suppliers
- [x] Creation, ledger, and outstanding-balance calculations are correct — live-verified 2026-07-15 via `09-stress.js`: created a customer, bulk-inserted a 5,000-row ledger, and confirmed the Customer Ledger report and Outstanding report both render correctly and match the customer's `outstandingBalance` at that scale (19/19 checks passed)
- [x] Credit limits are enforced where configured — live-verified 2026-07-15 via `12-payments-import-credit.js`: enabled the `credit_limit_enforcement` industry module, set a customer's `creditLimit` to 1000, attempted a CREDIT sale of 2360 against it, and confirmed it was correctly rejected with `CUST-003`. Confirmed this module is **off by default** for GENERAL/RETAIL business types — enforcement only applies where the module is explicitly enabled.
- [x] Customer/supplier ledger totals match the denormalized `outstandingBalance` column — re-confirmed 2026-07-15 at 5,000-row scale (see above); no discrepancy found this run

### Payments
- [x] Recording a payment updates outstanding balance and ledger correctly — live-verified 2026-07-15 via `12-payments-import-credit.js`: `payments.record({invoiceId, paymentMethod, amount})` against a CREDIT invoice correctly reduced `balanceAmount` by the exact payment amount (1180→780)
- [x] Payment reversal correctly reverses both the ledger entry and the outstanding balance — live-verified 2026-07-15: `payments.reverse({paymentId, reason})` correctly restored the invoice balance to its pre-payment value (780→1180), and a second reversal attempt on the same payment was correctly rejected with `PM-005` (no double-reversal)
- [x] No overpayment silently accepted without a defined behavior — live-verified 2026-07-15 via `12-payments-import-credit.js` (25/25 passed): the defined behavior is outright rejection, not partial-credit/advance. Paying more than the outstanding balance is rejected with `PM-003`; paying the exact balance succeeds (real boundary check, not just "less than"); any further payment attempt on a now-fully-paid invoice — even ₹1 — is correctly rejected with `PM-002`, confirming the block isn't a one-time check but a persistent invariant.

### Reports & Analytics
- [x] Sales, Inventory, Outstanding, Production, Profit & Loss, and Audit reports all load without error for a real date range — live-verified 2026-07-15 via `05-reports.js` (8/8), `11-billing-reports-round2.js` (25/25, includes P&L revenue/net-profit line checks), and `06-trust-compliance.js` (11/11, includes HSN Summary and GSTR-3B Reconciliation Preview rendering real data). Expense and Tax reports specifically not named-checked this session.
- [x] Every report figure independently reconciles against the source data it's built from — partially confirmed: P&L showed real revenue/net-profit lines tied to seeded invoices, Outstanding/Customer Ledger reports matched the DB's `outstandingBalance` at 5,000-row scale. Not every report's every figure was independently hand-reconciled.
- [x] Dashboard KPIs, charts, and trend indicators match the same source data the reports use — live-verified 2026-07-15 via `12-payments-import-credit.js`: created a real invoice, called `analytics.getDashboardKpis({forceRefresh:true})` (bypassing its cache), and independently queried the database directly with the exact same "today, ACTIVE invoices" logic the KPI function itself uses — both returned 1555, an exact match, reproducible across 2 runs. **Only "today's sales" specifically was cross-checked**; week/month trends, charts, and other individual KPI fields (outstanding, inventory value, top products) were not each independently re-derived this session, though they share the same aggregation code path.

### Import / Export
- [x] Product, Customer, Supplier, and Inventory imports all succeed on valid data — live-verified 2026-07-15 via `12-payments-import-credit.js` (40/40 passed): each wrote a real CSV to disk and drove it through the actual `import.parseDroppedFile` → `import.execute` pipeline (the real parse/map/commit code, bypassing only the native OS file-picker dialog which Playwright can't drive), confirming both `{imported:1}` AND that the resulting record is genuinely findable/correct afterward — Customer import confirmed `creditLimit` carries through correctly, Supplier import confirmed the record exists. **Real, non-obvious finding**: Inventory import is **additive** (`movementType: 'ADDITION'` — imported quantity adds to existing stock, confirmed 10 opening + 25 imported = 35), genuinely different semantics from `inventory.adjustStock` (whose quantity is an absolute target, confirmed earlier this session) — not a bug, but an important distinction for anyone building an inventory-correction import flow expecting "set to X" behavior. **Opening-Balance import specifically not exercised** (same code path as the other 4, lower marginal value).
- [x] Import error reporting is specific enough to act on — live-verified 2026-07-15 via `12-payments-import-credit.js` (30/30 passed): a CSV with 2 invalid rows produced exactly `{"row":3,"message":"Product Name is required"}` and `{"row":4,"message":"Selling Price is required"}` — real row numbers and specific, actionable reasons, not a generic failure message.
- [x] Import failure handling — **checklist item reworded from its original assumption after reading the real code**: `executeImport()` does NOT use an all-or-nothing transaction rollback model — it validates and processes each row independently in a loop, so one bad row doesn't discard the rest of a batch. Live-verified: in the same mixed-CSV test above, the 1 valid row was still successfully imported (confirmed to actually exist afterward) despite the other 2 rows failing validation. This is a deliberate, sound design (partial success + specific per-row reporting, backed by a mandatory pre-import safety backup via `ensureRecentBackup()` for full disaster recovery if needed) rather than a gap — but it does mean "rolls back cleanly" isn't the right mental model to test against; "reports precisely and doesn't lose good data to bad data" is, and that's confirmed.
- [ ] PDF, Excel, and CSV exports open correctly and preserve Unicode — **confirmed genuine gap, not just unwritten**: `window.api.export.toCsv/toExcel/toPdf` all call `dialog.showSaveDialog` internally with no path-based alternative (unlike import, which has `parseDroppedFile` for exactly this reason) — there is no way to drive this end-to-end with the current harness without mocking Electron's `dialog` module. `export.service.test.ts` unit tests pass (40/40 combined with import+backup) but that's the only coverage that exists or can exist without new test infrastructure.

### Printing & Localization
- [x] 58mm/80mm thermal and A4 print layouts — button/path presence live-verified 2026-07-15 via `11-billing-reports-round2.js` for Quotation, Credit Note, Debit Note. Actual rendered paper/PDF output was not visually inspected (button-click-produces-correct-pixels was not asserted).
- [x] QR printing (UPI, where configured) renders correctly — live-verified 2026-07-15 via `12-payments-import-credit.js`: configured a real UPI ID + India as country, confirmed the QR section genuinely renders (`class="qr-section"`) on a credit invoice with a balance due; cleared the UPI ID and confirmed it genuinely disappears on the same invoice. **Two false alarms along the way, both in my own test detection, not the app**: a generic `data:image/png;base64` regex also matched the always-present Aszurex branding mark; the bare string `"qr-section"` also matched that CSS class's *definition* in the `<style>` block (present on every document regardless of QR state) rather than the rendered element. Confirmed via direct main-process stdout capture that the app's own `canShowUpiQr()` logic was correct throughout both false alarms. Fixed by matching `class="qr-section"` (the quoted, rendered form) specifically.
- [x] Currency, date, time, and number formatting are correct for the business's configured locale — **real, confirmed bug found and fixed 2026-07-15**: `print.service.ts` had its own naive `formatAmount` (`${symbol}${amount.toFixed(2)}`) completely separate from the correct, already-existing locale-aware formatter in `currency.service.ts` — every printed invoice/receipt/report showed amounts with **zero digit grouping** (`₹14568.00` instead of `₹14,568.00`), regardless of the `number_format` setting (defaults to `'IN'`). Confirmed via direct print-preview HTML inspection of a real invoice, not just reading the code. Fixed by routing all 48 internal call sites across the 9 affected templates (Invoice, Payslip, Receipt, Quotation ×2, Credit Note ×2, Debit Note ×2) through `currency.service.ts`'s `formatAmount`, fetching the real `number_format`/`decimal_places`/`currency_symbol_position` Settings once per document. Also fixed the one external caller (`billing.handler.ts`'s product-label price text) the same way. Re-verified: `npm run typecheck` 0 errors, `npm run test` 1154/1154 (added a DB mock to `print.service.test.ts`, whose 32 tests newly needed one), and confirmed live against both a dev-mode e2e run (2×) and the rebuilt **packaged installer** (2×) — real print output now shows `₹14,568.00`.
- [x] Unicode renders correctly throughout — live-verified 2026-07-15 via `12-payments-import-credit.js` (real UI interaction, not just Phase 56's build-time translation-file completeness check): clicked the real Language settings tab, clicked the real Hindi row (native-script button text "हिंदी"), confirmed the switch takes effect immediately (`document.documentElement.lang` actually changes to `hi`) and that genuine Devanagari script renders in the live UI (checked the actual Unicode codepoint range U+0900-U+097F in `body.innerText()`, not just "some text changed" — this would catch mojibake/tofu-box failures a looser check wouldn't). Also switched to Arabic and confirmed `document.dir` correctly flips to `rtl` and real Arabic script renders (U+0600-U+06FF range). Restored to English/LTR afterward. **Only Hindi and Arabic specifically exercised** (chosen as the two most distinct scripts — Devanagari and RTL Arabic) — the other 11 languages share the same i18next/`setLanguage()` mechanism, not each individually re-verified.

---

## 4. Security, Permissions, Error Handling

### Security
- [x] All items in Section 1's Security Rules pass — cross-checked 2026-07-15: Section 1 already shows all 4 (contextIsolation/sandbox/nodeIntegration/webSecurity, every IPC handler gated, no payment logic, no telemetry) verified the same day with dated grep evidence
- [x] Password hashing verified — confirmed 2026-07-15 by reading `auth.service.ts` directly: a single `hashPassword()` function at `SALT_ROUNDS = 12` (bcryptjs) is the only path used by user creation (`users.handler.ts`), password change, and the setup wizard (`setup.service.ts`) — no separate/weaker hashing path exists.
- [x] No raw exception text (stack traces, SQL errors) ever reaches a user-facing screen — **real bug found and fixed 2026-07-15**: `hr.service.ts` (15 sites), `job-card.service.ts` (3), `project.service.ts` (8), `service-ticket.service.ts` (3), and `work-log.service.ts` (3) — 32 total — returned `{error: {code, message: e.message}}` with no `instanceof ServiceError` guard, unlike every other service in the codebase (`billing.service.ts`, `payment.service.ts`, `inventory.service.ts`, etc., which all gate raw messages behind a `ServiceError` check or fall back to a generic `SYS-*` message). Since the renderer's standard error-display pattern (`res.error.message`, used in 491 places across 114 files) shows this text directly to the user, any raw Prisma/SQLite exception thrown inside those 32 call sites — e.g. a raw `UNIQUE constraint failed: ...` string — would have reached the screen verbatim. Fixed: all 32 now log the real error server-side (`console.error`) and return a generic friendly message, matching the codebase's own established pattern elsewhere. Verified: `npm run typecheck` 0 errors, `npm run test` 1154/1154 still passing (no test asserted on the old raw-message behavior).
- [x] Audit logging covers every state-changing action, and the audit hash chain verifies clean — re-confirmed 2026-07-15 via `06-trust-compliance.js`: `audit.verifyChain()` reported `ok:true` across 2,696 real log entries (grew from 2,607 earlier the same session from this session's own test activity, consistent with continuous real logging). Note: a real bug existed here until 2026-07-12 where the verifier sorted rows by `createdAt`/`id` instead of walking the actual `prevHash → hash` chain, producing a false "chain_break" under real write concurrency even when the chain was genuinely intact — fixed by reconstructing order from the hash links themselves. If a chain-break is ever reported again, confirm it's real (check whether a "broken" row's `prevHash` exactly matches another row's `hash`, just out of timestamp order) before treating it as data tampering.
  - **A second, different false-positive class found+fixed 2026-07-15**: `AuditLog.userId` has an `ON DELETE SET NULL` foreign key to `User`. Hard-deleting a User whose actions were ever logged silently nulls out `userId` on their historical AuditLog rows — which `verifyAuditLogChain`'s hash (computed over `userId` at write time) then correctly flags as `hash_mismatch`, since the row's content genuinely changed after the fact. Traced to root cause with a reproducible mathematical proof (recomputing the stored hash with the deleted user's ID substituted back in for the null exactly reproduces the original hash, confirming the row itself was never tampered with — only this one FK-cascaded field changed). **Confirmed this is a test-infrastructure artifact, not a product bug**: the real app has no `users:delete` handler at all (only `users:deactivate` — a soft delete), so no real customer action can ever trigger this cascade; it only happened because e2e suites `06-trust-compliance.js` and `13-role-permissions.js` hard-deleted their own test users directly via raw SQL in cleanup. Fixed by switching both suites to soft-delete (`isActive = 0`) unconditionally, matching how the real app itself always handles user removal. The current dev database still carries 6 historical rows with this explained (not fabricated-away) mismatch from before the fix — left as-is rather than risk mutating historical audit data; the packaged/shippable app's own chain was independently verified clean earlier this session and was never exposed to this class of corruption.

### Permissions
Default rule: **access denied unless explicitly allowed.**
- [x] Cashier and Staff roles each see exactly the screens/actions their role grants — live-verified 2026-07-15 via new suite `tests/e2e/suites/13-role-permissions.js` (11/11, reproducibly clean across 2 runs): created real Cashier and Staff users, logged in as each (via the real Sign-Out → login UI flow, not a raw IPC session swap), and confirmed BOTH directions — Cashier's granted `billing.createInvoice` succeeds, Cashier's ungranted `inventory.adjustStock` is blocked (PERM-001); Staff's ungranted `billing.createInvoice` is blocked (PERM-001), Staff's granted `products.view` still works (not over-blocked). Admin is implicitly covered extensively — every other e2e suite this session (dozens of actions across billing/inventory/HR/reports/settings) ran as Admin and succeeded, real evidence Admin's full permission set is correctly wired. **Manager and vertical-specific roles (e.g. Kitchen Staff) not individually re-tested** — Cashier/Staff/Admin were the three most distinct/highest-value permission sets to prove the enforcement mechanism itself works correctly in both directions.
- [x] No screen is reachable by URL/hash navigation that bypasses its own permission gate — live-verified 2026-07-15 via the same suite: as Cashier, hash-navigating directly to `#/inventory/movements` (a screen gated on `inventory.viewMovements`, which Cashier lacks) rendered the real `ProtectedRoute` "Access Denied" screen, not the actual data; same result for Staff navigating to `#/billing/new`. This is a client-side UI gate — real security is enforced separately at the IPC layer (`requirePermission`), which the tests above also confirm independently blocks the underlying action regardless of what the UI shows.

---

## 5. UI, Branding, Legal, Performance

### UI
- [ ] Design consistency across screens (spacing, type scale, color use)
- [ ] Empty states and loading states exist for every data-driven screen (not just the happy path)
- [x] Keyboard navigation and basic accessibility (focus order, labels) work — light, concrete spot-check live-verified 2026-07-15 via new `tests/e2e/a11y-check.js` (permanent asset, 7/7 passed, 2 consecutive runs) on the Customer form (a representative real form modal): real `Tab` keypresses moved focus through 8 distinct, genuinely visible elements (never landing on a hidden/off-screen element), and 7 of 8 focused elements had a real accessible name (label/placeholder/aria-label) — not just "the form renders," actual keyboard-only traversal. **This is a targeted spot-check on one representative screen, not a full audit of every screen** — Design consistency and per-screen empty/loading states remain genuinely unverified, as they need visual/subjective human judgment this session structurally cannot provide.

### Branding & Legal
- [x] Sarang and Aszurex branding present — live-verified 2026-07-15 via `08-branding-legal.js` (7/7 passed): "aszurex.com" confirmed present in both the invoice print-preview HTML and the generic report-HTML generator. "Not intrusive" is a visual judgment call this session couldn't make (no interactive-desktop access, see Section 7) — presence confirmed, subjective tastefulness not.
- [x] Disclaimer flow works — live-verified 2026-07-15: resetting the `disclaimer_accepted` Setting correctly re-shows the disclaimer screen, the accept button stays disabled until the checkbox is checked, and accepting correctly dismisses it and resumes normal app flow.
- [x] No misleading claims, no compliance guarantees this app can't actually back — text audited 2026-07-15 (`DisclaimerScreen.tsx` + its `disclaimer.legalNotice` i18n string): explicitly states "This is not accounting software... consult a CA or accountant for tax and legal matters," and the legal notice explicitly disclaims being "a medical record system, accounting software, legal advice tool, or licensed financial product" with "no warranties for accuracy, completeness, or fitness... for any regulated purpose." No overreach found.
- [x] Privacy statement present and accurate — text audited 2026-07-15 (`AboutScreen.tsx`'s "Privacy & Data" section): states "100% offline-first," "No cloud storage. No telemetry. No tracking," and specifically calls out the one real exception ("Checking for software updates... is the one optional exception, and only runs when you choose to check") — matches exactly what Section 1's security-rules grep independently found in the code (the one disclosed, user-initiated update-check `fetch`). Also correctly states Sarang doesn't process/verify payments, matching Section 1's grep for payment-processing code (zero matches).

### Performance
Measure on the representative hardware class this app targets (a mid-range
laptop, not a dev workstation — see `PHASE_57_TECHNICAL_SPEC.md`'s own
benchmark methodology for why this matters):
- [x] Startup < 3 seconds — **corrected 2026-07-15, same session**: the earlier dev-mode measurement above was invalid (wrong artifact); re-measured against the real packaged, installed production build directly via Win32 `Start-Process` + `EnumWindows` (no Playwright/CDP instrumentation overhead, which the earlier dev-mode e2e scripts' own ~2-6s "app ready" numbers likely included). **Real result: 735-841ms across 3 clean consecutive runs** (time from process launch to the actual titled main window appearing) — comfortably under the 3-second target, on this dev machine (not dedicated representative low-spec hardware, so treat as a strong positive signal, not a guarantee across all target hardware).
- [x] Dashboard load < 2 seconds — live-measured 2026-07-15: 1.15-1.19s post-login navigation to `#/dashboard` across 2 runs, consistently under target. This part of the measurement is valid regardless of dev-vs-packaged build (it's post-launch React render/data-fetch time, not process startup).
- [x] Reports < 3 seconds — live-measured 2026-07-15 across multiple suites: Customer Ledger report at 5,000-row scale rendered in 5.3s (target for that suite was 8s, a deliberately looser bound for heavy-scale data — see `09-stress.js`), Outstanding report in 2.6s, most standard reports (Sales/Inventory/P&L/HSN/GSTR-3B) rendered well within their suites' own timeout windows without a crash. Standard-scale reports are comfortably under 3s; only the deliberately-stressed 5,000-row case approached it.
- [ ] Search feels immediate — live-measured (not subjectively judged): product search across 2,000 items completed in 4-12ms (`09-stress.js`). Objectively fast; "feels immediate" as a subjective UX judgment not separately assessed.

---

## 6. Build Steps

**Real, severe bug found and fixed while executing this checklist for the
first time (2026-07-15)**: `npm run dist:win` (and `dist`/`pack`) never
passed `--config electron-builder.config.ts` to electron-builder. Without
that flag, electron-builder silently falls back to every default —
confirmed by actually running the old command and inspecting the output:
wrong output directory (`dist/` instead of the configured `release/`),
wrong installer filename (`sarang-business-os Setup 1.0.0.exe` instead of
`Sarang-Business-OS-Lite-Setup-1.0.0.exe`), the **default Electron icon**
instead of the real branded one (`resources/icon.ico` is valid and
correctly referenced in the config — it was just never read), and most
seriously: **the AI Assistant's bundled model file
(`Qwen2.5-1.5B-Instruct-Q4_K_M.gguf`, the `extraResources` entry in the
config) was completely absent from the packaged app.** Had this build
shipped, the AI Assistant feature would fail for every customer with "model
file not found" the first time anyone asked it a question — a real,
previously-undetected release-blocker, not a hypothetical one. Fixed by
adding `--config electron-builder.config.ts` to all three scripts in
`package.json` (`pack`, `dist`, `dist:win`); re-run and confirmed the
rebuilt package now contains the real icon, the correct output path/name,
and the `.gguf` model file.

```bash
# From project root
npm install
npm run db:generate     # prisma generate — re-run after ANY schema change
npm run typecheck
npm run build            # electron-vite build
npm run dist:win         # npm run build && electron-builder --config electron-builder.config.ts --win
```
Output: `release/Sarang-Business-OS-Lite-Setup-{version}.exe`

- [x] All four commands complete without error, in order — verified 2026-07-15 (after the `--config` fix; the first attempt "succeeded" too, silently wrong, see above)
- [x] Installer file exists at the expected path under `release/` — verified 2026-07-15, latest rebuild (after the critical Prisma-packaging fix, see Section 7): `release/Sarang-Business-OS-Lite-Setup-1.0.0.exe`, 1,109,342,592 bytes
- [x] AI Assistant `.gguf` model file confirmed present in the packaged output — verified 2026-07-15: `release/win-unpacked/resources/models/Qwen2.5-1.5B-Instruct-Q4_K_M.gguf`, 986,048,768 bytes (unchanged by the Prisma fix, re-confirmed present)
- [x] Real Sarang icon confirmed (no "default Electron icon" warning in the build log) — verified 2026-07-15
- [x] Installer is unsigned by default (electron-builder) unless `WINDOWS_CERT_PATH`/`WINDOWS_CERT_PASSWORD` env vars are set — verified 2026-07-15 via `Get-AuthenticodeSignature`: `NotSigned` (the "signing with signtool.exe" build-log lines are resource/icon embedding, not Authenticode signing). Sign before public distribution if required for this release.

---

## 7. Post-Build Verification

### Fresh Install (target: first invoice in < 15 minutes)
- [x] Install: `Sarang-Business-OS-Lite-Setup-1.0.0.exe /S` (silent) — **real install, verified 2026-07-15 on this dev machine** (not a clean VM, see caveat below): completed in 42.5 seconds, exit code 0.
  - **Real gotcha found running this from Git Bash**: MSYS2/Git-Bash automatically mangles a bare `/S` argument into a fake Windows path (`S:/`) before the installer ever sees it, silently breaking the "silent install" flag — the installer then sat idle for 9+ minutes doing nothing (not crashed, not erroring, just never actually starting because of the garbled argument). **Always invoke this installer's silent flag from PowerShell (`Start-Process ... -ArgumentList "/S"`) or CMD, never bare Git Bash** — or if Bash is unavoidable, use `//S` (doubled leading slash, the standard MSYS2 escape) instead of `/S`.
  - [x] Desktop shortcut created — verified: `Sarang Business OS Lite.lnk` on the real Desktop
  - [x] Start Menu shortcut created — verified: `Sarang Business OS Lite.lnk` under Start Menu\Programs
  - [x] Install directory populated correctly, including the `.gguf` AI model at the real installed path (`%LOCALAPPDATA%\Programs\Sarang Business OS Lite\resources\models\`)
  - [x] App launches without crashing — **CORRECTED 2026-07-15, same day, later in this session: the earlier "verified" line above was WRONG.** "3 stable, responding processes with sane memory" is NOT evidence the app actually launched — it was, in fact, crashing on 100% of launches at that exact point in the session, and the crashed process's sub-processes staying resident and "Responding: True" is *why* the false-positive happened. Two real, confirmed, now-fixed bugs:
    1. **Packaging bug**: `electron-builder.config.ts`'s `files`/`asarUnpack` config never actually got `node_modules/.prisma/client` (the generated Prisma client — plain JS files, not just the native query-engine binary) into the shipped app at all. Every launch crashed immediately with an uncaught main-process exception, `Cannot find module '.prisma/client/default'`, before any window ever rendered. Found by specifically checking for a real visible window via Win32 `EnumWindows` (not just process liveness) and reading the actual Error dialog's text via UI Automation. Root-caused by tracing electron-builder's own `fileMatcher.js` source; fixed by combining an object-form `files` copy-rule (to select the directory at all) with broadening `asarUnpack` to cover the whole directory, not just `**/*.node` (physically unpacking it, since writing it into the asar proper was silently lossy for non-native files — neither alone was sufficient, confirmed by testing each in isolation). See the long comment on that config file for the full trace.
    2. **Migration bug**: `NormalRangeReference` (a real model in `schema.prisma`, Phase 54B vitals normal-range flagging) had *no migration file at all* anywhere in `prisma/migrations/` — confirmed by cross-checking all 156 schema models against every `CREATE TABLE` statement across all migration files; this was the only *missing table*. Invisible in all prior dev-mode testing because dev mode creates tables straight from `schema.prisma` (masking the gap); only a genuine fresh install running the real migration-runner surfaces it. Fixed with a new migration (`20260715173500_add_missing_normal_range_reference_table`), SQL-validated against a fresh in-memory DB before shipping.
    3. **Broader schema-drift bug (found immediately after fixing #1 and #2, same session)**: fixing the crash-on-launch bug let the app boot far enough to reach the Setup Wizard for the first time — which then failed on 100% of attempts with "Setup could not be completed," because `BusinessProfile.clinicSpecialty` (a real schema.prisma field) had no migration column either. My table-name-only cross-check for bug #2 had missed *column*-level drift entirely. Re-checked properly this time using Prisma's own authoritative tool (`prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma --script`) instead of hand-rolled regex — found **5 more tables with missing columns** (`BusinessProfile.clinicSpecialty`, `CoachingFeeRecord.invoiceId`, `GoodsReceiptNote.reversedAt`, `RetainerAgreement.lastInvoicedPeriod`, and `VisitNote`'s entire vitals feature — 7 columns, the other half of the same Phase 54B work as bug #2) plus a missing foreign-key constraint on `DrivingSession.packageEnrollmentId` and one missing index on `FreightLedger`. Fixed with one migration (`20260715183500_catch_up_full_schema_drift`) built directly from Prisma's own diff output (not hand-written), SQL-validated by replaying all 49 migrations against a fresh in-memory DB before shipping. (The diff also proposed 6 cosmetic index-renames that SQLite refuses to apply — `DROP INDEX` on an autoindex backing an inline `UNIQUE` constraint is a hard SQLite limitation, not a bug — deliberately excluded and documented in the migration file itself; the actual uniqueness constraints are already correctly enforced either way.)
    - **All three fixes verified together via a real, complete, END-TO-END fresh-install cycle** (not just "a window appeared" — the full user journey): wiped `%APPDATA%\sarang-business-os` entirely (true new-user simulation), reinstalled with the rebuilt installer, and scripted the real packaged app through Setup Wizard → login → first customer → first product → first invoice via a new Playwright driver (`tests/e2e/packaged-fresh-install-flow.js`, kept as a permanent asset). **Result, confirmed clean on 2 consecutive full runs**: Setup Wizard completes, invoice total correct (118 = 100 × 1.18 tax, verified programmatically), first invoice created **13.4-14.8 seconds** after app launch — comfortably under the 15-minute target (scripted speed, not a human's, but proves the mechanical path has zero blocking bugs left). `npm run typecheck` (0 errors) and `npm run test` (1154/1154) re-confirmed clean after all three fixes.
    - **Lesson applied going forward**: (a) process-alive + "Responding: True" is not evidence an Electron app actually works — always confirm a real, titled, visible window exists before treating a launch as successful; (b) a table-existence check is not a complete migration-drift check — always use `prisma migrate diff` against the full schema, not a hand-rolled cross-check that only catches missing tables and misses missing columns/constraints/indexes.
  - [x] Visual confirmation the window actually renders — confirmed via both Win32 `EnumWindows`/`GetWindowText` (OS-level, on the earlier crash-fix verification) and this session's full scripted UI walkthrough (Playwright driving real buttons/inputs through 7 wizard steps, which only works if the real DOM is rendering and interactive) — this is strictly stronger evidence than either alone. A human visually confirming the pixels look correct (fonts, layout, no visual corruption) still hasn't been done and remains worth doing once, but functional rendering is now thoroughly confirmed.
- [x] Setup Wizard completes: business name, type, currency — live-verified 2026-07-15 via `packaged-fresh-install-flow.js` against the real packaged build: all 7 steps (Welcome, Business Type, Business Info, Region, Tax, Logo, Admin Account) completed successfully, confirmed clean on 2 consecutive fresh-install runs.
- [x] Create first customer, first product, first invoice — live-verified 2026-07-15, same script: all three succeed via the real authenticated session immediately after setup.
- [x] Invoice total is correct — live-verified 2026-07-15: 1 unit @ ₹100 + 18% GST = ₹118, matches exactly. **Recording a payment updating the dashboard was not separately scripted this pass** (payment recording itself is already covered by `tests/e2e/suites/12-payments-import-credit.js`, but not specifically chained onto this fresh-install flow).
- [x] **Total elapsed time, installer-start to first recorded... invoice**: 13.4-14.8 seconds from app-window-ready to first invoice created (scripted), well under the 15-minute target. Installer execution itself (silent install to exit code 0) separately measured at 42.5s earlier this session. **Caveat**: this is automation speed, not a real first-time user's speed (reading each wizard screen, choosing options thoughtfully) — the target is really about the app not getting in the user's way, which this confirms structurally (no blocking errors, no dead ends) without claiming to predict real human timing.
- [ ] Still needs a genuinely clean VM (no Node.js/dev tools/existing `.dev-data`) — this session's install was onto the dev machine that built it, which proves the installer mechanics work but not that it's clean of dev-environment assumptions. **Partial substitute check done 2026-07-15** (this environment has no VM-provisioning access): scanned the actual packaged `app.asar` for the two most likely real leaks — zero hardcoded dev-machine paths anywhere in the bundled main-process code (`grep`'d for this machine's actual paths/username, zero matches, both in `out/main/index.js` and the extracted-from-asar copy), and no dev-only tooling (TypeScript compiler, Vite, the `electron` dev package itself) accidentally bundled as a real runtime dependency. **Could not check**: whether the native `.node` addons (Prisma's query engine, node-llama-cpp) depend on the Visual C++ Redistributable being separately installed on the target machine — this needs either a real clean VM or PE-dependency-inspection tooling (`dumpbin`/`objdump`), neither available in this environment. This is the single most plausible way a clean machine could fail differently from this dev box and remains a genuine, unclosed gap — flagged clearly rather than assumed fine.

### Upgrade (from the previous shipped version)
- [ ] Install the prior version, create real test data (customer, invoice, payment) — **not applicable yet, honestly**: this is V1, the first release ever built through this checklist. There is no "previous shipped version" to upgrade from. Revisit this whole subsection the first time a V1.0.1+ installer is built over a real V1.0.0 install in the field.
- [ ] Note the DB path — **doc correction 2026-07-15**: the real path is `%APPDATA%\sarang-business-os\sarang.db`, not `%APPDATA%\Sarang Business OS Lite\sarang.db` as this line previously said (Electron's default `app.getPath('userData')` uses `package.json`'s `name` field, `sarang-business-os`, not the display `productName`) — verified directly against a real install this session. Fixed here so a future manual check doesn't go looking in the wrong folder.
- [ ] Run the new installer over the old install — blocked on there being an old install to run over (see above)
- [ ] Confirm the console/log shows a pre-upgrade backup was saved
- [ ] Confirm the backup file exists in `%APPDATA%\sarang-business-os\backups\pre-upgrade-*.db`
- [ ] Confirm all prior test data is intact and new features work

### Uninstall
- [x] Uninstall via Add/Remove Programs — live-verified 2026-07-15: confirmed the app is genuinely registered under `HKCU:\...\Uninstall\*` (`DisplayName: "Sarang Business OS Lite 1.0.0"`) before testing, then ran the real uninstaller silently (`Uninstall Sarang Business OS Lite.exe /S`), exit code 0.
- [x] App removed from Start Menu / Desktop — verified: both `.lnk` files gone, install directory gone, registry entry gone (fully deregistered, not just files deleted).
- [x] `%APPDATA%\sarang-business-os\` and its `sarang.db` **still exist** — uninstall must never delete user data — live-verified 2026-07-15: not just file-existence-checked but **data-integrity-checked**, directly querying the surviving `sarang.db` after uninstall and confirming the real customer/invoice created earlier in this session's fresh-install test were both still present and intact (1 customer, 1 invoice, byte-for-byte the same data). `backups/` specifically didn't exist to check — no backup had run yet in this short-lived test session (auto-backup is interval-based, not immediate-on-first-launch) — not a gap in this verification, just nothing to check yet.

### Feature Smoke Test
Live-verified 2026-07-15 against the real packaged, installed app via
`tests/e2e/packaged-feature-smoke.js` (kept as a permanent asset) — 16/16
passed, reproducibly clean.
- [x] Dark mode toggle — confirmed the theme actually flips (`document.documentElement` dark-mode marker false→true→false), not just that the button exists
- [x] Command Palette live search — fully confirmed: opens, real search input found, typing "customer" changes the rendered result set. **Correction from an earlier pass in this same session**: I first tried triggering it via the `Ctrl+K` keyboard shortcut and wrongly concluded it "opened" — that was a false positive in my own test (matching the TopBar's always-present "Search (Ctrl+K)" *button label* text, not the palette actually mounting; a follow-up check found zero `<input>` elements anywhere on the page at that point, proving it hadn't really opened). Switched to clicking the real trigger button directly, which works completely. **The `Ctrl+K` keyboard shortcut specifically remains unconfirmed in automation** — the handler code itself is correctly implemented (`AppLayout.tsx`: `(e.ctrlKey || e.metaKey) && e.key === 'k'`), so this reads as an OS-level window-focus quirk of scripted Electron testing rather than a product defect, but it hasn't been confirmed working with a real keypress, only via the button.
- [x] Dashboard KPI tabs (Today/Week/Month/Year) — all 4 confirmed clickable with no crash
- [x] Billing — real invoice created via the authenticated session (total=21, matches 1×20 @ 5% tax)
- [x] Inventory — screen loads, shows the real product just created
- [x] Customers — screen loads, shows the real customer just created
- [x] Suppliers — real supplier created successfully
- [x] Reports — Sales report generates successfully with real data
- [x] Settings — screen loads without error
- [x] Backup/Restore — full round-trip live-verified 2026-07-15 via new `tests/e2e/packaged-backup-restore.js` (permanent asset), 7/7 passed on 2 consecutive runs. A real backup file is created and self-validated (checksum, `isValid: true`). **Restore genuinely reverts state, confirmed by proof-of-effect, not just a success response**: created a customer, backed up, created a second customer, restored — the first customer survived and the second was correctly gone afterward, proving the DB was actually replaced. Also confirmed `restoreBackup()`'s real design: it calls `app.relaunch()` + `app.exit(0)` on success (a full process restart to safely reconnect Prisma to the swapped DB file) — my first test attempt misread the resulting connection drop as a crash before realizing it's intentional; verification was redone against the DB file directly post-relaunch instead of trying to keep using the same window handle.

---

## 8. Known Limitations (document for customers, keep in sync with reality)

- Windows x64 only (no 32-bit, no macOS, no Linux)
- Requires Windows 10 version 1903 or later; minimum 4GB RAM, 500MB free disk (before the AI Assistant model — see the installer-size note at the top of this file if that module is included)
- No automatic software updates — customers install new versions manually
- UPI QR codes are display-only — Sarang never processes or verifies payments, by design
- If the AI Assistant module is included: English-only, and every answer stays on-device (never sent anywhere) — see `AI_ASSISTANT_MASTER_PROMPT.md` (outside this repo, at `D:\Sarang(business OS LITE)\`) and `PHASE_57_COMPLETION_REPORT.md` (this repo's root) for the full design record

*(Do not list "icons are placeholders" here unless they actually are — check Section 1's Assets item first. The two prior versions of this checklist disagreed with each other on exactly this point.)*

---

## 9. Final Approval

| Approval | Name | Date | Notes |
|---|---|---|---|
| Technical | | | typecheck/lint/test/build all pass |
| QA | | | Business-logic checklists (Section 3) complete |
| Security | | | Section 1 + 4 security items complete |
| Release | | | Final go/no-go |

**Release blockers** (any one of these halts the release regardless of what else is signed off): unresolved data-loss risk, unresolved backup issue, unresolved migration issue, unresolved security issue, any Mission-Critical (Billing/Inventory) test failing.

**Status note, 2026-07-15 (not a sign-off — the table above is for a human to actually fill in)**: against the exact blocker list above, everything checked live this session comes back clear — no data-loss risk found, backup create+validate confirmed working with a real checksummed file, the migration issue that WAS unresolved (a completely broken installer, see Section 7) is now fixed and re-verified end-to-end, Section 1/4 security items all verified, and Billing/Inventory mission-critical tests are passing (Sections 3/7). This is a status summary of what was checked, not an approval — Technical/QA/Security/Release sign-off is a human decision this file deliberately doesn't make on anyone's behalf.

## 10. Release Artifacts & Post-Release

- `release/Sarang-Business-OS-Lite-Setup-{version}.exe`
- Release notes: new features, improvements, bug fixes, migration notes, known limitations
- After release: fresh install, upgrade, backup, reports, and analytics re-verified against the actual shipped build (not the last dev build)

---

*A successful release is not one with new features. A successful release is one users can trust. Powered by Aszurex.*
