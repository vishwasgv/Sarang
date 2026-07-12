# PHASE_AUDIT_PROTOCOL.md

## SARANG BUSINESS OS LITE — Independent Phase Audit Protocol

Operational companion to `TESTING_AND_QA_STRATEGY.md` (that document defines *what* quality means for this project; this one defines the exact *procedure* used to independently re-verify a phase's own completion report before it's trusted).

This protocol was derived from auditing Phases 11–21, where every single self-graded "10/10" report contained at least one real, previously-undetected bug — most falling into a small number of recurring classes. Applying this checklist mechanically to every remaining phase (1–10, 22–37) is the point: these bugs repeat because they're easy to introduce and easy to miss without a systematic check.

---

## Stage 1 — Audit (no fixes applied)

Triggered by: "final evaluation of phase N."

1. **Do not carry context from other phases.** Each phase is audited cold, against its own completion report and its own source files only.
2. **Read the completion report fully** — note every specific, falsifiable claim (field names, permission keys, file names, "fixed" bug tables).
3. **Read the actual source** for every file the report touches. Never accept the report's description of what the code does — read the code.
4. **Run the mandatory recurring-bug-class checklist below** against every phase, regardless of what the report claims was tested.
5. **Live-verify at least the highest-severity findings** by launching the app (see Stage 3) — a bug confirmed only by static reading is a *plausible* finding; a bug reproduced in the running app is a *confirmed* finding. Prefer confirmed.
6. **Report findings** as a severity-ranked table (Critical/High/Medium/Low) plus a per-aspect rating out of 10, plus a "what was verified accurate" section — the report should give credit where the original claims held up, not just list problems.
7. **Do not fix anything in this stage.** Wait for explicit instruction.

## Stage 2 — Fix (only on explicit request)

1. Fix every finding from Stage 1, most severe first.
2. Prefer reusing existing shared services/utilities over duplicating logic (e.g., a ledger write belongs in `customerLedgerService.addEntry`, not reimplemented inline).
3. Add a regression test (Vitest) **only** for findings that were genuine logic/business-rule bugs in service-layer code — not for permission-seed additions, i18n key additions, or CSS/dark-mode class additions, where a unit test wouldn't meaningfully guard against recurrence. See "Regression test policy" below.
4. Re-run `tsc --noEmit` on both `tsconfig.web.json` and `tsconfig.node.json`.
5. Re-run the existing Vitest suite to check for regressions in shared services you touched.
6. **Live re-verify every fix** the same way it was broken — reproduce the original failing scenario, confirm it now succeeds, and confirm the previously-working behavior around it still works.
7. Clean up: remove any test data created in the dev database, restore any settings you changed for testing purposes, kill the Electron process, remove `playwright-core` from `node_modules`.
8. Update the phase's `PHASE_N_COMPLETION_REPORT.md` with a dated `## YYYY-MM-DD — Independent re-audit` section (findings table, what was verified accurate, live-verification narrative, post-fix ratings). Never edit or delete the original claims — append below them.

---

## Mandatory recurring-bug-class checklist

Run every one of these against every phase, every time, before declaring an aspect clean.

### 1. Unseeded permission keys
Found in Phases 13, 14, 15, 20 (5 separate instances across those 4 phases).

```bash
# List every permission key referenced by requirePermission() in this phase's handlers:
grep -on "requirePermission('[a-zA-Z.]*')" src/main/ipc/handlers/<phase-handler>.ts

# Confirm each one is actually seeded:
grep -n "'<key>'" src/main/database/seed.ts
```
If a key is referenced but never appears in the `PERMISSIONS` array, **every role including Admin is permanently locked out of that action** — this is the single highest-yield check in this entire protocol. Also check the *frontend's* declared permission for the same feature (`ProtectedRoute permission="..."`, `Sidebar.tsx` `permissionKey`) matches the *backend's* — a mismatch between the two is a real (if sometimes currently-inert) bug, see Phase 17.

### 2. Broken/dangling i18n key references
Found in Phase 16 (11 distinct keys, 19 call sites) and reintroduced in Phase 17 (2 keys).

