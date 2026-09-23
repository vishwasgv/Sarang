# Doctor Pad / Clinical Workflow Release — Completion Report

### Maintained by Aszurex | Vishwas G V | 2026-09-23

**Status: 🟢 Code complete, tested, and pushed. Installer build DEFERRED — see "Installer" section below.**

---

## Scope

A single continuous session covering the 5 clinic verticals (GP, Specialist, Dental, Vet, Physio Clinic) end to end: a redesigned Doctor Pad writing screen, A4-correct prescriptions, a real patient-continuity fix, a full "Doctor Tablet" (search/chart/medical-info/read-only billing/new-visit, all from the LAN tablet), Customer→Patient terminology scoped to exactly those 5 verticals (with a Vet Clinic correctness fix — see below), and a full testing pass across the whole app, not just this change.

## What shipped

**Doctor Pad writing screen** — icon-only tools (pen/eraser/line/rect/circle/undo/redo), a custom colour picker alongside 3 presets, up to 5 pages (was 3), a sticky/scrollable Save button, and a real bug fix: `ERASER_WIDTH_MULTIPLIER` was declared but never applied — the eraser silently drew at the same width as the pen.

**A4-correct prescriptions everywhere** — every note (1 page or 5) now renders through one A4 PDF pipeline; previously a single-page note saved as a raw PNG at whatever pixel size the tablet's canvas happened to be. Fixed the in-app Print button rejecting every multi-page note outright (PDF wasn't a supported mimetype). Added WhatsApp/Email sharing to every document panel app-wide, not just Doctor Pad.

