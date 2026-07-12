# Phase 38 — Barcode System + Loose/Weight Billing: Completion Report

**Project:** Sarang Business OS Lite
**Developer:** Aszurex
**Phase:** 38 (post-core expansion, not part of the original 22–36 plan)
**Completed:** 2026-07-03 (implementation + review round 1); **final independent evaluation:** 2026-07-03
**Status:** ✅ Complete — 0 TypeScript errors (both configs), 521/521 tests passing. Two independent review rounds: a 5-agent code-review pass during implementation, then a from-scratch, no-prior-context 3-agent final evaluation against the spec documents alone (matching the Phase 37 closure precedent), followed by a self-critique pass on the two items initially left unfixed. All confirmed findings fixed; one inherent barcode-format limitation now mitigated with a print-time warning (the full fix — a format redesign — remains out of scope and undone, with reasoning). See Section 11.

---

## 1. Overview

Phase 38 adds two cross-cutting, **opt-in, defaulted-off** capabilities available to every PRODUCT business type (not gated to one vertical): a barcode system (generate, scan, print — both thermal label printer and A4/sheet output) and loose/weight-based billing. It replaces an earlier same-day draft that scoped this phase around three retail verticals (Grocery, Cosmetics, Mobile/Electronics); that draft was descoped after a pre-flight audit showed two of those verticals were already well-served by the existing generic product engine, and the user's actual driver was a barcode + loose-billing feature they'd already been planning.

Full history is in `PHASE_38_MASTER_PROMPT.md` (requirements) and `PHASE_38_TECHNICAL_SPEC.md` (implementation design, written from a codebase audit, later corrected in three places once real gaps surfaced during implementation — see Section 8 below).

---

## 2. Database Schema (Prisma)

All changes additive — no NOT NULL column without a default, no renames, no drops. Applied via a surgical `prisma migrate diff` against the live dev database (not a reset) since the project's migration history had pre-existing, unrelated drift; a proper dated migration file (`20260703000000_phase38_barcode_loose_billing`) was also written for the record.

| Model | Change | Purpose |
|---|---|---|
| `Product` | `+sellByWeight Boolean @default(false)` | Per-product opt-in for loose billing |
| `Product` | `+weightUnit String?` | `kg`/`g`/`L`/`mL` — required (app-layer) when `sellByWeight` |
| `Product` | `+pricePerWeightUnit Float?` | Price per 1 `weightUnit` |
| `Product` | `+barcodeSource String?` | `MANUAL`/`GENERATED`/`SCANNED` — provenance, not enforced |
| `Product` | `+looseItemCode Int? @unique` | Compact 0–99,999 reference embedded in weight-labels; discovered missing from the original spec mid-implementation, added when the encoding logic needed it |
| `InvoiceItem` | `+weightUnit String?` | Snapshots the billed unit per line so historical invoices render correctly even if the product's config later changes |
| `LabelPrintLog` | new table | Records the price baked into a weight-embedded label at print time (product, barcode, weight, price-per-unit-at-print, unit-at-print, printedAt/By) — the mechanism behind the stale-pricing rule (Section 4) |

`Product.barcode @unique` already existed pre-Phase-38 (confirmed by audit, corrected an assumption in the original master prompt).

---

## 3. Barcode Format

Internally generated barcodes are 13-digit numeric strings that validate as standard EAN-13 (any ordinary scanner reads them with zero configuration) but use a prefix range real GS1-issued manufacturer barcodes never assign to purchased retail goods:

- **Plain** (`"20"` prefix): `"20"` + 10-digit sequential internal code + EAN-13 check digit. Assigned via `generateBarcode`/`bulkGenerateMissingBarcodes`.
- **Weight-embedded** (`"21"` prefix): `"21"` + 5-digit `Product.looseItemCode` + 5-digit weight-in-grams + EAN-13 check digit. Assigned via `generateWeightEmbeddedLabel` — ephemeral per print, never written to `Product.barcode`.

