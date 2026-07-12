# Phase 45 — Credit Note & Debit Note Edit + Print: Completion Report

## 1. Scope delivered

Per `PHASE_45_TECHNICAL_SPEC.md`, revised from the master plan's original
print-only scope after the phase's own audit found neither service had an
`update()` at all:

- **Edit**: `creditNoteService.update()` / `debitNoteService.update()`, with
  proper append-only ledger reversal (never mutates a posted ledger row —
  reverses the old effect, applies the new one as a fresh entry) when the
  amount or the linked customer/supplier changes. A reason/notes-only edit
  never touches the ledger.
- **Print**: `generateCreditNoteHtml`/`generateDebitNoteHtml` in
  `print.service.ts`, mirroring `generateQuotationHtml`'s shape (business
  header, watermark, Aszurex footer) but as a lump-sum summary document (no
  line items, no tax breakdown — confirmed out of scope, matches the actual
  flat schema). New `creditNotes:print`/`debitNotes:print` IPC channels,
  reusing Phase 44's logo/watermark mechanism from day one.
- New `purchaseOrders.print` permission (Debit Note is a purchasing-domain
  document; reusing `billing.printInvoice` would have been a semantic
  mismatch with the rest of that domain's permission convention).
- Both `CreditNotesScreen.tsx`/`DebitNotesScreen.tsx` got Edit + Print
  buttons, reusing the existing create-form panel for edit rather than a
  separate form.
- No schema migration — confirmed unnecessary at the phase's own audit.

## 2. Independent verification — 6-angle code review

Per Section 4's gate, ran an independent review (6 angles this pass, sized
to the phase — line-by-line, removed-behavior, cross-file tracer, reuse+
simplification, efficiency+altitude, CLAUDE.md conventions). This is a
money-touching phase (ledger balance correctness); founder chose the
standard local review over `/code-review ultra` given the live verification
already run (real create→edit→reversal→final-balance check against the
actual database, confirmed correct before the review even started).

### Findings, verified and fixed

1. **[CRITICAL, independently corroborated by 2 of 6 agents]** Both
   `update()` functions read the row-to-be-mutated via a plain
   (non-transactional) `findUnique` **before** `$transaction` started, then
   used that snapshot for the ledger-reversal math **inside** the
   transaction. This is the exact race class this codebase already hit and
   fixed once before — `billing.service.ts`'s `cancelInvoice` has an
   explicit comment documenting why the lookup must happen inside the
   transaction (two concurrent calls reading the same pre-mutation snapshot
   can each post a reversal, double-reversing the ledger). Both review
   agents flagged this independently, unprompted, citing that exact
   precedent. **Fixed**: moved the `findUnique` inside `$transaction` for
   `update()` in both services, mirroring the established fix. Also applied
   the identical fix to `delete()` in both services — pre-existing (not
   introduced by this phase) but the exact same bug class, sitting in the
   same file I was already editing, cheap and directly relevant to fix
   alongside `update()` rather than leave known-broken.
2. **[HIGH]** The frontend's edit-save payload built `customerId: form.customerId || undefined`
   (same for `invoiceId`/`supplierId`/`purchaseOrderId`/`notes`). Since the
   service's update semantics treat `undefined` as "leave unchanged" and
   `null` as "explicitly clear," selecting "N/A" in a dropdown to detach a
   customer/supplier during an edit silently did nothing — the save
   reported success, but the party (and its ledger effect) stayed linked.
   **Fixed**: the edit path now sends `null` for empty selections (the
   create path is unaffected, still sends `undefined`, matching its
   existing working behavior) — correct because this form always
   resubmits the complete intended state on every save, so there's no
   legitimate "leave unchanged" case to preserve. **Personally re-verified
   live**: created a credit note linked to a real customer, edited it via
   the actual UI, selected "N/A," saved, and confirmed via a direct
   `creditNotes:get` call that `customerId` is now genuinely `null` (was
   silently still set before the fix).
