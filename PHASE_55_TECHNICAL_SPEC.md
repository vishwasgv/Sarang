# Phase 55 — Comprehensive UAT + Stress + Automation Testing — Technical Spec

## Section 1 — Audit findings (current state, confirmed by reading the repo directly)

- **Unit/integration tests**: 1008 tests across 90 `*.test.ts` files, 0 TypeScript errors (both `tsconfig.web.json`/`tsconfig.node.json`). Mocked-Prisma, no real SQLite — this is why every phase's live UAT has kept finding real bugs (FK constraints, stock-column mismatches, permission gates) invisible to this layer.
- **E2E/live-UI testing**: zero formal project asset. Every phase since ~43 has driven the real Electron app via a one-off `playwright-core` script written into a scratch temp directory, never committed to the repo, never reused structurally across phases (each session re-derives the same login/navigation/cleanup boilerplate from scratch). Confirmed via `find` — no `tests/e2e/`, no `playwright.config.*`, no `e2e`/`test:e2e` script in `package.json`.
- **Phase coverage**: 62 `PHASE_*_COMPLETION_REPORT.md` files exist (Phases 1–54E), plus 3 spec files for 54F (F.15/F.16/F.17) and one combined spec for 54G. 41 `BusinessType` values are registered in `industry-template.service.ts` today.
- **Recurring bug class already proven across ~10 phases' live UAT**: real Prisma/SQLite behavior (FK constraints, transaction races, stock-column drift, permission-gate mismatches) that mocked unit tests structurally cannot catch. Phase 55's highest-value contribution is exactly this — a reusable way to keep catching this class going forward, not just once more by hand.

## Section 2 — Scope to deliver

### 2.1 — Reusable E2E test harness (the actual "automation" deliverable)

New `tests/e2e/` directory in the project (real project asset, not scratch), built by distilling the patterns already proven correct across dozens of ad-hoc sessions (documented in memory as `project_electron_live_verification.md` — dev-DB absolute-path gotcha, `HashRouter` navigation via `location.hash`, splash-window `firstWindow()` handling, login-form fill, industry-store staleness after raw IPC calls, `ErrorBoundary` cascade-failure detection):

