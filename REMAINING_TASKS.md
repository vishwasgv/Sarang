# Sarang Business OS — Remaining Task Roadmap

## Current Honest Score: ~7.8 / 10
Target: 10 / 10

### What Was Completed (Sessions 1–3)
- [x] All 33+ screens: hardcoded `₹` → `formatCurrency()`, `en-IN` → `locale.util`
- [x] 13 language JSON files created (8 Indian + 5 international + Arabic RTL)
- [x] Language selector with flags, RTL direction toggle
- [x] SetupWizard: 25+ country → auto-set currency + tax model
- [x] SetupWizard: "Tax / GST / VAT Number (Optional)" generic label
- [x] CurrencyLocaleSection in Settings
- [x] `formatTime()` added, `split(',')` bug fixed
- [x] Main process services: `undefined` locale, no `₹` in error strings
- [x] Tax models: GST / VAT / SALES_TAX / CUSTOM / NONE in setup

---

## Phase 16 — Translation System Wiring
**Gap:** Language JSON files exist but `useTranslation` / `t()` is called ONLY in Sidebar and SettingsScreen.
Every form label, table header, button text, and error message in all 33 screens is hardcoded English.
Selecting "Hindi" or "Spanish" translates the nav sidebar only — nothing else.

### 16.1 — Expand en.json with all missing screen keys
- [x] Add `expenses` section keys
- [x] Add `reports` section keys
- [x] Add `cashClose` section keys
- [x] Add `suppliers` section keys
- [x] Add `purchaseOrders` section keys
- [x] Add `returns` section keys
- [x] Add `documents` section keys (covers import screen)
- [x] Add `manufacturing` section keys (raw materials, BOM, production orders, finished goods, vendors, dispatch)
- [x] Add `service` section keys (projects, job cards, tickets, work tracking, customer history)
- [x] Add `about` section keys
- [x] Add `audit` section keys
- [x] Add `backup` section keys

### 16.2 — Wire t() into core screens (highest traffic)
- [x] `DashboardScreen.tsx` — titles, quick action labels, chart labels, KPI cards, inventory health
- [x] `InvoiceListScreen.tsx` — table headers, status badges, filters, pagination
- [x] `ProductsScreen.tsx` — table headers, type badges, buttons, confirm dialog
- [x] `CustomersScreen.tsx` — table headers, buttons, search, confirm dialog
- [x] `ExpensesScreen.tsx` — form labels, table headers, filter, modal, confirm dialog
- [x] `ReportsScreen.tsx` — sidebar, filters, group-by, run button, empty states
- [x] `SuppliersScreen.tsx` — table headers, buttons, search, confirm dialog
- [x] `InventoryScreen.tsx` — headers, column labels, alert badges, filter buttons
- [x] `LoginScreen.tsx` — form labels, button, footer
- [x] `BackupScreen.tsx` — title, toasts, refresh button
- [x] `BillingScreen.tsx` — cart labels, payment labels, totals, buttons, quick-add modal
- [x] `InvoiceDetailScreen.tsx` — labels, section headers, payment form

### 16.3 — Wire t() into remaining screens
- [x] `CashCloseScreen.tsx`
- [x] `ReturnScreen.tsx`
- [x] `AuditLogsScreen.tsx`
- [x] `DocumentsScreen.tsx`
- [x] Manufacturing screens (7 screens)
- [x] Service screens (6 screens)
- [x] Sub-screens: inventory movements, batch, serial, PO, PO detail, customer detail, supplier detail

### 16.4 — Update all 12 non-English language files
- [x] hi.json, es.json, fr.json, ar.json, pt.json — updated (prior session)
- [x] id.json, mr.json, gu.json, kn.json, ta.json, te.json, ml.json — updated (this session)
- [x] Sync new en.json keys (signIn, archiveSupplier, physical, service, groupBy, day/week/month/year, backup sub-keys, inventory.noInventory, next, etc.) into all 12 non-English files

---

## Phase 17 — Tax Model Globalization
**Gap:** Billing screen and invoice detail show Indian tax structure (CGST/SGST/IGST) for ALL users,
even when tax model is VAT or SALES_TAX. Non-Indian users see India-specific labels.

### 17.1 — Tax label adapter utility
- [x] Create `getTaxLabel(taxModel, rate)` utility → returns "GST", "VAT", "Sales Tax", "Tax" based on profile
- [x] Create `splitTaxLines(taxModel, taxAmount)` → for GST: CGST/SGST split; for VAT: single line; for SALES_TAX: single line

### 17.2 — Invoice detail tax breakdown
- [x] `InvoiceDetailScreen.tsx`: show CGST/SGST only when `taxModel = 'GST'`, else show "VAT X%" or "Tax X%"
- [x] Invoice print template: same conditional tax breakdown (already done in print.service.ts)
- [x] `BillingScreen.tsx`: tax line label adapts to tax model

### 17.3 — GSTR-1 visibility
- [x] `ReportsScreen.tsx`: GSTR-1 report option visible only when `taxModel = 'GST'`
- [x] Add GSTR-1 as a report tab in ReportsScreen (B2B + B2CS tables, summary cards, disclaimer)

---