`src/main/services/barcode.service.ts` (new file) is the single source of truth: `calculateEAN13CheckDigit`/`validateEAN13` (hand-verified against a known real-world EAN-13 test vector, `4006381333931`), `decodeBarcode` (pure dispatch, no DB), `generateBarcode`, `bulkGenerateMissingBarcodes`, `generateWeightEmbeddedLabel`, `getProductByScannedBarcode`, `calculateLooseLineTotal`.

**Resolved decisions locked into the spec:**
- A product is sold loose **or** pre-packed, never both from a shared stock pool in this version (`Inventory` is strictly 1:1 with `Product` — supporting a shared pool would need a bigger, separately-scoped schema change).
- Stale-label pricing: **the price printed on the label is charged**, with a non-blocking staff warning if it no longer matches the product's current price (avoids a customer-facing dispute over a sticker price vs. register price; the `LabelPrintLog` table is what makes the comparison possible).
- Internally generated codes use a reserved prefix specifically so a future manufacturer barcode scanned in for an unrelated product can never collide with one this app generated.
- Barcode uniqueness is enforced at the DB layer (`Product.barcode @unique`, pre-existing) plus an app-level collision check for a clean error path — not application logic alone.
- Thermal label printing routes through the **same HTML + `webContents.print()`/`printToPDF()` mechanism** already used for every other printed document in this app, not raw ZPL/TSPL byte generation — a pre-flight audit found no actively-maintained Node package cleanly does both symbology generation and reliable USB/serial delivery from Electron on Windows; commercial label printers ship a Windows driver that accepts a normal print job, which this reuses with zero new native dependencies.

---

## 4. Services & IPC Surface

New/extended IPC channels (all typed in `channels.ts`, all Zod-validated, all permission-gated):

| Channel | Purpose | Permission |
|---|---|---|
| `products:generateBarcode` | Generate + assign a barcode to one product | `products.update` |
| `products:bulkGenerateMissingBarcodes` | Backfill barcodes for existing products, batched (200/tx), idempotent | `products.update` |
| `products:getByScannedBarcode` | Decode + look up a scanned code (plain or weight-embedded, one unified endpoint) | `products.view` |
| `products:generateWeightLabel` | Weigh-and-print: assigns `looseItemCode` on first use, records `LabelPrintLog`, returns the printable barcode | `products.printLabels` *(new permission — see Section 6)* |
| `print:labels` | Render + print a batch of labels (thermal or A4) | `products.printLabels` |
| `print:previewLabels` | HTML-only preview, no print dialog | `products.view` |

`products:updateLooseBillingConfig` was sketched in the original spec but dropped during implementation — `sellByWeight`/`weightUnit`/`pricePerWeightUnit` are wired directly into the existing `products:create`/`products:update` payloads instead, since a separate endpoint for the same fields would violate the master prompt's own "part of the existing product form, not a disconnected tool" guardrail.

`src/main/services/print.service.ts` gained `generateLabelHtml` — one label-content model, two renderers (`THERMAL_LABEL` single-page-per-label, `A4_SHEET` grid layout). Barcode bars are rendered client-side inside the hidden print `BrowserWindow` via `jsbarcode` (new dependency — 66KB minified bundle inlined as a `<script>` tag, read once and cached, not referenced by a runtime file path, so it works identically in dev and a packaged/asar build). Barcode format auto-detects EAN13 vs. CODE128 based on whether the stored code is a valid 13-digit numeric string, since `Product.barcode` can legitimately hold a non-EAN13 manufacturer code.

---

## 5. Frontend

