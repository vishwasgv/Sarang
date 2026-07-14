# Phase 56 — User Manual: Technical Spec

**Status**: Approved by founder 2026-07-13 (format: in-app + standalone PDF; language: all 13 locales in this phase, overriding `PRODUCT_HARDENING_MASTER_PROMPT.md`'s original "English first, translate later" default).

## 0. Why this overrides the master prompt's pinned default

`PRODUCT_HARDENING_MASTER_PROMPT.md` §Phase 56 pinned "English only now, 12-language translation as a separate follow-up phase" as the default, explicitly overridable at this phase's own spec-approval gate. Founder was shown the cost tradeoff directly (translation-after-stabilization avoids the ~1hr/~300k-token cost of retranslating after edits, per the prior session's lesson) and chose all-13-languages-now anyway. Honored as-is — not re-litigated. The retranslation-cost risk this creates (if English content needs edits after translation starts) is accepted; mitigated by finishing and freezing English content per-chapter before translating that chapter, rather than translating only after the entire English manual is done.

## 1. Scope

Cover, accurately and only, what currently exists in the shipped app as of 2026-07-13 (post Phase 57 + ad-hoc Hotel/Lodge vertical):

- **Getting Started**: install, Setup Wizard, first invoice in under 15 minutes (same benchmark as `RELEASE_CHECKLIST.md`'s fresh-install test).
- **Universal features** (apply to every business type): Billing (Invoice/Quotation/Proforma/Credit Note/Debit Note/Purchase Invoice/Delivery Challan), Inventory, Customers & Suppliers (incl. CustomerPicker phone-search reuse), Reports (P&L, Cash Book, Trial Balance, GST reports, business-specific reports), Settings (business profile, Additional Business Features toggles, print type, users), Backup & Restore, Users & Permissions (role model), Audit Log, Dashboard (KPI tiles + alerts), Barcode & Loose/Weight Billing (opt-in), Command Palette (Ctrl+K).
- **All 42 business types**, one chapter each (or merged where two types are genuinely workflow-identical — none currently are, per the 2026-07-12 fresh-audit fix that gave Architect/Civil Engineer real differentiation), grounded in `industry-template.service.ts`'s `TEMPLATE_DEFAULTS` as the single source of truth for what modules/features that business type actually has enabled by default.
- **AI Assistant** (`Ask Sarang`, opt-in `ai_assistant` module): what it is, how to enable it, what it can/can't answer, the local/offline/no-network guarantee, example queries.
- **Explicitly out of scope**: anything not yet shipped (macOS — confirmed out of scope per the master prompt; any vertical/feature not in current `TEMPLATE_DEFAULTS`).

## 2. Delivery format

**Both**, per founder decision:

1. **Markdown source of truth** — one file per chapter per locale: `docs/manual/<locale>/<chapter-slug>.md`. 13 locale folders × ~46 chapter files (1 getting-started + ~10 universal + ~42 business-type, merged/grouped sensibly to a lower real count — see §4) = the actual content set. English (`en/`) is authored and frozen first per chapter; translation copies land in the other 12 folders.
2. **In-app Manual screen** — new sidebar entry "Manual" (bottom of nav, alongside Settings; no `permissionKey` gate — read-only help content visible to every role), reachable also via Ctrl+K search (`CommandPalette.tsx`). Renders the current UI-language's markdown chapter via a lightweight markdown-to-JSX renderer. Content is bundled into the renderer's Vite build via `import.meta.glob('../../../../../docs/manual/**/*.md', { query: '?raw', import: 'default' })` — no `extraResources`/IPC needed, same "lands in the ASAR automatically" pattern `electron-builder.config.ts` already notes for renderer-bundled static assets.
3. **PDF export** — a "Download Manual (PDF)" button on the Manual screen's index, concatenating all chapters of the current locale into one HTML document (reusing the manual's own markdown→HTML render output, wrapped in the same print stylesheet convention as existing reports) and calling the **existing** `exportToPdf({ html, filename })` in `export.service.ts` (hidden `BrowserWindow` + `printToPDF`, already contextIsolation/sandbox-safe) — no new PDF pipeline needed, this is a pure reuse.

**New dependency required**: a small MIT/zero-cost markdown-to-JSX renderer (e.g. `markdown-to-jsx`, ~15KB) — consistent with the project's "zero cost, no paid dependency" rule (cost = money, not bytes; the AI model already added ~1GB deliberately per founder instruction). No dependency needed for the PDF path since it reuses the existing HTML-based `exportToPdf`.

## 3. Content architecture details

