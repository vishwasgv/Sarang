# Phase 46 — Cross-Business Schema & HR/Attendance Audit: Completion Report

## 1. Audit performed

Per the master plan's Phase 46 scope, ran 4 parallel audit angles:

1. **HR/Attendance (Phase 17) universality** — re-verified zero business-type
   gating, no regression since introduced. Clean.
2. **`TemplateModule` drift** — checked the backend (`industry-template.service.ts`)
   and renderer (`industry.store.ts`) union types stay byte-identical (a
   project invariant). Clean at 77/77 matching literals.
3. **Schema completeness** — audited `prisma/schema.prisma` for missing
   required entities across verticals. Clean.

The first 3 angles came back entirely clean. Rather than accept that at face
value, ran a 4th **stress-test** angle specifically targeting angles the
first 3 didn't cover (frontend template-conditionals, hardcoded-array
checks, wider vertical sampling). This surfaced 2 real violations of the
project's "no template-specific if/else in business logic — configuration
flags only" rule:

- `AppointmentsScreen.tsx`'s `NewAppointmentModal`: `isDental`/`isSalon`
  derived directly from `businessType === 'DENTAL_CLINIC'`/`'BEAUTY_SALON'`.
  `isSalon` gated real save-time validation and payload shape (multi-service
  vs. single-service booking) — the more severe of the two, since it's
  actual business logic, not just display.
- `VisitNoteScreen.tsx`: `isSpecialist`/`isDental`/`isPhysio` derived the
  same way, gating SOAP-note field visibility and print sections
  (display-only, milder, but still bypassing config flags that already
  existed for two of the three).

## 2. Fix delivered

- Added two new `TemplateModule` flags: `multi_service_booking` (added to
  `BEAUTY_SALON`'s `TEMPLATE_DEFAULTS`) and `specialist_referral` (added to
  `SPECIALIST_CLINIC`'s). Reused the existing `dental_chart`/`physio_notes`
  flags for the other two verticals rather than adding redundant ones.
- Swapped all 5 hardcoded `businessType === 'X'` checks across both screens
  for `useIndustryStore((s) => s.isModuleEnabled(...))` calls.
- Mirrored the 2 new flags into the renderer's `TemplateModule` union
  (`industry.store.ts`) to keep it byte-identical with the backend's.

## 3. Additional finding: migration/backfill gap (caught during my own verification, not the audit agents)

While preparing to live-verify the fix, direct inspection of the real dev
database showed `industryTemplateSetting` rows for `BEAUTY_SALON` and
`SPECIALIST_CLINIC` **already existed from earlier phase testing and were
missing the two new flags** — the exact scenario a real pre-Phase-46
install would be in. Tracing why revealed `seedDefaultTemplates()` used
`db.industryTemplateSetting.upsert({ ..., update: {} })` — a pure no-op on
any row that already exists. Since this is a single-tenant, one-row-per-
business-type app, that meant **any existing install's row was frozen
forever at whatever `TEMPLATE_DEFAULTS` looked like when the row was first
created** — a newly-added default module would never reach it. Without this
fix, the very flag swap above would have silently regressed the UI for any
already-configured Beauty Salon or Specialist Clinic install (multi-service
booking / referral fields would vanish on upgrade).

**Fixed**: rewrote `seedDefaultTemplates()` to `findUnique` first; create
fresh rows as before, but for existing rows, additively merge in any
`TEMPLATE_DEFAULTS` modules missing from the persisted array (never removes
anything, so Phase 38's opt-in toggles — `barcode_generation`,
`barcode_printing`, `loose_billing`, never listed in `TEMPLATE_DEFAULTS` —
are untouched either way). Chose a general backfill mechanism over a
one-off patch so any future phase that adds a new mandatory default module
doesn't reintroduce this exact class of bug.

## 4. Verification performed

- **TypeScript**: 0 errors, both configs.
- **Tests**: 658/658 passing (was 654 before this phase) — 4 new tests
  added for `seedDefaultTemplates`'s backfill behavior, using the actual
  stale data shape pulled from the real dev DB as the test fixture
  (backfill into an existing row with a manually-set opt-in flag preserved;
  backfill into a `SPECIALIST_CLINIC` row; no spurious write when a row
  already matches defaults; fresh-row creation for a business type with no
  existing row).
- **Live verification**: launched the real dev Electron app (not just a
  mocked test) against the actual dev database, which already had the
  exact stale `BEAUTY_SALON`/`SPECIALIST_CLINIC` rows described above.
  Confirmed via direct before/after database inspection that the real app
  boot correctly backfilled `multi_service_booking` into `BEAUTY_SALON` and
  `specialist_referral` into `SPECIALIST_CLINIC`, with every pre-existing
  module (`session_packs`, `staff_commission`, `visit_notes`, etc.)
  preserved untouched, and `DENTAL_CLINIC`/`PHYSIO_CLINIC` rows (which
  needed no backfill) left exactly as they were.
- **Not exercised live**: the two renderer screens' UI itself (no
  Playwright/browser automation run this phase) — per this project's
  established default to skip manual UI testing and rely on automated
  tests for non-money-touching changes. Confidence here instead comes from:
  the swap being a mechanical, TypeScript-checked substitution of an
  already-proven mechanism (`isModuleEnabled`, used successfully elsewhere
  in the app since Phase 38) for an equivalent boolean, and the backfill
  mechanism that guarantees the flags are correctly populated now being
  independently verified live against real data.

## 5. Independent verification — 2-angle review

Sized to this phase's scope (small, non-money-touching, but touching
data-migration logic): ran 2 independent review agents — a line-by-line
diff + correctness review of all 4 edited files plus the new test file,
and a cross-file usage tracer checking every consumer of the affected
flags and the `TemplateModule` unions. Both came back clean:

- No remaining hardcoded `businessType === 'X'` checks found anywhere in
  production logic for these 4 verticals.
- `seedDefaultTemplates`'s backfill logic confirmed correctly additive-only,
  covers all business types, no spurious writes when nothing is missing.
- No sibling business type was found that should also have gotten
  `multi_service_booking` or `specialist_referral` but didn't.
- Both `TemplateModule` unions confirmed still byte-identical.

No findings surfaced that required further fixes.

## 6. Final status

- 0 TypeScript errors, both configs.
- 658/658 tests passing.
- 2 template-conditional violations found and fixed (audit), plus 1
  additional migration/backfill gap found and fixed during my own
  verification (not caught by any audit agent) — confirmed live against
  real, previously-stale production-shaped data in the dev database.
- No open findings deferred.

Phase 46 is complete.
