# Phase 44 — Customer Branding on Documents & Dashboard: Completion Report

## 1. Scope delivered

Per `PHASE_44_TECHNICAL_SPEC.md`:
- **Logo added** to Quotation (previously text-only), Delivery Challan (via
  base64 data URI — its `window.open()`/`document.write()` popup has no
  resolvable `file://` base), and the 3 vertical print templates (Vaccination
  Certificate, Visit Summary, Physio HEP — in-app `window.print()`, `file:///`
  works directly there). Invoice/Receipt already had a logo (pre-existing,
  confirmed working).
- **Watermark mode built from scratch** (confirmed genuinely missing at
  audit) — opt-in toggle in Settings, applies to Invoice/Receipt/Quotation/
  Challan/the 3 vertical certificates.
- **Dashboard logo** — opt-in toggle in Settings, default off.
- **Adjacent fixes bundled in** (all found during the original audit, all
  directly touching code this phase already modified): logo file-size
  validation, orphaned-logo-file cleanup on replace/remove, Zod validation on
  `businessProfile:update` (previously zero validation on this path), a
  path-normalization inconsistency in `SetupWizard.tsx`'s own logo preview.

**Split out of scope, per founder decision during this phase's own audit**:
Credit Note/Debit Note printing doesn't exist at all today (not just missing
a logo) — moved to new **Phase 45**, which will depend on this phase's
logo/watermark mechanism. Both master-plan documents renumbered accordingly
(39–46 → 39–50; AI Assistant 47 → 51) in the same session.

## 2. Independent verification — 8-angle code review, high effort