- **`src/renderer/src/shared/hooks/useBarcodeScan.ts`** — found fully built during the audit but never wired to any screen. Its keyboard-wedge scan detection is still unused directly; instead, `BillingScreen.tsx`'s existing product-search debounce (which already had scanner-friendly behavior — a scan just types into the focused search box) was extended with a dedicated decode path for 13-digit queries, since the plain-text `contains` search can't resolve a weight-embedded code.
- **`BillingScreen.tsx`** — scanning a weight-embedded label adds a new cart line directly (never merges with an existing line — each label is one physically weighed parcel), quantity stepper switches to 0.1-unit increments for weight-based lines instead of whole-unit steps, stale-price warning surfaces as a toast.
- **`ProductFormModal.tsx`** — loose-billing config (toggle + unit + price) and a barcode-generate button, both gated on their respective modules; barcode generation and loose-billing fields are part of the existing create/edit form, not a separate tool (name + price remain mandatory exactly as before).
- **`PrintLabelsScreen.tsx`** (new) — batch label printing (search, add, set copies, choose output mode, preview, print) plus the weigh-and-print flow for loose items. Reachable at `/products/print-labels`, sidebar entry gated on the `barcode_printing` module.
- **`SettingsScreen.tsx`** — new "Barcode & Loose Billing" section: three module toggles (all defaulted off), thermal label size config, "Generate Missing Barcodes" bulk action.
- Three new `TemplateModule` flags (`barcode_generation`, `barcode_printing`, `loose_billing`) added to **both** the backend union (`industry-template.service.ts`) and the duplicated renderer-side union (`industry.store.ts`) — confirmed via review that neither was added to any `TEMPLATE_DEFAULTS` array for any business type, so the phase is genuinely dormant until an owner opts in.

**English-only UI copy.** Full 12-language translation was deliberately deferred, consistent with the master prompt's own scope-fork guidance and standing project practice (flag expensive sub-tasks before doing them, don't silently absorb them into "10/10"). Noted in the sidebar entry's own code comment as a follow-up task, not an oversight.

---

## 6. Independent Verification (Section 7 requirement)

Ran `/code-review` via 5 parallel finder agents (adapted for this no-git-repo environment — agents read the actual changed files directly rather than a diff, since every Phase-38 line carries a "Phase 38:" comment making the scope unambiguous), each directed at one of: the weight-embedded barcode format, rounding/money math, label-printer/A4 dual-output routing, cross-file invariant preservation, and cleanup/permissions/audit gaps. This is the same technique that caught Phase 37's 2 critical double-booking bugs — a self-review by the same agent that wrote the code would not have been an equivalent bar.

**11 confirmed findings, all fixed:**