## Phase 18 — Dark Mode (Content Area)
**Gap:** Sidebar is dark, content area is always light. No dark mode toggle. Many screens have
`dark:` classes already on cards but the `dark` root class is never set.

### 18.1 — Dark mode toggle
- [x] Add `darkMode` to `useThemeStore` (localStorage + system preference fallback)
- [x] `SettingsScreen.tsx`: Appearance section added with Dark Mode toggle switch
- [x] `App.tsx`: `useThemeStore()` called on startup to apply dark class immediately
- [x] Persist preference across restarts

### 18.2 — Dark mode coverage audit
- [x] Screens already have `dark:` Tailwind classes from prior build
- [x] Appearance section also includes Print Type selector (A4 / Thermal 80mm / Thermal 58mm)

---

## Phase 19 — Onboarding Hints (First-Time UX)
**Gap:** New user lands on Dashboard with no guidance. No hints on what to do first.
No tooltips explaining features.

### 19.1 — First-run detection
- [x] Track `sarang-onboarding-dismissed` flag in localStorage
- [x] Show checklist only when products/customers/invoices are 0; dismissable

### 19.2 — Dashboard onboarding
- [x] Quick-start checklist: Add product ✓ | Add customer ✓ | Create first invoice ✓ with "Go →" links
- [x] Auto-completes each step using KPI data (inventoryStats.total, customerCount, monthSales)

### 19.3 — Screen-level hints
- [x] BillingScreen: "Search for a product on the left or scan a barcode to add items to the cart"
- [x] ProductsScreen: "Add your first product to start billing" banner when total=0
- [x] CustomersScreen: "Add customers to track credit and ledger" banner when total=0
- [x] InventoryScreen: "Set reorder levels to get low-stock alerts" banner when total=0

---

## Phase 20 — Billing Feature Depth
**Gap:** Feature depth was scored 7/10. Missing: proforma invoices, quotations/estimates,
credit notes, debit notes.

### 20.1 — Quotations / Estimates
- [x] Prisma model `Quotation` + `QuotationItem` (DRAFT/SENT/ACCEPTED/EXPIRED)
- [x] `quotation.service.ts` — create, list, getById, updateStatus, convertToInvoice, delete
- [x] IPC handler + preload bridge + channels.ts type
- [x] `QuotationsScreen.tsx` — list with status badges, convert-to-invoice button
- [x] `QuotationFormScreen.tsx` — line-item form with totals preview
- [x] Router wired: /billing/quotations, /billing/quotations/new

### 20.2 — Credit Notes
- [x] Prisma model `CreditNote` (customerId?, invoiceId?, reason, amount)
- [x] `credit-note.service.ts` — create, list, getById, delete
- [x] IPC handler + preload bridge + channels.ts type
- [x] `CreditNotesScreen.tsx` — list + inline create form

### 20.3 — Debit Notes
- [x] Prisma model `DebitNote` (supplierId?, purchaseOrderId?, reason, amount)
- [x] `debit-note.service.ts` — create, list, getById, delete
- [x] IPC handler + preload bridge + channels.ts type
- [x] `DebitNotesScreen.tsx` — list + inline create form

---

## Phase 21 — ESC/POS Thermal Printer
**Gap:** Most Indian shopkeepers use 80mm thermal receipt printers. Current print goes through
Electron's `printToPDF` / system print dialog. Thermal printers need direct ESC/POS byte commands
and 80mm-optimized layout.

### 21.1 — 80mm receipt layout
- [x] `print.service.ts` already had `generateReceiptHtml(invoice, profile, '80mm'|'58mm')` — monospace, correct width
- [x] CGST/SGST split in receipt matches tax model

### 21.2 — Print routing
- [x] `billing.handler.ts` `print:invoice` now reads `print_type` setting from DB
- [x] Automatically routes to receipt template for THERMAL_80MM/THERMAL_58MM, A4 for default
- [x] No node-escpos integration (requires hardware; Electron system print handles thermal POS)

### 21.3 — Print settings
- [x] SettingsScreen Appearance section: Print Type selector (A4 / Thermal 80mm / Thermal 58mm)
- [x] Persists via `settings:set` API to DB `Setting` table with key `print_type`

---

## Execution Order (Highest ROI First)
1. **Phase 16** — Translation wiring (most visible gap for "global" claim)
2. **Phase 17** — Tax labels (correctness for international users)
3. **Phase 18** — Dark mode (quick, high perceived quality boost)
4. **Phase 19** — Onboarding hints (quick, improves new user experience)
5. **Phase 20** — Billing depth (feature completeness)
6. **Phase 21** — ESC/POS (requires hardware testing)

---

## Score Projection After Each Phase
| After Phase | Estimated Score | Key improvement |
|-------------|-----------------|-----------------|
| Current     | 7.8 / 10        | Locale + currency fixed |
| + Phase 16  | 8.5 / 10        | Languages actually work |
| + Phase 17  | 8.8 / 10        | Tax model correct globally |
| + Phase 18  | 9.0 / 10        | Dark mode + polish |
| + Phase 19  | 9.2 / 10        | New user experience |
| + Phase 20  | 9.5 / 10        | Billing completeness |
| + Phase 21  | 9.8 / 10        | Hardware ready for India |
