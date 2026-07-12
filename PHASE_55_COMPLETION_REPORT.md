# Phase 55 — UAT / Hardening Pass, Section 2.4 (Multi-Agent Audit + Fix): Completion Report

## Scope

Section 2.3 (manual UAT sweep, hash-chain race fixes) closed with 119/119 E2E, 0 TS errors, 1009/1009 unit tests. Section 2.4 was a deeper, adversarial audit pass: three parallel research agents independently reviewed the codebase for correctness, security, and data-integrity gaps beyond what manual UAT would surface. The user's instruction for the resulting fix work was explicit and unambiguous: *"fix everything, I don't want to compromise on anything, I need 10/10."* When the true scope of one finding (renderer screens silently swallowing IPC errors) turned out to be 100+ files rather than the ~62 initially estimated, the user confirmed continuing at full thoroughness rather than scaling back.

## Findings and fixes

**1. GST/tax report overstatement on returns** (`report.service.ts`) — RETURN invoice items store positive-magnitude `discountAmount`/`taxAmount` by design, but 5 report functions (`generateSalesReport`, `generateTaxReport`, `generateGSTR1`, `generateHSNSummaryReport`, `generateGSTR3BPreview`) summed them as additional sales instead of netting them out. Fixed with the same `sign = invoiceType === 'RETURN' ? -1 : 1` convention `analytics.service.ts` already used for quantity. 5 new tests confirm RETURN netting reaches zero across all 5 reports.

**2. Supplier-ledger race** (`supplier-ledger.service.ts`) — `recordPayment` was the only `addEntry` caller not passing a transaction, risking a corrupted cached balance under concurrent payments. Wrapped in `db.$transaction`.

**3. QR order server DoS** (`qr-order-server.ts`) — `GET /order/:tableId` did synchronous file reads with no rate limit on every request, blocking Electron's single main-process event loop (shared with all IPC/billing). Added in-memory HTML caching and rate limiting.

**4. `auth:changePassword` gaps** (`auth.service.ts`, `auth.handler.ts`) — no rate limiting on password changes, and the handler trusted a client-supplied `userId` with no session cross-check. Added a generic `makeRateLimiter` factory and a self-check against the actual session's `userId`.

**5. `industry:getTemplate` had no session check** — added `requireSession()`.

**6. Sequence-generation TOCTOU race** (`sequence.service.ts`, `billing.service.ts`) — document-number generation used a read-then-write with no conflict detection. Replaced with an atomic conditional `updateMany` claim (matching the existing `appointment.service.ts` pattern), throwing a new `SequenceContendedError` on contention instead of silently reusing a stale number.

**7. 13 services still generating document numbers via `count()`/`findFirst`** instead of the shared atomic generator — all migrated to `generateSequenceNumber` inside `$transaction`: appointment, car-job-card, candidate, dispatch, job-card, job-order, pest-contract, pest-job-sheet (2 call sites), placement, production-order, project, service-ticket, tailoring-order. Two of these (`job-card`, `project`, `service-ticket`) also had raw error messages leaking to the UI — replaced with friendly codes.

**8. Missing business-type coverage** — `SetupWizard.tsx` was missing 5 business types (Manufacturing, Rental, Service, Consultant, Repair) from its selection tiles; `IndustrySettingsScreen.tsx` was missing all 25 service-vertical templates. Both were completed to match `industry-template.service.ts`'s actual supported set.

**9. Silent error-swallowing across the renderer — the largest single item.** The audit found that a large fraction of screens called `api.xxx.yyy()` and did nothing on failure: no toast, no inline message, sometimes not even a `.catch()` on a thrown exception — a failed action would just look like nothing happened. Fixed across essentially every screen in the app (manufacturing, hr, restaurant, blood-bank, billing, backup, audit, settings, expenses, cashclose, distributor, documents, industry, reports, products, inventory, service, dashboard, disclaimer, logistics, retail, rental, auth, import, and 21 files across the service-business vertical). Standard pattern: wrap the async handler in try/catch, add an `else` branch on `res.success === false`, surface via `useNotificationStore`'s `error` toast, reusing existing i18n keys only (no new translation keys added across 12 locale files). This pass also surfaced several genuine correctness bugs beyond simple missing toasts:
   - `DocumentsScreen.tsx`'s delete handler removed a document from the UI list even when the backend delete failed.
   - `BillingScreen.tsx`'s `addToCart` silently fell back to adding a plain product when a variant/serial lookup failed, risking a variant/serial-tracked item being billed without proper tracking.
   - `VariantManagementModal.tsx`'s save flow ignored per-row delete results, so a failed variant delete could still report "Variants Saved."
   - `ReturnScreen.tsx`'s prior-returns lookup, on failure, silently proceeded as if there were no prior returns — reintroducing the double-return bug the surrounding code comments explicitly warned about. Fixed to block the return flow entirely on lookup failure rather than falling through.

**10. Industry template not reloaded after login (found during final E2E verification, not the original audit).** `App.tsx`'s `initializeApp()` calls `loadTemplate()` before any session exists — `industry:getTemplate` requires a session (per finding #5's fix), so this pre-login call always failed silently, leaving the renderer's industry Zustand store's `enabledModules` empty for the rest of the session. Nothing re-fetched it after a successful login (manual or token-based), so module-gated UI (e.g. the Production Report tile, and potentially any other `requiredModule`-gated screen or nav item) could stay hidden even when the business type's modules were genuinely enabled. This was a real regression introduced earlier in this same phase by finding #5, only surfaced because the E2E suite happened to switch business types and log back in. Fixed by adding `loadTemplate()` to the existing `authUser`-keyed effect that already re-fetches business profile/settings once a real session exists — covering both login paths with one change.

## Verification

- **0 TypeScript errors**, both `tsconfig.web.json` and `tsconfig.node.json`.
- **1027/1027 unit tests pass** (up from 1009 at Section 2.3's close — 18 new tests added across report netting, supplier-ledger transaction, QR rate-limiting, auth rate-limiting, and sequence-contention coverage).
- **119/119 E2E checks pass** across all 9 suites, run against a freshly rebuilt dev server (all stale `electron`/`esbuild`/`node` processes killed and restarted before trusting results, per the project's known electron-vite watcher staleness gotcha). The first full run surfaced 1 failure (`Production Report-tile-present`) that traced to finding #10 above, not a test artifact — confirmed by direct DB inspection showing the underlying data was correct while the renderer's in-memory module list was empty. Fixed and re-verified clean.

## Final state

0 TS errors both configs, 1027/1027 unit tests, 119/119 E2E checks. All ten audit findings closed, including one real regression caught only by the final verification pass rather than the original audit — underscoring why the fresh-rebuild + full-regression step matters as a distinct final gate, not just a formality after the fix work.