- Chapter slugs are stable strings (`getting-started`, `billing`, `inventory`, ..., `business/restaurant`, `business/hotel-lodge`, ..., `ai-assistant`) shared across all 13 locale folders — same file tree shape per locale, just translated content.
- The Manual screen's index/table-of-contents is generated from a single manifest (`docs/manual/manifest.json` or a TS const) listing chapter slug → title-per-locale → whether it's a "business type" chapter (in which case it's only shown/highlighted for the business types it documents, though all chapters remain browsable — the manual is reference material, not gated by `requiredModule`, since an owner switching business types later should be able to read ahead).
- Ctrl+K integration: extend `CommandPalette.tsx`'s search index with chapter titles (already-loaded locale strings, not full-text body search — full-text search across 13×46 files is out of scope, title/section-heading search is sufficient for a help manual).

## 4. Business-type chapter grouping (42 types → manageable chapter count)

Grouped into families for drafting efficiency (each still gets its own clearly-headed section so nothing is merged in the reader-facing content, only in how drafting work is batched):

1. **Core retail/trade** (5): RESTAURANT, RETAIL, HARDWARE, DISTRIBUTOR, GENERAL
2. **Phase 2 retail specialties** (4): PHARMACY, ELECTRONICS, CLOTHING, FOOTWEAR
3. **Manufacturing** (1): MANUFACTURING
4. **Legacy generic service** (3): SERVICE, CONSULTANT, REPAIR
5. **Clinical** (5): VET_CLINIC, GP_CLINIC, SPECIALIST_CLINIC, DENTAL_CLINIC, PHYSIO_CLINIC
6. **Wellness** (3): BEAUTY_SALON, GYM_STUDIO, DRIVING_SCHOOL
7. **Professional** (5): LAWYER, CA_FIRM, COMPANY_SECRETARY, ARCHITECT, CIVIL_ENGINEER
8. **Property/consulting** (2): REAL_ESTATE, INDEPENDENT_CONSULTANT
9. **Creative/agency** (4): MARKETING_AGENCY, SOFTWARE_AGENCY, PHOTO_STUDIO, EVENT_MANAGEMENT
10. **Education** (1): COACHING_INSTITUTE
11. **Trade services** (4): CAR_SERVICE_CENTER, TAILOR_BOUTIQUE, PEST_CONTROL, PLACEMENT_AGENCY
12. **2026-07 new verticals** (6): AGRI_INPUTS, DIAGNOSTIC_LAB, BLOOD_BANK, RENTAL, JEWELLERY, HOTEL_LODGE

## 5. Process gates (identical shape to every phase since 22)

1. ✅ Audit complete — this spec is grounded in a live re-read of `industry-template.service.ts`, `Sidebar.tsx`, `CommandPalette.tsx`, `export.service.ts`, `electron-builder.config.ts`, not assumption.
2. ✅ This spec.
3. ✅ Sign-off obtained (format + language scope, 2026-07-13).
4. Implement infrastructure, then content per family above, tests alongside.
5. Both TypeScript checks — 0 errors.
6. Full vitest suite — no regressions.
7. Independent verification (`/code-review` at minimum).
8. Self-audit rubric.
9. `PHASE_56_COMPLETION_REPORT.md`.

## 6.5. Translation scope refinement (decided during execution, 2026-07-13)

Not every chapter gets translated into all 12 non-English locales. 25 of the 41 business-type chapter files document a business type in `SERVICE_TEMPLATE_TYPES` minus the one named `LANGUAGE_LOCK_EXCEPTIONS` member (Tailor Boutique) — those business types' actual in-app screens are **English-only regardless of the app's language setting** (`getLanguageLockFor()` in `industry-template.service.ts`). Translating their manual chapters into Hindi/Arabic/etc. would describe an English-only screen using UI labels the reader would never actually see on screen — a real, confusing mismatch, not a nice-to-have.

**Decision**: those 25 chapters stay English-only in the Manual too — never translated, no file created for them under any non-English locale folder. `ManualScreen.tsx`'s existing fallback (`getChapterContent(locale, slug) ?? getChapterContent('en', slug)`) already serves English automatically when a locale file is missing — no code change needed, this is purely a content-authoring decision. The remaining 16 business chapters + 10 universal chapters + Getting Started + AI Assistant (28 files total) get real translations into all 12 locales. The AI Assistant chapter itself IS translated (the instructional prose) even though the assistant only understands English queries — the chapter must say so explicitly in the target language, and its example queries stay in English since that's what a user actually has to type.

## 6.6. UI label consistency in translations

Translators must not invent new translations for on-screen navigation terms (Settings, Billing, Reports, etc.) — they must look up the term's real existing translation in that locale's `src/renderer/src/i18n/locales/<locale>.json` (the `nav.*` keys and similar) so the manual's translated navigation instructions match what the reader will actually see on screen. Inventing a plausible-sounding but different translation for "Settings" would be a real, silent defect — a manual that doesn't match its own app's UI.

## 6. Known risk, stated honestly

Translating ~46 chapters × 12 languages by AI in one pass, without a native-speaker review loop, carries the same risk already caught once in this project's history (Phase 45: several locale files had entire feature blocks left as copy-pasted English instead of real translation). Mitigation: spot-check a sample chapter per locale after translation against that exact failure mode before calling the phase done — not a guarantee of native-level quality, which is explicitly out of reach without a human translator budget.