Run the extraction-and-cross-reference script (see `scripts/check-i18n-keys.md` pattern below) against every file the phase touched. A key that resolves to `undefined` renders as the **raw literal key string** to every user in every locale — worse than a hardcoded string, and not caught by TypeScript.

Also check: any new `t('key', { count })` interpolation site has proper `_one`/`_other` plural variants, not a single flat key (Phase 17 reintroduced this after Phase 16 had already fixed it elsewhere).

### 3. Sequential-numbering collision on delete
Found in Phase 20 (3 separate number generators).

```bash
grep -n "\.count()" src/main/services/<phase-service>.ts
```
Any numbering scheme using `db.<model>.count()` will reissue an existing number the moment any row is deleted out of sequence, crashing the next `create()` on a `@unique` constraint. The fix is always `findFirst({ orderBy: { createdAt: 'desc' } })` + parse-and-increment.

### 4. Bypassing the "real" creation path
Found in Phase 20 (`convertToInvoice` skipped stock deduction, ledger writes, credit-limit checks, and atomic numbering that the "real" invoice-creation path in `billing.service.ts` does).

Whenever a phase creates a record that has an equivalent "normal" creation path elsewhere in the app (an invoice, a stock movement, a ledger entry), diff the two code paths side by side. A shortcut path that only inserts the row itself — no transaction, no side effects — is a data-integrity bug waiting to surface as silent inventory/ledger drift.

### 5. Delete/void not reversing financial effects
Found in Phase 20 (credit/debit note delete left the ledger entry and balance decrement in place forever).

Any `delete()` on a record that had a financial side effect on create (ledger entry, balance change, stock deduction) must reverse that effect — ideally via a new reversing entry (preserves audit trail) rather than deleting the original ledger row.