- `tests/e2e/harness.ts` — `launchApp()`, `getMainWindow()` (splash-window-aware), `login()`, `gotoHash()`, `hasErrorBoundary()`, `resetAdminPassword()`/`randomizeAdminPassword()`, `switchBusinessType()` (via real Settings UI, not raw IPC — avoids the known industry-store staleness gotcha), a DB-snapshot/restore helper (backup `.dev-data/sarang.db` before a suite, restore after — replaces every phase's ad-hoc manual cleanup script with one shared mechanism).
- `tests/e2e/fixtures/` — reusable seed helpers (create a test customer/product/employee via direct API calls, not UI clicks, for setup steps that aren't themselves under test).
- New `npm run test:e2e` script wired to run this suite headlessly against a disposable copy of the dev DB (never the founder's real data).
- A dry-run/CI-safe mode: since this machine has no CI pipeline today, document how to run it locally on demand rather than building unused CI infrastructure.

### 2.2 — UAT script coverage (organized by feature area, not 1:1 per historical phase number)

Writing 62 individual per-phase-number scripts would be highly redundant — most early-phase mechanics (billing, inventory, customers) are already exercised by every later business-type test. Instead, coverage is organized into suites that between them touch every phase's surviving behavior:

1. **Core commerce** (exercises Phases 1–21, 37–38, 54C/54D fixes): product CRUD incl. barcode gen/scan/print + loose/weight billing, invoice create/cancel/return with the 54D profit/outstanding-balance correctness fixes, customer ledger, purchase orders, GRN, thermal + A4 print with UPI QR, multi-currency/multi-tax-model (at least one non-GST `taxModel` business).
2. **Service-business core** (Phase 22 foundation + representative sample, not all 24 service verticals individually — pick one PRODUCT and one SERVICE exemplar per distinct mechanic): Appointment booking/conflict-rejection, `CustomerPicker` reuse-by-phone (54E) across at least 3 of its 11 wired screens, one full clinic visit-note + vitals flow (54B), one Diagnostic Lab order lifecycle (50), one Blood Bank donation→issue flow (51).
3. **Logistics & manufacturing**: GRN/Challan/Freight/Shipment lifecycle, Manufacturing production order, Logistics Analytics charts (54E).
4. **New verticals since the last full sweep**: Agricultural Inputs (49), Rental (54G) — booking/checkout/return/late-fee/invoice, **plus the Hybrid Business Operations toggles (54G Part 1)** on a non-RENTAL business type.
5. **Reports**: at least one report per chart-bearing category confirmed to render (16 of 23 have charts per 54C) — not all 23 individually re-verified line-by-line (already covered at ship time), but a representative sweep confirming the `dataviz`-chosen chart types still render post-54G's report additions.
6. **Trust/compliance surfaces (54F)**: password-policy rejection, audit-log hash-chain `verifyAuditLogChain()` still reports clean, one real payroll run (F.16), one HSN/GSTR-3B report render (F.17), `AuditLog` retention pruning (54D) doesn't remove rows younger than the configured window.
7. **QR ordering flood** (see 2.3) counts as this suite's Restaurant/Phase-47 coverage.
8. **Branding/legal**: splash-screen legibility (52) and disclaimer-gate (53) — single confirmation pass, not per-business-type (both are business-type-agnostic).

### 2.3 — Stress testing

- Large catalog: script-generate ~2,000 products (mixed STANDARD/SERVICE/rentable), confirm Products list search/pagination stays responsive and no query times out.
- Concurrent invoicing: fire ~50 concurrent `billing:createInvoice` IPC calls at the same product's stock to confirm the existing atomic-decrement protection holds under real concurrency (not just the single-threaded mocked-Prisma unit test's simulated race).
- Large ledger: ~5,000 `CustomerLedger` rows for one customer, confirm Outstanding Report / Customer Ledger screen pagination and aggregate queries stay correct and responsive.
- QR-ordering flood (Phase 47's unauthenticated public surface): fire a burst of unauthenticated order submissions, confirm the existing rate-limit/validation holds and no crash/DoS-shaped failure occurs — explicitly named in the master prompt's Phase 55 scope.

### 2.4 — Zero-bug audit pass

Same pattern as every major phase since 37: run the E2E suite once as a diagnostic pass first (expect to find real bugs, per the 10-phase track record above), fix what's found, re-run to confirm, then close with a **from-scratch, no-prior-context** review (2–3 parallel agents, one per major surface area: business-logic/data-integrity, security/permissions, day-to-day UX completeness) — matching the Phase 37/38/49–54G precedent of independent verification catching what self-review misses.

## Section 3 — Explicitly out of scope

- **Not** re-running the full 12-language translation audit — already verified key-parity per phase at ship time; Phase 55 spot-checks language-switching renders correctly, doesn't re-audit every string.
- **Not** re-litigating already-fixed bugs from Phases 37–54G's own live UAT passes — this phase's job is cross-phase regression and previously-unexercised combinations, not repeating single-phase work.
- **Not** building CI/CD pipeline infrastructure — no CI exists for this project today (single-developer, offline-first desktop app); the E2E suite is built to run on-demand locally, revisit CI if that changes.
- **Not** literally 41 individual full business-type scripts — representative-exemplar coverage per distinct mechanic (Section 2.2), reasoned explicitly above, not silently reduced scope.
- **Not** a numeric "X/10 per aspect" scored report (the founder's alternate ask from this same conversation) — Phase 55 as scoped is pass/fail regression + stress + audit. If a scored rubric is also wanted, say so and it folds into Section 2.4's audit pass output format.

## Section 4 — Effort & sequencing

**Effort: XL**, confirmed. Sequencing: 2.1 (harness) first since every later script depends on it → 2.2 suites → 2.3 stress tests → 2.4 audit-and-fix → completion report. Given the size, this will likely span several extended work sessions; will check in with interim progress rather than going fully dark until the entire XL phase is done.

## Section 5 — Decisions (confirmed by founder 2026-07-09: "do whatever is best for Sarang" — all three recommendations adopted as-is)

1. **E2E suite scope: representative exemplars** (Section 2.2) — not all 41 business types individually.
2. **Stress test scale: as specified** in Section 2.3 (2,000 products / 50 concurrent invoices / 5,000 ledger rows).
3. **Audit pass depth: multi-agent independent review** (2–3 parallel fresh-context agents, one per surface area) — kept, since it's the step that's caught real bugs every time it's been used across this project.

Spec is approved. Proceeding to implementation per Section 4's sequencing.