Per Section 4's process gate, ran a full independent `/code-review high`
pass (8 parallel finder agents: line-by-line, removed-behavior, cross-file
tracer, reuse, simplification, efficiency, altitude, CLAUDE.md conventions)
against every file this phase touched — this repo has no git history, so
each agent was given the explicit file list and change description instead
of a diff. Multiple agents independently corroborated several of the same
root issues, which is itself a useful signal (matches the pattern from every
prior phase's independent-review step).

### Findings, verified and fixed

1. **[CRITICAL, corroborated by the line-by-line agent, personally
   re-verified with a real rendered screenshot before trusting it]
   The watermark was completely invisible on Invoice, Receipt, and
   Quotation** — the three main-process print templates. `<body
   style="position:relative;">` with no explicit `z-index` does **not**
   establish its own CSS stacking context (only an explicit z-index does,
   not `z-index:auto`), so the watermark's `z-index:-1` div escaped past
   `body` entirely and painted **behind body's own opaque white
   background** — i.e., zero visibility. The new unit tests only checked
   for the substring `"opacity:0.08"` in the generated HTML, which passed
   even though the feature didn't actually render — exactly the kind of gap
   a real rendering check catches and a string-match test can't. **Fixed**:
   added `z-index:0` alongside `position:relative` on all three templates'
   `<body>` (`print.service.ts`) and on `ChallanScreen.tsx`'s equivalent
   popup HTML. **Personally re-verified**, not just taken on the reviewing
   agent's word: generated a real invoice preview HTML, rendered it in an
   actual browser (not just checked for a string), and confirmed via
   screenshot that the watermark is now clearly visible, correctly
   positioned behind the readable text, both before the fix (invisible) and
   after (correct). The 3 vertical JSX certificates were never affected —
   their print wrapper already has an explicit `z-index:[9999]`, which does
   establish a stacking context.
2. **[HIGH, corroborated by 2 independent agents]** The new email-format
   validation (`z.string().email()`) on `businessProfile:update` would have
   rejected an **entire** save — including unrelated fields like the new
   watermark/dashboard-logo toggles — for any business whose already-saved
   email doesn't happen to be RFC-valid (free text, legacy data, etc.),
   since this validation runs on every save regardless of whether email was
   touched. **Fixed**: relaxed to a length cap only on this update path
   (format is still enforced at initial setup, where there's no legacy-data
   conflict risk).
3. **[HIGH]** The new 2MB logo-size cap was applied to *every* caller of the
   shared, pre-existing `dialog:openFile` IPC channel — including
   `ProductFormModal.tsx`'s unrelated product-photo picker, which would now
   reject a normal phone-camera photo (commonly 3–8MB) with a "logo" error
   message. **Fixed**: made the cap opt-in per caller (`maxSizeBytes`
   parameter) instead of inferred from the presence of an `accept` list;
   only the two logo pickers (Settings, Setup Wizard) now pass it. Also
   fixed a related pre-existing bug in the same function while touching it:
   the extension check used a hardcoded allow-list instead of the caller's
   own `accept` array, so a caller that only allowed `.jpg/.png/.webp` could
   still have a `.gif`/`.bmp` silently waved through.
4. **[MEDIUM]** `ChallanScreen.tsx`'s `printChallan` became `async` to fetch
   the base64 logo, and awaited that IPC call *before* calling
   `window.open()` — risking loss of the click's user-gesture association
   and a silently-blocked popup on a slow round-trip. **Fixed**: open the
   popup window synchronously first (still inside the gesture), populate it
   once the logo fetch resolves.
5. **[LOW]** The audit-log call for `businessProfile:update` logged the raw
   pre-validation `payload` instead of `parsed.data` (what Zod actually
   allowed through) — a field silently stripped by validation would still
   show up in the audit trail as if persisted. **Fixed**: log `parsed.data`.
6. **[cleanup, corroborated by 3 independent agents]** The watermark
   JSX block (position, rotation, opacity, z-index) was hand-copied
   near-verbatim across the 3 vertical certificate files, and had **already
   drifted** within this same session — the main-process/Challan copies
   used `60vw/max-width:400px`, the 3 JSX copies used `60%/max-width:320px`.
   **Fixed**: extracted a shared `DocumentWatermark` component
   (`shared/ui/molecules/DocumentWatermark.tsx`, matching the existing
   `<AszurexMark>` precedent for exactly this "same brand element, several
   JSX call sites" problem) and a shared `documentLogoUrl()` helper,
   consolidating what had become **7 independent copies** of the same
   `file:///${p.replace(...)}` one-liner across Dashboard/Settings/
   SetupWizard/the 3 certificates. `maxWidth` is now `400` everywhere; the
   remaining `60vw` (print.service.ts/Challan, standalone documents) vs
   `60%` (DocumentWatermark, renders inside the app's own DOM, sometimes in
   a narrow preview modal) is a deliberate, correct difference in units for
   genuinely different layout contexts, not leftover drift.
7. **[cleanup]** `App.tsx`'s original pre-session profile/settings fetch
   (inside `initializeApp()`) always failed silently (both IPC channels
   require a session, and this ran before login) and was left in place
   beside the new, correct fetch — confirmed dead code, removed.

### Findings deliberately not fixed (documented, not silently dropped)

- **`businessProfile:update` embeds validation/cleanup/audit logic directly
  in the IPC handler**, rather than a `*.service.ts` file — every other
  domain in this codebase (109 service files) follows the
  thin-handler/service split; this endpoint was already an outlier before
  this phase and this phase deepened it. A real architectural inconsistency,
  but extracting a full service file for this amount of logic felt like
  scope creep beyond what this phase's verification window could also
  re-validate carefully; flagged for a future pass rather than rushed now.
- **KOT and barcode/price labels don't get a watermark** — by design, not an
  oversight: KOT is kitchen-internal (not customer-facing), and labels
  already carry no business-identity text at all.
- The `dialog:openFile` handler's destination folder (`userData/logos/`)
  and `logo_<timestamp>` filename prefix apply to any caller, including
  `ProductFormModal.tsx`'s unrelated product photos — pre-existing (not
  introduced by this phase), harmless (just an odd folder name for generic
  storage), left alone.
- **Also corrected in this pass**: the original Phase 44 audit (this
  session, before implementation) claimed `ChallanScreen.tsx`'s call to
  `aszurexFooterHtml(10)` was missing a required `await` on an `async`
  function. Re-checked directly against the real source
  (`print-branding.ts`) during the code-review's conventions pass:
  `aszurexFooterHtml` is genuinely synchronous (`(): string`, not
  `Promise<string>`) — the original audit claim was wrong, and no fix was
  needed or applied. Noted here so this doesn't get "fixed" again later by
  someone trusting the stale audit note.

## 3. Verification performed

- **TypeScript**: 0 errors, both configs, checked after every fix.
- **Tests**: 632/632 passing (was 618 at Phase 43's close; +14 net this
  phase — logo/watermark rendering tests in `print.service.test.ts`, a new
  `business-profile.validation.test.ts`).
- **Live app verification**: dashboard logo, Settings toggles, invoice/
  receipt/quotation logo+watermark, and Delivery Challan logo+watermark all
  driven live in the actual Electron dev app (Playwright `_electron`,
  admin session). Confirmed real DB persistence, real IPC round-trips, real
  rendered output — not just unit-level string checks.
- **The critical watermark bug specifically** was caught *because* of this
  live-rendering discipline: a string-match test (`toContain('opacity:0.08')`)
  passed the whole time despite the feature being entirely invisible: only
  an actual screenshot exposed it.
- Attempted a full packaged-build (`electron-builder`) test to
  definitively rule out the dev-server-only `file://` cross-origin
  restriction noted for Dashboard/Settings previews (Vite serves the
  renderer over `http://localhost:5173` in dev, and Chromium blocks
  `http:`→`file:` resource loads — this is why those previews showed a
  console warning in dev testing but are expected to work in the packaged
  app, which loads its whole renderer via `file://`, matching scheme). The
  packaging attempt hit an unrelated Windows environment issue (electron-
  builder's macOS codesign-tool download requires a symlink privilege not
  granted in this sandbox) before completing cleanly enough to trust as a
  clean test; this is an environment limitation, not a code defect, and is
  the same pre-existing gap already tracked in `RELEASE_CHECKLIST.md`
  ("fresh-install tests still unchecked").

## 4. Final status

- 0 TypeScript errors, both configs.
- 632/632 tests passing.
- 1 critical bug (invisible watermark), 2 high-severity regressions (email
  validation blocking unrelated saves; size cap wrongly scoped to an
  unrelated feature), and several smaller correctness/cleanup issues found
  via independent review and fixed — none of these would have been caught
  by self-review alone (confirmed: the self-authored spec and initial
  implementation both missed all of them).
- 2 architectural notes documented for a future pass rather than fixed now
  (service-layer extraction for businessProfile logic; see §2).

Phase 44 is complete against its own spec. Phase 45 (Credit Note & Debit Note
Print Templates, `PRODUCT_HARDENING_MASTER_PROMPT.md`) is next in sequence
and depends on this phase's logo/watermark mechanism.