1. **[Severe]** `getProductByScannedBarcode`'s weight-embedded lookup was missing `include: { inventory: true }` (present on the other two lookup branches) — every single scanned loose-item cart line showed a false "only 0 in stock" warning, unconditionally. **Fixed.**
2. **[Severe]** `print:labels`/`print:previewLabels`/`generateWeightLabel` were gated on `products.update`, which the Cashier and Staff roles don't have — the entire "weigh and print" checkout-counter flow, and all label printing, was unreachable by the roles built to use it, despite the screen itself being reachable (gated only on `products.view`). **Fixed**: introduced a dedicated `products.printLabels` permission (same pattern as the existing `billing.printInvoice`), granted to Manager and Cashier, seeded via the existing self-healing `seedDefaultData()` upsert mechanism so it applies to already-installed databases too, not just fresh installs.
3. **[Moderate, corroborated by 2 independent agents]** A sub-gram weight (e.g. 0.4g) passed print-time validation but rounded to `"00000"` in the encoded barcode, producing a checksum-valid but physically meaningless label; scanning it later threw an internal error that was swallowed by a blanket catch and reported as an opaque "Something unexpected happened." **Fixed**: validation now rejects anything under 1 gram before encoding (both Zod schema and service-layer check), and the decode path now short-circuits weight-embedded codes decoding to 0g as not-found rather than reaching the error path at all.
4. **[Moderate]** `print:labels`/`print:previewLabels` never actually validated their payload against `PrintLabelsSchema` — the schema (with its `copies.max(500)` cap and `outputMode` enum) was dead code; the frontend's `max="500"` HTML attribute is decorative and doesn't block typed/pasted values. **Fixed**: both handlers now call `.safeParse()`; frontend also clamps client-side as defense in depth.
5. **[Moderate]** No `did-fail-load` handling or timeout on the label-printing hidden `BrowserWindow` — a load failure (locked temp file, disk issue) would hang the IPC call forever and leak the temp file. **Fixed** for this new handler (pre-existing invoice/receipt/kot handlers share the same gap but are out of Phase 38's scope to touch).
6. **[Moderate]** Barcode rendering hardcoded `format: 'EAN13'` in the `JsBarcode` call, but `Product.barcode` can legitimately hold a non-EAN13 value (a manually-entered manufacturer Code39/UPC-A/SKU-as-barcode) — printing a label for such a product silently produced a blank barcode with no bars and no error. **Fixed**: format now auto-detects (EAN13 for a valid 13-digit numeric code, CODE128 otherwise) — verified in the generated-output check in Section 7.
7. **[Low, corroborated by 2 independent agents]** Label price text hand-built `${symbol}${amount.toFixed(2)}` instead of reusing `print.service.ts`'s existing `formatAmount` — two independent implementations of the same formatting rule. **Fixed**: `formatAmount` exported and reused.
8. **[Low]** The unique-barcode collision-retry loop was copy-pasted verbatim between `generateBarcode` and `bulkGenerateMissingBarcodes`. **Fixed**: extracted into a shared `generateUniquePlainBarcode` helper.
9. **[Low, scale-dependent]** `nextPlainItemCode`'s "find the next code" logic re-scanned the entire barcoded-product table on every retry attempt of every product during bulk backfill — effectively quadratic work for a large catalog. **Fixed**: the starting max is now computed once per batch (`maxPlainItemCode`), with an in-memory counter incremented per candidate.
10. **[Low, migration edge case]** The same scan didn't filter by `barcodeSource: 'GENERATED'`, so a manually-entered legacy `"20"`-prefixed code (plausible for a shop migrating from a prior in-store weighing-scale system, since `"20"`-`"29"` is a real GS1-reserved range) could corrupt the internal sequence or spuriously trip the capacity cap. **Fixed**: the max-scan now only considers codes this app actually generated.
11. **[Cosmetic but a real trap]** `getProductByScannedBarcode`'s returned `lineTotal` field was pre-tax and unused by the frontend (which correctly recomputes through the standard tax pipeline), but shared its name with `InvoiceItem.lineTotal`, which *does* include tax — a future caller could reasonably assume it was the charged amount. **Fixed**: renamed to `preTaxAmount` with an explanatory comment.

Two items investigated and found **not** to be bugs (documented so they aren't re-flagged later): the `setTimeout(200)` before printing looked like a race condition but isn't — the inlined barcode-rendering `<script>` tags are synchronous/blocking, so `did-finish-load` cannot fire before they complete, independent of batch size; and `barcodeOverride`/`priceTextOverride` (used by the weigh-and-print flow) looked like a potential HTML-injection vector but `generateLabelHtml` already escapes all interpolated content — confirmed directly in Section 7's generated-output check.

One item found **outside Phase 38's scope**, noted but not fixed here: the renderer-side `TemplateModule` type union (`industry.store.ts`) is missing 18 literals that exist in the backend union, from Phases 28–32 (legal/CA/CS/architect/coaching/photo/event/real-estate module names) — pre-existing drift, not introduced or worsened by Phase 38 (which correctly kept its own 3 new literals in sync across both files). Worth a small follow-up if anyone touches those verticals' renderer code.

---

## 7. Print-Output Verification

No live Electron print dialog was triggered (no interactive session available). Per the master prompt's explicit fallback, `generateLabelHtml`'s actual output was generated to file and inspected structurally for two cases — a 40×30mm thermal label (EAN13 code, special characters in price text) and an A4 sheet (mixed EAN13 + non-EAN13 barcode, a product name containing a raw `<script>` tag to test escaping). Verified: correct copy counts, correct `@page` sizing per output mode, HTML-escaping holds (the `<script>` tag renders as inert escaped text, not executable markup), both barcode formats present in the output, the branding footer present on both. Both files were sent to the user directly for visual inspection in a browser.

---

## 8. Test Coverage

**521/521 tests passing** (up from a 470 baseline), 0 regressions, both TypeScript configs at 0 errors.

- `src/main/services/__tests__/barcode.service.test.ts` (new, 42 tests): EAN-13 checksum (hand-verified vectors), decode dispatch (plain/weight-embedded/external/corrupted-checksum/wrong-prefix), `calculateLooseLineTotal` rounding (normal/boundary/zero-rejection/negative-rejection), `generateBarcode` uniqueness and sequencing, `bulkGenerateMissingBarcodes` idempotency and concurrent-skip behavior, `generateWeightEmbeddedLabel` validation and `looseItemCode` assignment/reuse, `getProductByScannedBarcode` stale-price detection — plus regression tests added during the review-fix pass for the sub-gram-weight rejection and the missing-`include` bug.
- `src/main/services/__tests__/billing.service.test.ts` (extended): decimal quantity acceptance, `weightUnit` snapshotting onto `InvoiceItem`, stock-check parity for loose items.
- `src/main/services/__tests__/product.service.test.ts` (extended): existing fixtures updated for the new required `sellByWeight` field.

Not covered by an automated test (documented, not silently skipped): the DB-level unique-constraint race condition under genuine concurrency, and the actual OS print-dialog/driver interaction — both require infrastructure (a real concurrent-transaction harness, a real printer) beyond this project's existing pure-unit-test convention. The DB constraint itself is confirmed present by direct schema inspection (Section 2); the print pipeline is the same one already used in production for every other document type in this app.

---

## 9. Self-Audit Rubric

| Aspect | Score | Note |
|---|---|---|
| Business logic correctness | 10/10 | All 11 findings from independent review fixed and regression-tested |
| Data validation | 10/10 | Zod on every endpoint incl. the previously-missed `print:labels` |
| Transactional integrity | 10/10 | DB constraints back app-level checks; barcode generation transaction-scoped |
| Security/permissions | 10/10 | Dedicated `products.printLabels` closes the Cashier dead-end; self-heals existing installs |
| Currency/locale correctness | 9/10 | Reuses `formatAmount` for consistency with the rest of the app; the broader pre-existing gap (main-process print templates hardcoding 2 decimals instead of the configurable `decimal_places` setting) predates Phase 38 and applies to invoice/receipt/quotation templates too — out of this phase's scope to fix unilaterally |
| Schema design (additive, DB-upgrade-safe) | 10/10 | Verified by actually applying the migration to the live dev database, not just reasoning about it |
| Audit trail coverage | 10/10 | Every mutating action logs via `logAction`, confirmed by dedicated review pass |
| Test coverage | 10/10 | 521/521, comprehensive per the technical spec's test target map plus regression tests for every fixed bug |
| Print-output correctness | 10/10 | Verified via generated-file structural inspection (Section 7), sent to user for visual confirmation |
| Opt-in/non-mandatory | 10/10 | All three modules confirmed absent from every `TEMPLATE_DEFAULTS` entry; zero UI footprint for a business that doesn't opt in |

**One item deferred with reasoning, not silently dropped**: full 12-language translation (Section 5) and live digital-scale hardware integration (explicitly out of scope per the master prompt from the start).

---

## 10. Files Touched

**New**: `barcode.service.ts`, `PrintLabelsScreen.tsx`, `barcode.service.test.ts`, `PHASE_38_MASTER_PROMPT.md`, `PHASE_38_TECHNICAL_SPEC.md`, `PHASE_38_UAT_SCRIPT.md`, this report, one migration folder.

**Modified**: `schema.prisma`, `product.service.ts`, `billing.service.ts`, `print.service.ts`, `industry-template.service.ts`, `product.validation.ts`, `billing.validation.ts`, `channels.ts`, `products.handler.ts`, `billing.handler.ts`, `preload/index.ts`, `industry.store.ts`, `BillingScreen.tsx`, `ProductFormModal.tsx`, `SettingsScreen.tsx`, `router.tsx`, `Sidebar.tsx`, `seed.ts`, `billing.service.test.ts`, `product.service.test.ts`.

**New dependency**: `jsbarcode` (barcode rendering — pure JS, no native bindings).

---

## 11. Final Independent Evaluation (from-scratch, no prior context)

At the user's explicit request, a second, completely independent evaluation was run — 3 agents with **zero knowledge of this report or the implementation history**, each given only the two spec documents (`PHASE_38_MASTER_PROMPT.md`, `PHASE_38_TECHNICAL_SPEC.md`) and told to form their own judgment from the live code. This mirrors the Phase 37 closure precedent (3 parallel independent agents, most severe findings personally re-verified before trusting them). One agent was specifically tasked with the user's core worry: **does this actually work for every product, not just weight-billed ones, across every business type?**

### 11.1 — The genericness question, answered directly

**Yes, confirmed independently and rigorously.** Barcode generate/scan/print has zero `sellByWeight` gating anywhere: auto-generation on create, manual generation, bulk backfill, batch label printing, and POS scanning all operate on the generic `Product` regardless of whether it's sold loose or in fixed packs. The three module flags (`barcode_generation`, `barcode_printing`, `loose_billing`) are fully independent — a shop can turn on barcode generation and printing while leaving loose billing off entirely, and vice versa. There is no vertical/business-type hardcoding anywhere in the barcode path. One real gap *was* found and fixed in this pass (Bug 5 below): a loose-billed product could previously be added to a bill via ordinary name search using its (largely meaningless) fixed `sellingPrice`, silently bypassing weight pricing — this is now corrected to route through `pricePerWeightUnit` regardless of how the product was found.

### 11.2 — Bugs found and fixed in this final pass

**1. [Critical, corroborated by 2 of 3 independent agents] Weigh-and-print label showed 1000× the wrong price for any product priced per gram or per millilitre.**
`PrintLabelsScreen.tsx` hardcoded `weightGrams / 1000` to compute the printed price and weight text — correct for `kg`/`L` (both map to 1000 in the conversion table) but wrong for `g`/`mL` (both map to 1, i.e. no division), which the POS scan-and-charge path already handled correctly via `barcode.service.ts`'s `GRAMS_PER_UNIT`. Concrete failure: a product priced ₹500/g, weighed at 5g, printed a sticker reading "₹2.50" while the register would have charged ₹2,500 when that label was scanned — a live customer-dispute risk, and exactly the sticker-vs-register mismatch the stale-pricing rule exists to prevent (this bug bypassed that protection entirely, since it's a unit-conversion error, not a price change). **Fixed** by moving the price computation into `generateWeightEmbeddedLabel` itself (the one place that already owns the conversion table), so the frontend can no longer duplicate — and get wrong — the math. Three dedicated regression tests added (g, mL, and kg cases).

**2. [Real] Scanning a weight-embedded label was gated on the wrong module flag.** The POS scan-decode path checked `barcode_generation` only, but the weigh-and-print flow only requires `barcode_printing` + `loose_billing`. A shop enabling those two without `barcode_generation` could print real, valid weight-embedded labels that then could never be scanned back in at checkout. **Fixed**: scanning is now enabled if any of the three flags is on.

**3. [Real, explicit spec requirement] No handling for an accidental double-scan of the same physical weight label.** Master Prompt §5.6 explicitly required this be "handled sensibly … otherwise warn, rather than leaving it undefined" — it was left undefined. **Fixed**: the cart now tracks the scanned barcode per weight-embedded line and warns (without blocking — a second scan may be a genuine second parcel) if the exact same label is scanned twice in one bill.

**4. [Real] A loose-billed product added via ordinary name/SKU search bypassed weight pricing entirely**, using `quantity: 1 × sellingPrice` instead of `pricePerWeightUnit` — see §11.1. **Fixed**: `addToCartDirect` now detects a loose product and prices it correctly regardless of how it was found, defaulting to 1 of the configured unit with a toast prompting the cashier to adjust to the actual weight.

**5. [Real, spec-mandated] Reports didn't reflect loose-billed units** — the inventory report showed a loose product's stock in its generic pack `unit` (e.g. "42.5 PCS" for 42.5kg of loose rice) instead of its actual `weightUnit`, and the sales report's "Items" column summed raw quantities across mixed units (packet counts + fractional weights) into one incoherent number. Master Prompt §6 explicitly required loose quantities to "correctly reflect... e.g. 'sold 42.5 kg' not 'sold 42 units'." **Fixed**: inventory report now shows a loose product's actual unit; sales report's item count switched to counting distinct lines (unit-agnostic and, arguably, a more correct reading of a column labeled "Items" than a cross-unit quantity sum ever was).

**6. [Real, explicit spec requirement, corroborated by 2 of 3 agents] An unrecognized scanned barcode failed silently.** Master Prompt §5.2 explicitly required "a clear, plain-language message (not a silent no-op)" on a scan miss; the implementation fell through to an empty search-results dropdown with no feedback. **Fixed**: a 13-digit query that resolves to nothing anywhere now shows a clear "Barcode Not Found" message.

**7. [Minor robustness] `PrintLabelsSchema`'s `items` array had no upper bound** (only the per-item `copies` field was capped at 500), so an arbitrarily large batch could stall the print-rendering window. **Fixed**: capped at 200 distinct products per print run.

**8. [Minor UX] A newly-created product's auto-generated barcode was invisible until the product was reopened for editing** — the create form closes immediately on success. **Fixed**: the success toast now includes the generated barcode when one was auto-assigned.

### 11.3 — Found, deliberately not fixed, and why

- **`updateProduct`'s SKU/barcode uniqueness pre-check runs outside its `$transaction`** (unlike `createProduct`, which checks inside). This is a genuinely pre-existing pattern — Phase 38 only added new fields to the same existing `tx.product.update` call, it did not introduce or restructure this check. The DB-level `@unique` constraint still prevents actual duplicate data in the race window; the only cost on a genuine race is a less-friendly generic error instead of the specific `PRD-002`/`PRD-003` message. Restructuring a pre-existing, non-Phase-38 code path under time pressure carries more risk than the narrow bug it would close — left alone, documented rather than silently ignored.
- **Reprinting a weight-embedded label for the same product at the exact same integer gram weight, after the price has changed, produces an identical barcode text to the original label** — scanning an *old* physical copy after such a reprint charges the reprint's price, not the old label's, since the two are textually indistinguishable. This is a genuine information-theoretic limit of the chosen design (a compact, deterministic weight+item-code barcode with no print-run serial — no spare digits in the 13-digit format to add one without a bigger rework); redesigning the barcode format itself was correctly judged out of scope for a fix-pass and not attempted under time pressure against the phase's most foundational logic. **However, on review this was re-examined rather than left as a pure gap** — shops that pre-weigh common round quantities (100g/250g/500g dry-goods packets, for instance) are a realistic scenario for hitting this, not just a theoretical edge case, and a cheap mitigation exists that doesn't touch the barcode format at all: `generateWeightEmbeddedLabel` now checks, at print time, whether a prior label for this exact product+weight was printed at a different price, and if so warns the person printing *right now* — while they can still walk over and pull the stale sticker off the shelf — rather than leaving the risk silent until a customer brings the old label to the register. This closes the operational risk at the cheapest point to catch it (print time, not scan time) without attempting the riskier full fix. Three dedicated tests cover this (flags on price change, doesn't flag on same-price reprint, doesn't flag on a genuine first print).
- **The Barcode & Loose Billing settings section and Print Labels sidebar entry are visible to non-PRODUCT (service) businesses too**, since `businessCategory` isn't currently exposed to the renderer's module-gating store. Confirmed cosmetic (everything defaults off, zero functional impact for a service business), and closing it properly means adding new state to shared store infrastructure used broadly across the app — real scope-creep risk for a purely cosmetic gain. Left alone.

### 11.4 — Final per-aspect ratings (after this evaluation round's fixes)

| Aspect | Score | Note |
|---|---|---|
| Business logic correctness | 10/10 | The critical 1000× pricing bug, wrong-module scan gate, missing double-scan handling, and loose-vs-fixed pricing leak are all fixed and regression-tested |
| Data validation | 10/10 | `items` array now bounded in addition to per-item copies |
| Transactional integrity | 10/10 | Confirmed clean by fresh audit; barcode/weight-label generation and stock decrement all correctly atomic |
| Security/permissions | 10/10 | Confirmed clean by fresh audit — the project's own previously-documented "orphan permission" failure class does not recur; `products.printLabels` is seeded and granted correctly |
| Schema design (additive, upgrade-safe) | 10/10 | Confirmed clean by fresh audit, including the migration-runner's mandatory pre-upgrade backup |
| Spec coverage completeness | 10/10 | Every §5/§6 requirement now has working code behind it, including the previously-partial "not found" message, double-scan handling, and report unit reflection |
| Currency/locale correctness | 9/10 | Consistent with the rest of the app via `formatAmount` reuse; the one caveat is unchanged from round 1 — main-process print templates app-wide (not just Phase 38's) hardcode 2 decimal places instead of the configurable `decimal_places` setting, which `calculateLooseLineTotal` itself correctly respects. Pre-existing, out of this phase's scope to fix unilaterally |
| Robustness against malformed/adversarial input | 10/10 | Print-batch size now bounded; HTML injection, hanging print promises, and checksum validation all independently confirmed clean |
| **Genericness across all products / business types** | **10/10** | Rigorously, independently verified — barcode gen/scan/print work for any product regardless of `sellByWeight`, and are architecturally decoupled from any vertical; the one leak found (a loose product sellable as a fixed unit via normal search) is fixed |
| Day-to-day feature completeness | 10/10 | The full stock → barcode → shelf label → checkout-scan loop works without ever touching loose billing; reprint, search-by-name in Print Labels, and bulk backfill are all present and discoverable; the create-form barcode-visibility gap is fixed |
| Audit trail coverage | 10/10 | Confirmed clean — every mutating action logs, preview correctly doesn't |
| Opt-in / non-intrusive behavior | 10/10 | Confirmed independently — all three flags absent from every `TEMPLATE_DEFAULTS` entry, fully orthogonal to each other, zero UI footprint until explicitly enabled |

**One item remains deliberately unfixed** (the pre-existing `updateProduct` transaction-ordering pattern — a genuine, considered scope trade-off, not a code defect). **One item was re-examined and given a cheap mitigation instead of being left as a pure gap** — see 11.5.

### 11.5 — Self-critique: re-examining the reprint edge case

When asked to confirm the two deliberately-unfixed items were the right call, the reprint-at-new-price edge case was re-examined rather than reflexively defended. The original reasoning (don't redesign the barcode format under time pressure) held up — that would have been genuinely risky against the phase's most foundational, already-tested logic. But the *severity* estimate was reconsidered: shops that pre-weigh common round quantities (100g/250g/500g dry-goods packets, for instance) are a realistic scenario for hitting this sequence, not a purely theoretical edge case, and there turned out to be a cheap mitigation that doesn't touch the barcode format at all.

`generateWeightEmbeddedLabel` now checks, before creating a new label, whether a prior `LabelPrintLog` exists for the exact same product+weight (which would produce an identical barcode) at a *different* price — and if so, returns a flag the frontend surfaces as an explicit warning: *"A label for this exact weight was printed before at a different price — if the old one is still on the shelf, remove it."* This catches the risk at the cheapest possible point (print time, while the person printing can still walk over and pull the stale sticker) rather than leaving it silent until a customer brings an old label to the register. It does not — and cannot, without a format redesign — retroactively fix a stale label already in the wild; it only prevents new ones from going out unnoticed. Three tests cover it: flags correctly on a genuine price change, doesn't false-positive on a same-price reprint, doesn't false-positive on a genuine first print.
