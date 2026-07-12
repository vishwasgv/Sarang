# Phase 45 — Credit Note & Debit Note Edit + Print: Technical Spec

## 0. Scope (confirmed with founder, 2026-07-07)

Original master-plan scope was print-only. Audit found neither service has an
`update` function at all (`create`/`list`/`getById`/`delete` only) — founder
confirmed the actual need is **edit + print**, explicitly **not** itemization
or tax breakdown (matches the schema reality: both models are flat
single-`amount` records with no line items and no tax fields at all). This
spec covers exactly that: add edit, add a lump-sum print template reusing
Phase 44's logo/watermark mechanism. No schema migration needed.

## 1. Audit findings (ground truth, 2026-07-07)

- `CreditNote`/`DebitNote` (`prisma/schema.prisma:1236-1274`): flat records,
  real FK to the original `Invoice`/`PurchaseOrder`, document-number
  generation already exists (`CN-00001`/`DN-00001`), no status/lifecycle
  field (nothing to gate editing behind).
- `credit-note.service.ts`/`debit-note.service.ts`: `create` posts a ledger
  entry (customer/supplier ledger respectively) affecting the party's
  outstanding balance; `delete` reverses it via an opposite entry (never
  mutates/deletes the original ledger row — append-only). **`update` must
  follow the same append-only reversal pattern**: if amount or
  customer/supplier changes, reverse the old ledger effect and apply a new
  one, exactly mirroring `delete`'s existing reversal logic.
- IPC handlers have zero validation (no Zod) on either domain today — a
  pre-existing gap. New `update` payload gets real Zod validation (matches
  the global "every payload validated with Zod" rule); not retrofitting the
  pre-existing `create` handler's validation, out of scope here.
- No print channel exists on either handler. Quotation's print convention
  (`quotation.handler.ts`): `requirePermission('billing.printInvoice')` →
  `getById()` → `businessProfile.findFirst()` → `printService.generateXHtml()`
  → write to temp file → hidden `BrowserWindow.loadFile()` →
  `webContents.print()` → cleanup. This is the pattern to mirror (not
  Challan's `window.open()`/`document.write()` popup style, which only
  exists because Challan needs no `BrowserWindow` print dialog integration
  the same way).
- **Permission gap for Debit Note print**: no `purchaseOrders.print`
  permission exists anywhere (Purchase Orders themselves have no print
  feature). Debit Note is gated everywhere else on `purchaseOrders.*`
  permissions (a purchasing-domain document) — reusing the billing-domain
  `billing.printInvoice` would be a semantic mismatch. **Decision**: add a
  new `purchaseOrders.print` permission, seeded and assigned to the same
  roles that already have `purchaseOrders.create`.

## 2. Design

### Service layer — `update()` added to both
```ts
// credit-note.service.ts
async update(id: string, payload: UpdateCreditNotePayload, userId: string) {
  // fetch existing; validate new invoiceId if provided/changed
  // if amount or customerId changed:
  //   reverse old ledger effect on OLD customerId (referenceType: 'CREDIT_NOTE_EDIT_REVERSAL')
  //   apply new ledger effect on NEW customerId (referenceType: 'CREDIT_NOTE', matching create)
  // update the row, include customer+invoice, audit log with old/new value
}
```
Same shape for `debitNoteService.update` using `supplierLedgerService` and
`'DEBIT_NOTE_EDIT_REVERSAL'`/`'DEBIT_NOTE'`. Reversal-then-reapply (not a
delta adjustment) matches the exact technique `delete()` already uses —
never mutate a posted ledger row, only ever append offsetting entries.

### Validation — new Zod schemas
`credit-note.validation.ts` / `debit-note.validation.ts`: update payload
schema (`reason`, `amount`, `notes`, `customerId`/`invoiceId` or
`supplierId`/`purchaseOrderId`, all optional/partial).

### IPC — new channels
- `creditNotes:update` (`billing.create`, matching create's permission),
  `creditNotes:print` (`billing.printInvoice`, matching Quotation).
- `debitNotes:update` (`purchaseOrders.create`, matching create's
  permission), `debitNotes:print` (new `purchaseOrders.print` permission).

### print.service.ts — two new generate functions
```ts
async generateCreditNoteHtml(cn: {
  creditNoteNumber: string; createdAt: string | Date; reason: string; amount: number
  notes?: string | null
  customer?: { customerName: string; phone?: string | null } | null
  invoice?: { invoiceNumber: string; invoiceDate: string | Date } | null
}, profile: BusinessProfile | null): Promise<string>
```
Mirrors `generateQuotationHtml`'s scaffolding exactly: logo + business header,
watermark via the existing `watermarkHtml()` helper (`<body
style="position:relative;z-index:0;">` — the Phase 44 stacking-context fix
applies here too, from day one, not bolted on later), document number/date,
customer box, a summary block (reason + amount, no items table — none
exists), a reference line to the original invoice number/date when present,
Aszurex footer. `generateDebitNoteHtml` is the same shape with
`supplier`/`purchaseOrder` in place of `customer`/`invoice`.

### Frontend — both screens get edit + print
- Reuse the existing create-form panel for edit: `editTarget` state, form
  pre-filled from the row, `handleSave()` branches `create` vs `update`
  based on whether `editTarget` is set — same UI, same fields, no new form
  needed.
- Add a `Printer` icon button (mirrors `QuotationsScreen.tsx`'s exact
  pattern) and an `Edit2`/pencil icon button per row.
- Both gated the same way the existing Delete button already is
  (`hasPermission`), even though the Quotation print-button precedent
  didn't bother with a frontend permission check — add it here since it's
  free and more correct, not because it's required to match the mirrored
  pattern exactly.

## 3. Test plan
- Unit tests: `update()` for both services — amount change correctly
  reverses old + applies new ledger entry (assert both ledger calls, exact
  amounts, exact referenceTypes); customer/supplier reassignment moves the
  ledger effect to the new party and zeroes out the old party's; a
  no-op update (only `reason`/`notes` changed) does NOT touch the ledger at
  all.
- `print.service.test.ts`: `generateCreditNoteHtml`/`generateDebitNoteHtml`
  render logo, watermark (reusing the exact assertions already proven
  correct for Quotation), and the reference-to-original-document line when
  present vs absent.

## 4. Non-goals (explicit)
- Itemization / tax breakdown — confirmed out of scope by founder.
- A status/lifecycle field (draft/finalized) — none exists, editing is
  unconditional (no "locked after print" concept requested).
- Retrofitting Zod validation onto the pre-existing `create`/`delete`
  handlers — only the new `update` payload gets validated.
