# Phase 43 — Batch 1 (Core + Product-Vertical + Logistics): Technical Spec

## 0. Correction to the master plan

`PRODUCT_HARDENING_MASTER_PROMPT.md`'s Phase 43 scope statement cites "101
total screens (33 core, 23 product-vertical, 45 service-vertical)." A fresh
audit this session found the survey it was based on completely omitted two
module folders — `logistics` (7 screens) and `restaurant` (3 screens) — never
counted in any of the three sub-totals. **Real total: 111 screens / 109
remaining** after the 2 already-retrofitted POC screens (`MembershipsScreen`,
`DrivingSchoolScreen`). This spec's batch boundaries are corrected
accordingly. Per explicit founder instruction ("cover everything, nothing
should be missed"), every one of the 109 screens is committed across the 5
batches below — none are silently dropped, including the ones flagged as a
poor fit for a blind primitive swap (they get a partial, scoped retrofit
instead of exclusion).

## 1. Batch plan (all 5, for context — this spec covers Batch 1 only)

1. **Batch 1 (this spec) — Core + Product-vertical + Logistics: 63 screens**
2. Batch 2 — Service generic + Restaurant: ~9 screens
3. Batch 3 — service-business clinical/healthcare family: ~9 screens
4. Batch 4 — service-business professional/legal-finance family: ~8 screens
5. Batch 5 — service-business education/creative/trade/ops remainder: ~20 screens

Each batch is its own numbered phase with its own spec/sign-off/completion
report per the master plan's Section 4 gate — unchanged.

## 2. Batch 1 — exact file list (63 files, verified via `ls`, not estimated)

| Module | Files |
|---|---|
| `billing` (8) | BillingScreen, CreditNotesScreen, DebitNotesScreen, InvoiceDetailScreen, InvoiceListScreen, PaymentHistoryScreen, QuotationFormScreen, QuotationsScreen |
| `customers` (3) | CustomerDetailScreen, CustomerFormModal, CustomersScreen |
| `hr` (4) | AttendanceScreen, EmployeesScreen, LeaveScreen, SalaryReferenceScreen |
| `suppliers` (3) | SupplierDetailScreen, SupplierFormModal, SuppliersScreen |
| `reports` (1) | ReportsScreen |
| `settings` (2) | AboutScreen, SettingsScreen |
| `audit` (1) | AuditLogsScreen |
| `backup` (1) | BackupScreen |
| `cashclose` (1) | CashCloseScreen |
| `documents` (2) | DocumentPanel, DocumentsScreen |
| `expenses` (1) | ExpensesScreen |
| `import` (1) | ImportWizardScreen |
| `industry` (1) | IndustrySettingsScreen |
| `distributor` (2) | BulkOrderScreen, OutstandingAnalyticsScreen |
| `inventory` (8) | BatchManagementScreen, InventoryMovementsScreen, InventoryScreen, PurchaseOrderDetailScreen, PurchaseOrderFormModal, PurchaseOrdersScreen, SerialTrackingScreen, StockAdjustmentModal |
| `manufacturing` (7) | BillOfMaterialsScreen, DispatchTrackingScreen, FinishedGoodsScreen, ProductionAnalyticsScreen, ProductionOrdersScreen, RawMaterialsScreen, VendorManagementScreen |
| `products` (5) | CategoryManageModal, PrintLabelsScreen, ProductFormModal, ProductsScreen, VariantManagementModal |
| `retail` (1) | ReturnScreen |
| `logistics` (7) | CarriersScreen, ChallanScreen, FleetScreen, FreightLedgerScreen, GRNScreen, LogisticsAnalyticsScreen, ShipmentsScreen |
| `auth` (1) | LoginScreen — light-touch pass, see §4 |
| `disclaimer` (1) | DisclaimerScreen — light-touch pass, see §4 |
| `setup` (1) | SetupWizard — light-touch pass, see §4 |
| `dashboard` (1) | DashboardScreen — scoped pass, see §4 |

59 standard-retrofit files + 4 light-touch/scoped files = **63 total**.

## 3. Retrofit methodology (applied per file)

For each of the 59 standard files, check for and convert each pattern that's
actually present (not every file has every pattern):

1. **Status-color-map objects** (`STATUS_COLORS`/`*_VARIANT`/ad-hoc
   `Record<string, string>` used to color a pill) → `Badge` with a
   `variant` map, same convention established in the Phase 42 POC
   (`STATUS_VARIANT`/`PAYMENT_VARIANT` constants in `MembershipsScreen.tsx`).
   Every status enum value must map to a real variant — no silent
   fallback-to-neutral for a value the schema can actually produce (this was
   a real bug caught in Phase 42's final audit; check it explicitly this
   time, don't just copy the pattern blind).
2. **KPI/stat-tile grids** (`grid grid-cols-N` of big-number + label) →
   `KpiCard`, one per tile, matching label/value/color/icon semantics
   already in place. Confirm the `color` prop covers every visual state
   used (Phase 42 shipped `KpiCard` without an `info` variant and it caused
   a visible color mismatch — that gap is now fixed, but double check no
   other color need arises here).
3. **Tab-bar patterns** (`flex gap-1 p-1 bg-*-100 rounded-xl` button rows) →
   `Tabs`.
4. **Native `<select>` with long repeated className** → `Select`, preserving
   `required` on fields that are actually required (Phase 42 shipped
   `Select`/`Input` with `required` silently dropped from the DOM — now
   fixed at the primitive level, so this batch inherits the fix for free,
   but confirm each converted field still visually/functionally validates).
5. **Ad-hoc card/panel wrapper divs** (repeated
   `rounded-xl border bg-white dark:bg-slate-900` etc.) → `Card`, with the
   appropriate `padding` prop.
6. **Palette drift** — literal `gray-*`/`blue-600`/`indigo-600`/raw
   `green-*`/`red-*` that match neither the `slate-*`/`brand`/`success`/
   `warning`/`danger` system nor the `bg-card`/`text-foreground`/
   `border-border` CSS-variable tokens — normalize to whichever convention
   the rest of that specific screen already uses (don't introduce a third
   convention; match the file's existing majority style). `logistics/*`
   (all 7 files) and `dashboard/DashboardScreen.tsx` (`indigo-600` at 3
   sites) are the confirmed instances from the audit — verify the rest of
   Batch 1 file-by-file rather than assuming only these have drift.

**Screens already on `DataTable`** (`CustomersScreen`, `BatchManagementScreen`,
`InventoryMovementsScreen`, `InventoryScreen`, `PurchaseOrdersScreen`,
`SerialTrackingScreen`, `ProductsScreen`, `ReportsScreen`, `SuppliersScreen`)
need lighter-touch work — layer `Badge`/`KpiCard`/`Select`/`Card` around the
existing table, don't touch the table itself.

**Modals** (`CustomerFormModal`, `SupplierFormModal`, `ProductFormModal`,
`PurchaseOrderFormModal`, `StockAdjustmentModal`, `CategoryManageModal`,
`VariantManagementModal`) — apply `Select`/`Card` where their internal
form fields/panels match the pattern; don't force a KPI grid or Tabs into a
modal shape that doesn't have one.

## 4. Light-touch / scoped files (explicit treatment, not exclusion)

- **`auth/LoginScreen.tsx`**: already built on `Button`/`Input`. Verify this
  directly (read the file) rather than assume; convert any native `<select>`
  or ad-hoc card wrapper found, otherwise document "no applicable pattern
  found" in the completion report rather than silently skipping.
- **`disclaimer/DisclaimerScreen.tsx`**: one-off consent text screen. Same
  treatment — verify, convert what applies (likely just a `Card` wrapper),
  document if nothing applies.
- **`setup/SetupWizard.tsx`**: the step-progress chrome (`step` state,
  progress dots) stays bespoke — a wizard stepper is not a `Tabs` component
  (tabs imply free navigation between equal peers; a wizard is sequential
  and gated). Inner form fields within each step DO get `Input`/`Select`
  where they're currently native elements.
- **`dashboard/DashboardScreen.tsx`**: real KPI tiles convert to `KpiCard`;
  chart/widget content is explicitly out of scope for this primitive-swap
  (that's the `dataviz` skill's domain, not this phase's). Fix the 3
  confirmed `indigo-600` off-system color sites regardless.

## 5. Explicitly out of scope for Batch 1

- Batches 2–5 (service module family, restaurant, service-business) — separate
  phases, per §1.
- Any new component-test infrastructure (jsdom/RTL) — still not justified for
  presentational-only changes; typecheck + live Playwright spot-checks on a
  representative sample remains the verification method for this batch too.
- Rewriting business logic, IPC calls, or data-fetching in any touched file —
  this is a presentational retrofit only. If a file's existing logic looks
  wrong while touching it, flag it in the completion report rather than
  fixing it inline (scope creep risk on a 63-file batch).

## 6. Acceptance criteria

- 0 TypeScript errors, both `tsconfig.web.json` and `tsconfig.node.json`.
- Full `vitest` suite still green (618/618 baseline — no backend logic
  touched, so this should be an unchanged pass, not a new one).
- Every one of the 63 files is either retrofitted or has an explicit,
  documented "no applicable pattern" note in the completion report — no
  file silently skipped.
- Live Playwright pass on a representative sample spanning every module in
  the batch (at minimum one screen per module folder), checking for zero
  console errors and correct visual rendering of every primitive used.
- No status-enum value silently falls through to a default/neutral badge
  color anywhere converted (explicit check per Phase 42's post-mortem).
- `PHASE_43_BATCH1_COMPLETION_REPORT.md` written on completion.