**The walk-in gap** — `TokenQueue` had no link to a `Customer` or `Appointment` at all: a walk-in got a token number and nothing else, so neither Doctor Pad nor a typed visit note could ever attach to them. Added a "Create Visit Record" action that opens the real booking form pre-filled from the token, matches an existing patient by phone first (normalized to the last-10-digits core, so `+91`/leading-0/spacing differences between visits don't create a duplicate), and — the actual fix that mattered — routes through the picker's own quick-add flow so a **real, persisted Customer row** gets created, not a free-text name that never becomes a findable record. Live-verified end to end (37/37 checks) including the second-visit dedup path.

**Patient continuity** — a "Visit History" section on the patient's own profile (every past visit, clinical note summary, prescription count, expandable) with a "Book New Visit" button that opens the booking form pre-selected. Same data available on the Doctor Tablet itself.

**Medical data points** — added `bloodGroup`/`allergies`/`chronicConditions`/`currentMedications`/`emergencyContactName`/`emergencyContactPhone` to the patient record (real migration, applied). Allergies surface first and loudest, above billing.

**Doctor Tablet expansion** — patient search, full chart, editable medical info, read-only billing (ledger + outstanding, zero write path anywhere on this surface), and "start a fresh visit → write prescription," all from the LAN tablet, not just the desktop app.

**A correctness bug caught before shipping**: for Vet Clinic, the "Customer" record is the pet's *owner*, not the patient — the pet is. Almost shipped "Patient" terminology and allergy/blood-group fields onto the owner's record. Fixed: Vet Clinic correctly shows "Owner," and the medical-info card is hidden there entirely (pet-level medical fields are a separate, not-yet-built scope).

**Customer → Patient terminology**, scoped to exactly the 5 doctor verticals (nav, list screen, the picker, the detail page, the booking form) — everywhere else in Sarang is untouched.

## Testing performed

- Full unit suite: **4318/4318 passing**, 222 test files, zero regressions.
- ESLint clean on every touched file (renderer + main).
- Full-app E2E regression: a 157-suite marathon was started; the harness's own background-shell memory-pressure guard killed it partway through (142/157 reached, not a code failure — documented, known limitation of a full marathon on this hardware). Per that guard's own instruction, it was not restarted. Instead, every suite actually relevant to this session's changes was run **individually** (a materially lighter operation, already proven safe): `02-service-business`, `50-full-screen-crawl` (139 checks), `85-gpclinic-chronic-recall`, `96-customers-suppliers-crud`, `102-notification-queue-and-bell`, `108-appointments-invoice-update-delete`, `147-visitnote-update-prescription`, `158-tokenqueue` (37/37, the dedup fix), `167-doctorpad` (29/29) — plus all 5 clinic verticals' own dedicated suites (`28`/`29`/`30`/`31` + `85`). All green.
- 3 real pre-existing E2E-suite bugs found and fixed along the way: two suites hardcoded the old "Search existing client by name or phone..." placeholder text while running as `GP_CLINIC`, which the (correct) terminology change replaced with "Search by name or phone…" for that vertical — not a product bug, a test that needed to track an intentional change. A third (`50-full-screen-crawl`'s "Add Customer" button check) hit the same class of issue via a documented, pre-existing marathon artifact (business type can leak forward between suites in one run) that only became visible once the button's text became vertical-dependent.
- Stress test (`tests/e2e/stress-test-2026-09.js`): 15/15 — 1500 products / 300 customers / 300 invoices seeded, real concurrent-write handling, no crashes, acceptable load times at volume.
- Manual + in-app tutorial content updated for all 5 clinic verticals' Doctor Pad sections, plus a clarifying note on the universal Customers & Suppliers chapter.

## Installer — DEFERRED, not skipped

`npm run dist`'s pre-package guard (`scripts/check-license-secret.js`) correctly refused to build: `SARANG_LICENSE_ED25519_PUBLIC_KEY_PEM` is not set in this environment. `SARANG_LICENSE_HMAC_SECRET` is fine (already set). Without the real public key, the installer would ship unable to verify any real SARANG2 license key ever issued.

This key is **safe to be public** (it only verifies signatures — Render holds the actual signing secret, `SARANG_LICENSE_ED25519_PRIVATE_KEY_B64`, which was correctly *not* touched or extracted). It was already baked into the previously-published v1.3.0/v1.3.1 installers, so the right way to get it back is to extract it from that build output or the founder's own saved copy — not to generate a fresh keypair (which would invalidate every license key already issued to real customers) and not to pull the private key off Render and derive the public key from it (unnecessary exposure of a production signing secret for something that already exists safely elsewhere).

**Founder is providing the key directly once back at a machine with it saved.** Code is committed and pushed independent of this — the installer build (`npm run dist`) is the one remaining step, to run once `SARANG_LICENSE_ED25519_PUBLIC_KEY_PEM` is set, followed by the smoke test and GitHub release.

## Bugs found and fixed this session

1. Doctor Pad eraser width multiplier declared but never applied (drew at pen width).
2. Single-page notes bypassed the A4 PDF pipeline (raw PNG at arbitrary size).
3. In-app Print rejected every PDF document outright (multi-page notes had no print path at all).
4. Walk-in patients via Token Queue had zero Customer/Appointment linkage — no record, no prescription capability.
5. First dedup-matching fix (`contains` search) was directionally asymmetric — fixed properly with symmetric last-10-digit phone normalization.
6. The dedup bridge's "no match" path fell back to a free-text name that never created a real Customer row at all — the literal opposite of the bridge's purpose. Fixed to auto-open the picker's quick-add, pre-filled.
7. Vet Clinic: Customer≠Patient (owner vs. pet) — caught and fixed before ever shipping, not after.
8–10. Three pre-existing E2E test assertions broken by the (correct) terminology change, all fixed and reconfirmed passing.

**10 real bugs found and fixed in this session's run.**

---

## Separate decision, same session: biometric attendance — SKIPPED, not deferred

Founder asked directly whether to build biometric (fingerprint/face) hardware integration for HR attendance, given it's mentioned as still-open in prior planning notes. Verified against the live codebase first (no biometric code exists anywhere — `markAttendance` in `hr.service.ts` is a plain manual mark-present/absent action; there is no hardware/device driver layer at all today).

**Recommendation given and accepted: skip it.** Reasoning:

- Fingerprint/face-scanner hardware has no cross-platform standard — every real vendor (ESSL, ZKTeco, Suprema, etc.) ships its own SDK, meaning real, ongoing per-vendor integration and maintenance work for a cross-platform, offline-first Electron app that otherwise has zero hardware dependencies.
- Sarang's actual customer base (small businesses across 50 verticals, typically small staff counts) doesn't have the scale where manual/QR-based attendance genuinely breaks down — this is enterprise-grade tooling for a segment that doesn't need it.
- If the real underlying goal is "stop buddy-punching" rather than "biometric" specifically, a QR-based staff clock-in — reusing the exact same self-service LAN pattern Doctor Pad and Token Queue already use — gets most of the practical value with zero hardware/SDK cost. Not built in this session; a candidate for a future, separate ask if wanted.

No code changes made for this — attendance stays exactly as it was (manual marking). This is purely a scoping decision, recorded here so "biometric — still open" doesn't keep resurfacing as an assumed-pending item in future planning without the reasoning behind why it was set aside.

---

*A successful release is not one with new features. A successful release is one users can trust. Powered by Aszurex.*