3. **[HIGH]** The customer/invoice (and supplier/PO) dropdowns are
   populated from a bounded, recency/alphabetically-ordered fetch (100
   invoices, 20 purchase orders, 50 customers/suppliers). Editing a note
   linked to a record outside that window showed a blank/unselected
   dropdown — risking the user picking a different (wrong) option or "N/A"
   and silently overwriting the correct linkage on save. **Fixed**: the
   fetch effect now merges the currently-linked record back into the
   dropdown list (using data already embedded in the row itself, no extra
   fetch) whenever it's missing from the bounded results.

### Findings reviewed and confirmed as non-issues

- CSS/style-block duplication in the new print templates — matches the
  pre-existing convention every other template in `print.service.ts`
  already uses (each owns its own full `<style>` block); not a deviation.
- The near-identical structure between `creditNoteService`/`debitNoteService`
  and between the two screens — consistent with this codebase's existing
  "mirrored twin" pattern (`customer-ledger.service.ts`/
  `supplier-ledger.service.ts` predate this phase), not new duplication
  introduced here.
- Validation-in-handler placement — confirmed matches the established
  convention (`billing.handler.ts`'s `CreateInvoiceSchema`/
  `CancelInvoiceSchema` follow the identical shape).
- CLAUDE.md conventions — no governing file exists in this repo; checked
  against `PRODUCT_HARDENING_MASTER_PROMPT.md`'s equivalent rules instead,
  no violations found.

## 3. Verification performed

- **TypeScript**: 0 errors, both configs, re-checked after every fix
  (including a TS control-flow quirk the transaction-scoping fix
  introduced — a `let` variable typed as an object and only assigned
  inside the transaction closure narrowed to `never` at the read site;
  fixed by storing the one string field actually needed instead of the
  whole object).
- **Tests**: 654/654 passing (was 632 at Phase 44's close) — 10 new tests
  for `update()`'s ledger-reversal correctness (amount change, party
  reassignment, no-op reason/notes edit, not-found, bad FK reference) per
  service, 12 new tests for the two print-template generate functions
  (reason/amount rendering, reference-line presence/absence, logo,
  watermark).
- **Live verification**: full create → edit → save cycle driven in the
  real Electron dev app for both Credit Notes and Debit Notes, via the
  actual UI (not just IPC calls) — zero console errors throughout. Ledger
  correctness confirmed by reading the real `CustomerLedger`/
  `SupplierLedger` rows directly from the database after an amount edit:
  reversal entry exactly offsets the old amount, new entry exactly applies
  the new amount, final party balance matches the edited amount precisely.
  The clear-to-null fix (finding #2 above) was re-verified the same way,
  live, after being fixed.
- **Not exercised live**: the actual `creditNotes:print`/`debitNotes:print`
  IPC channels themselves — these call `webContents.print({silent:false})`,
  which pops a real OS print dialog that would hang an automated test
  waiting for a human to dismiss it (same reasoning as Phase 44's
  verification). Instead, confirmed the exact data shape the print
  handlers depend on (`getById()`'s `customer`/`invoice`/`supplier`/
  `purchaseOrder` relations) directly via IPC, and covered the actual HTML
  generation with unit tests. The delivery mechanism itself
  (temp-file + hidden `BrowserWindow.loadFile()` + `webContents.print()`)
  is verbatim-identical to Quotation's already-working, already-shipped
  print channel — same class of confidence as Phase 44's invoice/receipt
  verification.

## 4. Final status

- 0 TypeScript errors, both configs.
- 654/654 tests passing.
- 1 critical bug (ledger TOCTOU race, corroborated by 2 independent
  reviewers) and 2 high-severity bugs (silent clear-to-null failure;
  dropdown truncation risking wrong-party reassignment) found and fixed —
  none caught by the initial implementation or its own unit tests, only by
  the independent review plus live re-verification.
- No open findings deferred — everything the review surfaced was either
  fixed or confirmed as a non-issue matching existing codebase convention.

Phase 45 is complete against its revised (founder-confirmed) scope: edit +
lump-sum print, no tax calculation, no line items.
