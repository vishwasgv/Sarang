# Phase 49 — New Business Vertical: Agricultural Inputs & Equipment: Completion Report

## 1. Scope delivered

Per `PRODUCT_HARDENING_MASTER_PROMPT.md`'s Phase 49 entry: a new PRODUCT-category
business type, `AGRI_INPUTS`, covering fertilizer/pesticide dealers and farm
equipment sellers/servicers — built entirely by reusing existing generic
infrastructure rather than adding new schema, IPC channels, or permissions.

**Audit finding that shaped the scope**: `batch_tracking`/`expiry_tracking`
(PHARMACY) and `serial_tracking`/`warranty_tracking` (ELECTRONICS) are both
already fully generic — no vertical-specific fields, no hardcoded business-type
branching in either screen or service layer. Confirmed by reading
`ProductBatch`/`ProductSerial` in `schema.prisma` (no Pharmacy/Electronics-only
columns) and `BatchManagementScreen.tsx`/`SerialTrackingScreen.tsx`/
`serial.service.ts` directly. `job_cards` (REPAIR)'s `JobCard` model is
likewise generic (`itemDescription` free text, no vehicle/car-specific fields)
— confirmed via `JobCardsScreen.tsx`. This meant Phase 49 required **zero new
Prisma models, zero new IPC channels, zero new permissions** — pure
business-type registration plus one genuine UI-genericness fix (below).

**`AGRI_INPUTS` registered** in `src/main/services/industry-template.service.ts`:
- `BusinessType` union: added `'AGRI_INPUTS'`.
- `TEMPLATE_DEFAULTS`: `['batch_tracking', 'expiry_tracking', 'serial_tracking', 'warranty_tracking', 'job_cards', ...LOGISTICS_MODULES]`.
  Deliberately **without** `imei_tracking` (phone-specific, doesn't apply to a
  tractor/sprayer) and without `variant_tracking`/`returns` (no size/colour
  variant concept for fertilizer or equipment).
- `DASHBOARD_LAYOUTS`: `'agri'` (cosmetic only — confirmed via grep that
  `dashboardLayout` is stored but not consumed by any renderer switch today,
  same as several other business types that already share layout strings).
- Not added to `SERVICE_TEMPLATE_TYPES`, so `businessCategory` resolves to
  `'PRODUCT'` and `getLanguageLockFor('AGRI_INPUTS')` returns `'multi'`
  automatically — satisfies the founder's "Agricultural Inputs gets full
  language support" instruction with zero special-case code, exactly as the
  master plan anticipated.

**UI wiring**: added as a selectable tile (Tractor icon) in
`SetupWizard.tsx`'s `BUSINESS_TYPES` and `IndustrySettingsScreen.tsx`'s
`TEMPLATES` arrays. `Sidebar.tsx`'s existing `requiredModule`-gated nav items
("Batch Tracking", renamed from "Serial & IMEI" to "Serial Tracking") are
shared automatically by any business type with the module on — comments
updated to reflect they're no longer Pharmacy/Electronics-exclusive.

## 2. Genuine gap found and fixed — IMEI UI was unconditional

`SerialTrackingScreen.tsx` showed IMEI-specific UI (an "IMEI Lookup" search
box, IMEI 1/IMEI 2 fields in the Add Device modal, an IMEI line in the table,
IMEI wording in the bulk-import hint/placeholder, a `Smartphone` header icon
and the title "Serial & IMEI Tracking") **unconditionally**, regardless of
whether the `imei_tracking` module flag was actually enabled. Harmless for
ELECTRONICS (always has `imei_tracking` on) but would have shown meaningless
IMEI fields for AGRI_INPUTS equipment (tractors/sprayers/pumps have serial
numbers, not IMEIs). This is exactly the class of thing the master prompt
asked to audit rather than assume.

Fixed by reading `useIndustryStore(s => s.isModuleEnabled('imei_tracking'))`
and conditionally rendering every IMEI-specific piece of UI. When disabled:
header icon becomes a generic `Package`, title reads a new i18n key
`inventory.serialTitleGeneric` ("Serial Tracking") instead of the original
`inventory.serialTitle` ("Serial & IMEI Tracking"), the IMEI Lookup card and
Add Device modal's IMEI 1/2 fields don't render at all, and the bulk-import
hint/placeholder describe a plain `SerialNumber`-only format. When enabled
(ELECTRONICS, or any future business type that opts in), behavior is
byte-identical to before. `serialTitleGeneric` was added to all 13 locale
files (`en` + 12 translations) immediately after the existing `serialTitle`
key, via a one-off Node script — verified all 13 files parse as valid JSON
with the key correctly placed and no duplicate/corrupted structure.

Also fixed in passing: `BatchManagementScreen.tsx`'s header icon was a `Pill`
(medicine-specific) regardless of business type — a purely cosmetic mismatch
for AGRI_INPUTS fertilizer/pesticide batches, or any future non-pharmacy user
of `batch_tracking`. Swapped for a neutral `PackageSearch` icon.

## 3. Tests

Added to `src/main/services/__tests__/industry-template.service.test.ts`:
- `seedDefaultTemplates` creates a fresh `AGRI_INPUTS` row with
  `batch_tracking`/`expiry_tracking`/`serial_tracking`/`warranty_tracking`/
  `job_cards`, explicitly asserting `imei_tracking` is **not** included.
