# Phase 52 — App Launch & Print Branding Confirmation: Completion Report

## Scope

Per `PRODUCT_HARDENING_MASTER_PROMPT.md`'s Phase 52 entry: audit-only, confirming rather than building. Two parts: (1) re-verify the splash screen's Sarang/Aszurex branding is genuinely readable and correctly sized at real screen resolution, not just present; (2) re-confirm every printed/generated document carries the Aszurex logo + website, with a final call on the one known exception (`generateLabelHtml`, barcode/price labels).

**Method note**: both checks were done via actual rendered screenshots (Playwright `chromium`, launched against the real HTML/assets — not just reading the source), matching this project's own repeatedly-learned lesson (first from Phase 44's watermark z-index bug) that rendering/legibility problems are only ever caught by looking at a real render, never by reading CSS values in isolation.

## Part 1 — Splash screen: real gap found and fixed

`resources/splash.html`'s splash window is a fixed 380×280px (`createSplashWindow()` in `main/index.ts`). Rendered it at that exact real size: the Sarang wordmark + tagline ("sarang / BUSINESS OS LITE / Your Business. Your Way.") is well-sized and clearly legible — no change needed there.

The footer line — "TRUST BEYOND LIMITS · ASZUREX ∞ © 2026" — is the **only** place on the entire splash screen where the Aszurex name appears as actual readable text (everything else is the Sarang logo/wordmark image). At real size it was **essentially illegible**: `color: #1E293B` (Tailwind slate-800) on a `#0F172A` (slate-900) background is a near-zero-contrast pairing — present, but not genuinely readable, exactly the distinction this phase's scope asked to check for. Confirmed via a real rendered screenshot at 380×280 before touching anything.

**Fixed**: changed the footer color to `#64748B` (slate-500) and bumped the font size from 9px to 10px. Re-rendered and confirmed the footer text is now clearly legible without overpowering the main logo's visual hierarchy — a small, surgical fix, not a rebuild.

## Part 2 — Print branding sweep

**`generateLabelHtml` (the known exception) — real gap found and fixed.** It carried only plain "Sarang · Aszurex" text — no partnership mark image, no website — while all 6 other templates in `print.service.ts` (`generateInvoiceHtml`, `generateReceiptHtml`, `generateQuotationHtml`, `generateCreditNoteHtml`, `generateDebitNoteHtml`, `generateKOTHtml`) already call the shared `aszurexBrandSuffixHtml()`/`aszurexFooterHtml()` helpers, which embed the actual partnership-mark image. **Final call: add it, not just document why not** — the same small partnership mark (not the full gradient "S" logo, which wouldn't resolve at real thermal-print resolution on a 40×30mm label) is already proven to render legibly at similarly tiny sizes elsewhere (`generateKOTHtml` uses it at 8px on equally narrow 58/80mm thermal paper). Made `generateLabelHtml` async (matching the other 6 templates' signature — updated its one call site in `billing.handler.ts` to `await` it) and replaced the plain text with `aszurexBrandSuffixHtml(5)`. Bumped `.label-brand`'s font-size from 5px to 6px to comfortably fit the longer string (mark + "www.aszurex.com").

Verified with a real render using the actual bundled `resources/aszurex-mark.png` asset at a simulated real print pixel density (a 40mm label at 203dpi ≈ 320px, which the CSS-mm-based browser preview actually *understates* relative to true thermal-printer resolution, making this a conservative/worst-case check) — the full line "Sarang · Aszurex [mark] | www.aszurex.com" renders clearly, fits comfortably within the label width, and the mark itself is recognizable, not a blurry blob.

**Everything else — confirmed clean, no real gaps.** `export.service.ts`'s `generateReportHtml` already calls `aszurexFooterHtml(9)`; its plain-text `ASZUREX_FOOTER` constant is correctly CSV/Excel-only (no image support in those formats, so plain text is the right call there, not a gap). A grep for `AszurexMark` (main-process/renderer image component) across the 15 renderer files with a `window.open`/print flow that don't reference it initially looked like 15 real gaps — an independent research pass found this was a false-positive list: all 15 actually call a *third*, legitimate branding entry point, the renderer's own `aszurexFooterHtml()` re-implementation in `src/shared/utils/print-branding.ts` (built specifically for `window.open('', '_blank')` popup-print flows, since a popup has no resolvable base URL for the `AszurexMark` component's asset path) — every one of the 15 already has branding via that helper. Two were correctly not print flows at all (a WhatsApp deep link, an eCourts government-portal link).

## Fixes verified

Both fixes were re-rendered and visually confirmed after the change (not just re-read as code):
- Splash footer: real screenshot at 380×280 shows "TRUST BEYOND LIMITS · ASZUREX ∞ © 2026" clearly legible.
- Label branding: real screenshot (using the actual bundled mark asset) shows "Sarang · Aszurex [mark] | www.aszurex.com" clearly legible and correctly positioned under the barcode.

One new automated test added (`generateLabelHtml` now has test coverage for the first time — confirms the real brand suffix string appears, and that product name/price/barcode still render correctly).

## Final state

0 TypeScript errors (both `tsconfig.node.json` and `tsconfig.web.json`), **756/756 tests** (was 754/754 at Phase 51's close — 2 new tests for `generateLabelHtml`, previously untested).

## Deliberately not done (documented, not silently skipped)

- **No further splash-screen redesign** — only the footer's contrast was a genuine gap; the wordmark/logo sizing was already correct, and the master prompt's own instruction was explicit not to rebuild what already works.
- **No change to the KOT print template or any other already-branded template** — all 6 other `print.service.ts` templates were already comprehensive; this phase only touched the one confirmed exception.
- **No re-audit of Phase 44/45/47's already-closed UPI QR / watermark / country-gating work** — out of this phase's stated scope (print *branding*, not print *functionality*), and those were independently reviewed and live-verified in their own phases already.

## How to apply

Phase 52 is done — both real findings (splash footer contrast, label branding) fixed and verified via actual rendered screenshots, not just code review; the broader coverage sweep confirmed comprehensive via an independent pass. Per `PRODUCT_HARDENING_MASTER_PROMPT.md`'s renumbered plan, Phase 53 (Legal Safety & Consent Audit) is next — check that file directly before citing phase numbers, as this bundle has been renumbered multiple times already.