### 6. Derived/cached state going stale after a user action
Found in Phase 19 (onboarding checklist read a 60s-cached KPI snapshot that didn't reflect the action the user just took).

Any UI that reads cached aggregate data (`forceRefresh: false` by default) and is meant to reflect the *immediate* result of a user's own action needs either a forced refresh on the relevant transition, or a documented, deliberate staleness window.

### 7. Missing dark-mode background/text classes
Found in Phase 18 (27 inputs across 3 files had a `dark:border-` but no `dark:bg-`/`dark:text-`, rendering as plain white boxes).

Static grep for `dark:` is unreliable (misses "no color class at all" — the actual bug pattern). **Screenshot every claimed-covered screen in forced dark mode**, including modals and forms behind a click, not just the empty-state list view.

### 8. Main-process/renderer logic duplicated instead of shared
Found in Phase 17 (`getTaxLabel` existed only in renderer, so `print.service.ts` in the main process couldn't use it and hardcoded "Tax").

If the same business rule needs to exist on both sides of the IPC boundary, check whether it was actually duplicated (and kept in sync) or just implemented once and silently missing on the other side.

### 9. `session.userId` (a User) injected into a field FK'd to Employee
Found in Phase 25 (`ToothRecord.recordedById`, `TreatmentPlan.createdById`) — two completely broken create paths, live-crashed with `Foreign key constraint violated`.

`User` and `Employee` are separate, unlinked models in this schema — there is no field connecting a login/session `User.id` to an `Employee.id`. Any handler that does `getCurrentSession()?.userId` and passes the result into a payload field, check the target column in `schema.prisma`: if it's `@relation(... references: [id])` pointing at `Employee`, this **always** violates the FK (a User and an Employee essentially never share a cuid). Grep pattern: `grep -B3 'Employee?\?\s*@relation' prisma/schema.prisma` to find every Employee-FK'd field, then check whether the corresponding handler wires it from `session.userId` instead of an actual employee id. The correct fix is to omit the field (let it default to `null`) and thread `userId` through separately for the audit log instead (`AuditLog.userId` **is** correctly FK'd to `User`).

### 10. Prisma `Decimal` fields crash IPC serialization
Found in Phase 25 (`TreatmentPlan.totalEstimatedCost`) — `create()`/`update()`/`list()`/`get()` all throw `Error: An object could not be cloned` the moment a response containing a `Decimal` field crosses the `ipcMain.handle` → `ipcRenderer.invoke` boundary, because Electron's structured-clone algorithm can't serialize a Decimal.js class instance. **This is a live, unfixed, and very widely-reachable bug class**: `grep -c Decimal prisma/schema.prisma` currently returns 60+ fields spread across most of Phases 26–37's models (session packs, staff commission, memberships, legal cases, real estate, placement, tailoring, and more). Every single one will crash the exact same way the instant a service function returns that field to its IPC handler — this was only discovered in Phase 25 because a *different* bug (finding #9 above) was throwing first and masking it. **Check this on every remaining phase**: for any model with a `Decimal` field, verify the corresponding service function converts it (`Number(value)` or `.toNumber()`) before returning — a `serializeX()` helper mapped over the return value, as fixed in `treatment-plan.service.ts`, is the established pattern. Don't assume a phase is clean just because its audit report doesn't mention a crash — the crash only manifests on the specific call path that actually returns the field, and may never have been live-tested.

---

## Stage 3 — Live verification mechanics

The standard way to actually run and drive the app for this project:

```bash
# From the project root:
npm install --no-save --legacy-peer-deps playwright-core@1.61.1
npx electron-vite dev --remoteDebuggingPort 9222 --watch    # --watch is required for main-process hot-rebuild
```

Drive it via a throwaway Node script using `playwright-core`'s `chromium.connectOverCDP('http://127.0.0.1:9222')` — connect to the existing window rather than launching a new one. Useful primitives: click by exact button text (`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === X)`, not a generic text matcher — those can match the wrong nested element), fill inputs via the native `HTMLInputElement.prototype.value` setter + `dispatchEvent(new Event('input', {bubbles:true}))` (React-controlled inputs ignore a plain `.value =`), screenshot with `page.screenshot()`.

For scenarios needing direct DB state (checking a ledger balance, resetting a setting, seeding test data faster than clicking through a form): a short-lived Node script using `@prisma/client` with `DATABASE_URL` pointed at `.dev-data/sarang.db` is faster and more precise than UI automation. Use IPC calls (`window.api.<module>.<method>(...)` via `page.evaluate`) for anything that should go through real validation/permission logic; use direct Prisma for setup/teardown/assertions only.

**Known gotchas:**
- `page.reload()` does NOT reset the main process's in-memory caches (e.g. `_kpiCache` in `analytics.service.ts`) — this is actually useful for reproducing staleness bugs deterministically.
- Raw `history.pushState()` + a synthetic `popstate` event does **not** reliably trigger this app's React Router navigation — always navigate via a real click on a real nav element.
- A native `window.confirm()` dialog will silently auto-dismiss under CDP unless you register `page.on('dialog', d => d.accept())` before the triggering click.
- Always kill `electron.exe` and `rm -rf node_modules/playwright-core` when done — it's a dev-only dependency and should never be committed.

---

## Regression test policy

Add a Vitest test when a Stage 2 fix corrects **service-layer business logic** — the kind of bug a future refactor could silently reintroduce:
- Financial/ledger calculation or reversal logic
- Stock/inventory deduction logic
- Numbering/sequencing logic
- Cross-model side-effect logic (e.g., "creating X must also update Y")

Do **not** add a test for:
- A single permission key being added to `seed.ts` (there is no meaningful "logic" to regress — see the standing permission-coverage test below instead, which catches all of these at once)
- An i18n key being added or repointed
- A Tailwind class being added for dark-mode coverage
- A one-line documentation correction

### Standing regression test (write once, covers class #1 forever)

Rather than a per-phase test, add a single standing test that makes the single most-recurring bug class in this project structurally impossible to reintroduce silently:

```ts
// src/main/__tests__/permission-coverage.test.ts (sketch)
// 1. Statically scan every src/main/ipc/handlers/*.ts file for requirePermission('...') calls.
// 2. Assert every key found is present in seed.ts's PERMISSIONS array.
// 3. Assert every key is granted to at least one non-Admin role (a permission only Admin can ever have
//    is usually itself a sign the seeding was forgotten for the intended role).
```

This single test would have caught all five unseeded-permission bugs found across Phases 13, 14, 15, and 20 before they ever shipped.

---

Powered by Aszurex.
Trust Beyond Limits.
