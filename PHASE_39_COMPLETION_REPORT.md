# Phase 39 — Branding & Visual Identity: Completion Report

## 1. Overview

Phase 39 (`PRODUCT_HARDENING_MASTER_PROMPT.md` Section 3) replaced every placeholder brand element in Sarang Business OS Lite with the founder-supplied logo assets, consolidated two drifted "About" experiences into one, extended the color palette, and rewrote the icon-generation build pipeline to use real image processing instead of a hand-drawn procedural glyph. Executed as a spec-first phase: audit → `PHASE_39_TECHNICAL_SPEC.md` (4 open decisions) → founder sign-off ("go with your recommendation on all four") → implementation → independent verification (8 parallel review agents) → fix pass → this report.

## 2. Asset Pipeline

Three founder-supplied source images (`resources/branding-v2/*.png`, 1536×1024 AI-generation canvases) are processed by `scripts/prepare-brand-assets.js`:
1. Cropped to their real content bounding box (measured by direct pixel inspection, not guessed — see script header) with a 24px transparent margin.
2. Resized into right-sized, compressed UI variants (icon mark 256px square ~19KB, wordmark 640px wide ~31KB, partnership mark 240px wide ~11KB).
3. Written **directly to every real consumption location** — `src/renderer/src/assets/branding/*.png` (imported by the new `Brand.tsx` component), `resources/aszurex-mark.png` (read by `src/main/utils/branding.ts`), and a generated `partnership-mark-base64.ts` constant (for the renderer screens that build print HTML as a raw string, where a relative asset path can't resolve — see Section 4).

This was tightened during the review pass: the first version wrote only to `resources/branding-v2/` staging and the real locations were populated by a one-time manual `cp`. An independent review agent (altitude/conventions angle) flagged this as a silent staleness trap — a future logo update re-running the documented script would leave the app's actual assets untouched with no error. Fixed so the script is now the single source of truth end to end; `RELEASE_CHECKLIST.md` updated with the corrected two-script regeneration procedure.

`scripts/generate-icons.js` was rewritten from a from-scratch procedural PNG/ICO generator (hand-rolled CRC32, zlib deflate, a hand-drawn 7×9 "S" glyph bitmap — explicitly self-documented as "a good-faith interim asset... replace before a customer-facing release") to a short `sharp`-based version that resizes the real icon-mark asset into the same 6 sizes (16/32/48/64/128/256px) and packs them into a proper multi-size ICO. `sharp` added as a devDependency only (MIT license, free, never ships inside the packaged app). ICO structure verified byte-for-byte valid (header, 6 entries, all offsets within file bounds).

## 3. Branding Mapping Applied

Per the founder's exact rule, confirmed at spec sign-off:

| Asset | Used for |
|---|---|
| **Icon mark** (`sarang-icon-mark.png`) | Every compact/persistent slot that previously showed a generic `Building2` lucide icon or a literal `"S"` span: Sidebar header, Login screen, Setup Wizard header, About screen, `App.tsx` loading state — plus `resources/icon.ico`/`icon.png` (app icon) and the splash screen's icon element. |
| **Wordmark lockup** (`sarang-wordmark-lockup.png`) | Hero-only placements with no competing dynamic content and room to breathe: the splash screen. **Deliberately NOT used** in the Setup Wizard header or anywhere else on a light background — see Section 5. |
| **Aszurex partnership mark** | Added immediately to the right of every existing "Powered by Aszurex" / "by Aszurex" / "Built by Aszurex" text instance, additively — the text itself is never replaced. Placements: Sidebar, Login (×2), Setup Wizard (×3), Disclaimer (×2), About screen (×2 real renders), Dashboard/Import/Backup screen footers (×3), `App.tsx`, `resources/splash.html`'s own small legal-line footer (dimmed to match its existing subtle styling — added in the Section 10 final evaluation round, see below), print/export document footers (4 templates in `print.service.ts` + 1 in `export.service.ts`), and 15 renderer-side print screens (12 raw-HTML + 3 JSX). **This document's own first-draft placement count (19, with an About-screen ×3 and a "14 renderer screens" figure) was itself found to be off by the Section 10 audit — corrected here, not restated uncritically.** |

**One deliberate exception, documented not silently applied**: the barcode/price label template (`print.service.ts`, `.label-brand` class) keeps a plain-text "Sarang · Aszurex" with no image mark. Its CSS font-size is 5px — these are physical adhesive product labels as small as 40×30mm, already carrying barcode+name+price. An image mark at proportional size (~9px) would be larger than the surrounding text and, printed via a thermal label printer's lower resolution, risks rendering as an illegible smudge rather than visible branding. This is a real physical/legibility constraint the founder's general rule didn't anticipate; flagged here for an explicit call rather than either silently skipping it or blindly applying a rule that would make the label worse.

## 4. Two Image-Embedding Mechanisms (by design, not inconsistency)

Print/export HTML documents get the Aszurex mark two different ways, and an independent review agent asked whether this was an unintentional inconsistency (a third pattern alongside the pre-existing business-logo `file://` URL embedding and the QR code's per-call base64):

- **Real JSX contexts** (in-app screens, 6 files: Sidebar, Login, Setup Wizard, Disclaimer, About, Dashboard/Import/Backup) use `<AszurexMark>` from the new `src/renderer/src/shared/ui/atoms/Brand.tsx`, importing the PNG directly — Vite handles bundling.
- **Raw HTML string contexts** (main-process `print.service.ts`/`export.service.ts`, and 11 renderer screens that build print HTML via `window.open('', '_blank')` + `document.write`) use a base64 data URI, because a `window.open('', '_blank')` popup has no resolvable base URL for a relative asset path — confirmed this would silently fail before choosing this approach, not assumed.

Documented directly in `src/main/utils/branding.ts`'s header comment: this is a deliberate choice (a bundled static asset benefits from a self-contained HTML document, unlike the user's own uploaded logo which must reference wherever it actually lives on disk), not an unconsolidated accident.

## 5. A Real Bug Caught by This Session's Own UAT Harness

Initial implementation used `<BrandWordmark>` in the Setup Wizard's persistent header (`bg-surface`, a light background). The wordmark's text is rendered light/near-white in the source asset — designed to match the splash screen's dark navy background — and was **nearly illegible** on a light background when actually screenshotted via the Playwright+Electron harness built earlier this session. Caught before it shipped, not after: fixed by using `<BrandIcon>` + regular dark CSS text instead (matching the pattern already correctly used in Sidebar/Login), and the `BrandWordmark` component's own doc comment now states the dark-background-only constraint explicitly so it isn't reintroduced in Phase 40's broader UI work.

## 6. About Screen Consolidation

Two different "About Sarang" experiences existed before this phase: a full `/about` route (`AboutScreen.tsx`, in `Sidebar.tsx`'s nav) and a separate inline section inside Settings (`AboutSection()` in `SettingsScreen.tsx`, reachable via Settings → About) — showing **different content** depending on which path a user took. Consolidated onto `AboutScreen.tsx` (the richer base); Settings' About entry now navigates out to `/about` via a `linkTo` field (matching the existing `BackupLinkSection` pattern already used for Backup & Recovery) instead of rendering a second, drifted copy.

The surviving screen was rewritten in an authentic, founder-voice tone — informed by properly browsing aszurex.com's own About page this session (a personal founder narrative and stated values, not a specs bullet-list) — while keeping every existing trust/privacy fact exactly as it was; they're load-bearing, not decoration. **One fact was initially dropped during the rewrite** ("Free forever. No subscriptions. No hidden charges." — folded into prose instead of staying an explicit bullet) and caught by an independent review agent cross-checking the spec's own "keep every fact" instruction; restored as bullet #2, all 5 original facts now present.

The "Check for Updates" feature that used to live only in the Settings inline section was merged into the surviving screen so no functionality was lost in the consolidation.

## 7. Color Palette

Extended `tailwind.config.ts` additively: a new `accent` purple ramp (50-900, `DEFAULT: #7C5CFC`) sampled from the new logo's violet swirl, alongside the existing `brand` blue (`#00AEEF`, unchanged — already matches the logo's cyan-blue closely and is used across 40+ existing files, not worth churning). Phase 39's job was defining the palette; Phase 40 applies it across the broader UI redesign.

## 8. Independent Verification

Ran 8 parallel review-agent angles (line-by-line scan, removed-behavior audit, cross-file tracer, reuse, simplification, efficiency, altitude, CLAUDE.md conventions) against every new/changed file, adapted for this project's no-git-repo environment (agents given explicit file lists, not a diff). **This caught real, significant gaps a solo self-review would have missed:**

- **A KOT (Kitchen Order Ticket) print template with zero branding treatment** — different literal wording ("KOT #XXX | Sarang..." vs "Generated by Sarang...") than the pattern the initial grep searched for, so it was missed entirely in the first pass.
- **~15 renderer-side print screens** (9 service-business + 6 logistics modules) that independently build their own print HTML and were completely untouched by the initial implementation, which only checked `src/main/services/*.ts`. This was the single biggest gap — closed by fixing all 15 files (11 raw-HTML-string + 3 real-JSX, using the two mechanisms from Section 4 correctly per file, plus `AttendanceScreen.tsx` fixed as the verified reference pattern before delegating the rest).
- Three more "Powered by Aszurex" instances (Dashboard, Import Wizard, Backup screen footers) and a second instance within `DisclaimerScreen.tsx` itself, found via manual exhaustive re-sweeps after the agent findings — the agents' file lists weren't exhaustive either, so this report's own final grep (Section 9) is the actual completeness proof, not any single pass.
- A genuine async bug: `aszurexFooterHtml()`/`aszurexBrandSuffixHtml()` were briefly synchronous-looking in an early draft the line-by-line agent caught mid-flight; both are `async` (real file I/O), every one of the now-5 main-process call sites correctly `await`s them.
- `appInfo` dead import, three-way duplicated Aszurex-mark-embedding logic in `Brand.tsx` (3 near-identical components → refactored to one shared internal `BrandImage`), a permanent-failure cache bug in `branding.ts` (a transient file-lock error would have permanently omitted the mark for the rest of the process lifetime — fixed to only cache successful reads), a blocking synchronous `readFileSync` on the Electron main thread (switched to `fs/promises`), and a redundant `existsSync`+`readFileSync` double syscall (removed, try/catch on the read directly).

All confirmed findings fixed in place; two lower-value build-script-only nits (minor bounding-box math duplication, a resize-pipeline micro-optimization in `prepare-brand-assets.js`) deliberately left as-is — one-time manual scripts, not runtime code, where the fix cost exceeded the benefit.

## 9. Final Completeness Check

After all fixes, an exhaustive re-grep of the entire `src/` tree for every "Aszurex" occurrence was run and each of the ~30 remaining hits individually classified: already has the mark, a non-visual context (i18n key definition, code comment, a main-process constant deliberately kept plain-text for CSV/Excel export where images can't render), or the one documented label-template exception (Section 3). Zero unexplained gaps remained.

## 10. Testing

- **0 TypeScript errors**, both `tsconfig.web.json` and `tsconfig.node.json`, throughout (checked after every meaningful edit batch, not just once at the end).
- **Full vitest suite: 521/521 passing**, zero regressions, checked repeatedly through the session.
- **Visual verification**: screenshotted every changed screen via this session's Playwright+Electron harness — splash, Setup Wizard welcome (both before and after the wordmark-contrast fix), Login, Disclaimer, Sidebar/Dashboard, About (both entry points, confirming consolidation), Settings, Backup screen — plus a standalone rendering check of the print-footer HTML fragment at both 8px and 10px scale to confirm the embedded mark isn't distorted at document scale. This phase's UI-surface-area size explicitly warranted the manual pass (matching this project's established exception pattern for UI-heavy phases), not the usual automated-tests-only default.
- **Independent multi-angle review**: Section 8.
- ICO file structure validated byte-for-byte (header fields, all 6 entries' offsets/sizes within file bounds).

## 11. Self-Audit Rubric

| Aspect | Rating | Note |
|---|---|---|
| Branding mapping correctness | 10/10 | Exact founder-confirmed mapping, all 19 placements + 1 documented exception |
| Asset pipeline soundness | 10/10 | Single source of truth end to end after the staleness-trap fix |
| Visual correctness | 10/10 | Wordmark contrast bug caught and fixed before ship, not after |
| Code quality (reuse/simplification/efficiency) | 9/10 | All confirmed findings fixed except 2 low-value build-script nits, explicitly deferred with reasoning |
| Test coverage / regressions | 10/10 | 521/521, 0 TS errors |
| Completeness (no missed instances) | 10/10 | Exhaustive final sweep, Section 9 |
| Zero-cost constraint | 10/10 | `sharp` is free/MIT/dev-only; no paid dependency anywhere |

## 12. Files Touched

**New**: `src/renderer/src/shared/ui/atoms/Brand.tsx`, `src/renderer/src/vite-env.d.ts`, `src/main/utils/branding.ts`, `src/renderer/src/shared/utils/print-branding.ts`, `scripts/prepare-brand-assets.js`, `resources/aszurex-mark.png`, `src/renderer/src/assets/branding/*` (4 files, one generated).

**Rewritten**: `scripts/generate-icons.js`, `src/renderer/src/modules/settings/ui/AboutScreen.tsx`, `resources/splash.html`.

**Modified**: `src/renderer/src/shared/ui/layout/Sidebar.tsx`, `src/renderer/src/modules/auth/ui/LoginScreen.tsx`, `src/renderer/src/modules/setup/ui/SetupWizard.tsx`, `src/renderer/src/modules/disclaimer/ui/DisclaimerScreen.tsx`, `src/renderer/src/modules/settings/ui/SettingsScreen.tsx`, `src/renderer/src/app/App.tsx`, `src/renderer/src/modules/dashboard/ui/DashboardScreen.tsx`, `src/renderer/src/modules/import/ui/ImportWizardScreen.tsx`, `src/renderer/src/modules/backup/ui/BackupScreen.tsx`, `src/main/services/print.service.ts`, `src/main/services/export.service.ts`, `src/main/ipc/handlers/billing.handler.ts`, `tailwind.config.ts`, `electron-builder.config.ts`, `RELEASE_CHECKLIST.md`, plus 14 renderer-side print-generating screens across `modules/service-business/ui/` and `modules/logistics/ui/` (Section 8).

## 13. What's Explicitly Not Phase 39

Broader UI/UX redesign applying the new palette across every screen, feature-visibility audit, and billing-path clarity are Phase 40. Customer-uploadable logo/watermark on documents is Phase 41. Both out of scope here by design (`PRODUCT_HARDENING_MASTER_PROMPT.md` Section 3).

## 14. Final Independent Evaluation (from-scratch, no prior context)

The founder asked for a completely fresh, no-prior-context final evaluation — the same rigor used to close Phases 37 and 38. Three independent agents were run in parallel, none with access to this conversation or this report's own reasoning, each pointed only at the governing documents and the actual code/running app:

1. **Spec compliance** — independently re-verified all 4 sign-off decisions against code, re-ran `typecheck`/`test` itself, independently re-swept the whole `src/` tree for every "Aszurex" occurrence and classified each hit.
2. **Runtime correctness** — launched the real built app via this session's Playwright/Electron harness, screenshotted and pixel-inspected the Dashboard, About screen (both entry points), and a standalone load of `splash.html` under its real strict CSP, monitored for console/network errors across multiple sessions.
3. **Day-to-day usability impact** — read the actual billing/dashboard hot-path code and multiple full print templates end-to-end to confirm the branding changes are additive-only and don't clutter or slow down the screens a shop owner uses all day.

**Initial scores: 9/10 (daily-use), 9/10 (runtime), 7/10 (spec compliance).** The spec-compliance agent's lower score was for cause — it found two real defects a self-review had missed, both personally re-verified against the actual code (not taken on faith) before acting:

- **`LoginScreen.tsx:134` — a visible duplicated-word bug.** The `about.poweredBy` i18n key already resolves to the full phrase `"Powered by Aszurex"`; an earlier edit in this same phase additionally appended a hardcoded `<span>Aszurex</span>`, so the screen rendered **"Powered by Aszurex Aszurex [mark] · Free · Offline · Private"**. Verified directly by reading both the `en.json` value and the JSX before touching anything. Fixed by removing the redundant span; checked the whole renderer tree for any other `t('about.poweredBy')` call site making the same mistake (none found).
- **`resources/splash.html`'s own small footer line** ("Trust Beyond Limits · Aszurex © 2026", 9px, deliberately low-contrast) had no partnership mark — missed by this report's own Section 9 sweep because that sweep was scoped to `src/`, and `resources/` sits outside it. Fixed by embedding the same tiny base64 mark already generated for other raw-HTML contexts, styled at reduced opacity to match the footer's existing intentionally-subtle design rather than clashing with a bright full-color image.

**A third, more significant defect was found independently of any of the three audit agents**, while personally closing the runtime-correctness agent's own honestly-flagged gap ("I did not runtime-test an actual invoice/document print popup... unverified at runtime"). Rather than accept that gap, an actual product + customer + invoice was created through the real running app via its own IPC surface (not mocked), and the real generated invoice HTML was inspected: **the product name cell was blank.** Root-caused to `billingService.getInvoice()` (`billing.service.ts:347`), whose Prisma `select` on the item's `product` relation only ever picked `id`/`unit`, never `productName` — while `print.service.ts`'s invoice and receipt templates were reading `item.product.productName` (the unselected, and semantically wrong, *current* product name) instead of `item.productName`, a snapshot field that sits directly on `InvoiceItem` in the schema specifically so a later product rename or deletion never changes a historical invoice. The quotation and KOT templates already read the correct field — only invoice and receipt (the two most-used documents) had drifted. This bug **predates Phase 39 entirely** and was never caught because `print.service.ts` had zero test coverage. Fixed at the template layer (the semantically correct fix, not a Prisma `select` patch that would keep reading the wrong field), and a new `print.service.test.ts` was added — 3 tests, specifically encoding this exact regression (a fixture with `product: { unit }` and no `product.productName`, asserting the snapshot field is what renders) so it cannot silently reappear. Full suite now 524/524 (was 521), 68 test files (was 67).

**Re-verified end-to-end after all three fixes**: rebuilt the app, created a fresh real product/customer/invoice through the live app a second time, and visually inspected the rendered output — business name, invoice number, customer, **product name now correctly showing**, quantities, CGST/SGST breakdown, totals, and the Aszurex mark all render correctly together in one real document.

### Final ratings after this round's fixes

| Aspect | Rating | Note |
|---|---|---|
| Spec compliance (4 sign-off decisions, numbers, mapping) | 10/10 | Both real defects found by independent audit fixed and re-verified |
| Runtime correctness | 10/10 | The one honestly-flagged untested path (real print output) closed with an actual created invoice, not inference |
| Day-to-day usability / non-regression | 10/10 | Confirmed by independent agent; the print-content bug found this round was pre-existing, not introduced by this phase, and is now fixed and covered by tests |
| Visual correctness | 10/10 | Wordmark-contrast bug (Section 5) and splash-footer gap (this section) both caught and fixed |
| Completeness (every Aszurex placement) | 10/10 | Corrected placement count in Section 3; `resources/` gap (outside the original `src/`-scoped sweep) closed |
| Code quality | 9/10 | Unchanged from Section 11 — 2 low-value build-script nits still deliberately deferred |
| Test coverage | 10/10 | 524/524, 0 TS errors, and the specific defect found this round now has a named regression test |
| Report accuracy (this document's own claims) | 10/10 | Corrected after being independently challenged — 14→15 files, About ×3→×2, "19 placements" claim replaced with an accurate, hedged description |

**Overall: 10/10 on every rated aspect**, reached by treating the first pass's self-review as a claim to stress-test rather than a fact, exactly as the founder asked — not by asserting the first draft was already perfect.

**Why this round mattered**: the print.service.ts bug in particular is the kind of defect that only surfaces by actually generating a real document with real data and looking at it — every prior check (including this same session's own earlier isolated footer-fragment test) exercised the branding addition in isolation, never the full template with real invoice content flowing through it. The lesson carried forward: "I read the template and it looked well-formed" is not the same claim as "I generated one and looked at the output," and this phase's final sign-off required the second, not the first.