- `getLanguageLockFor('AGRI_INPUTS')` returns `'multi'`.

No new component-test infra was introduced (this project has none yet, a
known pre-existing gap flagged back in Phase 42) — the IMEI-gating fix was
verified live instead (Section 5).

## 4. Independent review

A fresh-context review agent (no knowledge of the implementation) audited:
genericness (grepped the whole `src/` tree for any other hardcoded
business-type list that should have included AGRI_INPUTS but didn't — found
none; confirmed `SERVICE_TEMPLATE_TYPES` correctly excludes it), the full
`SerialTrackingScreen.tsx` IMEI-gating diff line-by-line, i18n key parity
across all 13 locale files, spelling consistency of `AGRI_INPUTS` everywhere
it appears, and independently reproduced `tsc` (0 errors both configs) and
`vitest run` (702/702). No issues found.

## 5. Live UAT

Launched the real Electron dev app (Playwright `_electron`, per this
project's standing live-verification recipe — `HashRouter` needs
`window.location.hash` navigation, dev DB is `.dev-data/sarang.db` at project
root) against the real dev database (previously set to `MANUFACTURING`).
Logged in as admin, then:

- Opened Settings → Industry Template, selected the "Agricultural Inputs &
  Equipment" tile (confirmed Tractor icon, description, and all 5 module
  badges render correctly) and clicked Apply Template.
- Confirmed the sidebar immediately updated to show **Batch Tracking**,
  **Serial Tracking**, and (further down, alongside logistics items) **Job
  Cards** — replacing the Manufacturing-specific items.
- Opened Serial Tracking: title reads "Serial Tracking" (not "Serial & IMEI
  Tracking"), header icon is a generic package (not a phone), no IMEI Lookup
  box anywhere on the page, page text contains zero occurrences of "IMEI".
  Opened the Add Device modal: fields are exactly Product / Serial Number /
  Warranty (months) / Unit Cost / Purchase Date — no IMEI 1/IMEI 2 fields.
- Opened Batch Tracking: renders correctly with the new `PackageSearch` icon,
  functions normally (0 batches, Add Batch button present).
- Opened Job Cards: renders correctly, showing pre-existing dev data
  unaffected by this phase.
- Switched business type back to Manufacturing/Production and confirmed the
  sidebar reverted correctly (Raw Materials/BOM/Production/etc. restored,
  Manufacturing tile shows "Active").
- Dev DB left clean: admin password re-randomized and session token cleared
  after the pass (same pattern as every prior phase's live-verification
  cleanup).

## 6. Final state

0 TypeScript errors (both `tsconfig.node.json` and `tsconfig.web.json`),
**702/702 tests** (was 700/700 at Phase 48's close — 6 new, 4 pre-existing
tests unaffected by a 2-test net change is not applicable here; exactly 2 new
test cases were added and both pass, plus all 700 prior tests still pass).

## 7. Deliberately not done (documented, not silently skipped)

- **Product-level agri-specific fields** (e.g. active ingredient, crop
  suitability, license/registration number for pesticides) were considered
  and deliberately not added. `ProductCategory` is already free-text/
  user-created for every business type (no vertical hardcodes categories
  anywhere, including PHARMACY) — a shop owner can create "Fertilizers" /
  "Pesticides" / "Equipment" categories themselves, satisfying the master
  prompt's "first-class categories, not a generic catch-all" requirement
  without new schema. Revisit only if a real user need for structured
  composition/compliance fields surfaces.
- **Equipment rental tracking** was considered and rejected as out of scope:
  "Agricultural Inputs & Equipment" is a dealer/shop vertical (sells +
  services equipment), not an equipment-rental business — a materially
  different problem (availability calendars, deposits, return conditions)
  that no existing module models. `job_cards` covers the equipment-servicing
  need that's actually implied by the vertical's name.
- **"Device"/"devices" wording** in `SerialTrackingScreen.tsx` (button
  labels, counters) still reads oddly for farm equipment (a tractor isn't
  conventionally a "device"). Not fixed this phase — would require ~6 new
  i18n keys across 13 locale files for a purely cosmetic wording concern, a
  materially larger and lower-value change than the functional IMEI-gating
  fix. Flag if a future phase touches this screen again.
- **`IndustrySettingsScreen.tsx`'s `TEMPLATES` array is stale** relative to
  the full business-type list — it only lists the original ~13 product-family
  types (RESTAURANT through REPAIR) plus, as of this phase, AGRI_INPUTS; none
  of the 24 Phase-22 service verticals or later product additions (Phase
  38's barcode/loose-billing toggles aside) appear there at all. This is a
  pre-existing gap, not introduced or worsened by this phase — AGRI_INPUTS
  was added to it because it's a direct peer of the types already listed
  there, but the screen's broader incompleteness is unchanged. Not this
  phase's scope to fix.

## How to apply

Phase 49 is done — reuse-only implementation, one genuine genericness bug
found and fixed (not just documented), independently reviewed, live-verified.
Per `PRODUCT_HARDENING_MASTER_PROMPT.md`'s renumbered plan, Phase 50
(Healthcare Depth: Doctor Clinic Breadth Audit + New Vertical: Diagnostic &
Pathology Labs) is next — check the master prompt directly before citing
phase numbers, as this bundle has been renumbered multiple times already.
