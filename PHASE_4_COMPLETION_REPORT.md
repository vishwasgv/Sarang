# PHASE 4 COMPLETION REPORT — Billing Engine

**Date:** 2026-06-19 (reconstructed — report was not written at time of completion)
**Status:** COMPLETE ✅
**TypeScript Errors:** 0

---

## What Was Built

### Backend Services

| File | Description |
|---|---|
| `src/main/services/billing.service.ts` | Fully atomic invoice engine — create, get, list, cancel (RULE B001–B010) |
| `src/main/services/payment.service.ts` | Payment recording (Cash/UPI/Card/Wallet/Credit/Split), reversal, list |
| `src/main/services/customer-ledger.service.ts` | Customer ledger — debit on credit invoice, credit on payment, reverse on cancel |
| `src/main/services/print.service.ts` | A4 and 80mm thermal print templates with HTML generation |
| `src/main/validation/billing.validation.ts` | Zod schemas: CreateInvoicePayload, CancelInvoicePayload |
| `src/main/validation/payment.validation.ts` | Zod schemas: RecordPaymentPayload, ReversePaymentPayload |

### IPC Handlers (in `src/main/ipc/index.ts`)

| Channel | Permission |
|---|---|
| `billing:createInvoice` | `billing.createInvoice` |
| `billing:getInvoice` | `billing.view` |
| `billing:listInvoices` | `billing.view` |
| `billing:cancelInvoice` | `billing.cancel` |
| `billing:generateInvoiceNumber` | `billing.view` |
| `payments:record` | `billing.recordPayment` |
| `payments:reverse` | `billing.recordPayment` |
| `payments:list` | `billing.view` |
| `print:invoice` | `billing.view` |
| `print:receipt` | `billing.view` |

### UI Screens

| File | Description |
|---|---|
| `src/renderer/src/modules/billing/ui/BillingScreen.tsx` | Main billing screen — product search, line items, discount, tax, total, UPI QR |
| `src/renderer/src/modules/billing/ui/InvoiceListScreen.tsx` | Invoice list — filter by status/customer/date, search, pagination |
| `src/renderer/src/modules/billing/ui/InvoiceDetailScreen.tsx` | Invoice detail — items, payments, cancel, print/receipt actions |
| `src/renderer/src/modules/billing/ui/PaymentHistoryScreen.tsx` | Payment history — filter, reverse payment action |

---

## Business Rules Enforced

| Rule | Description | How |
|---|---|---|
| RULE B001–B010 | Fully atomic invoice transaction | All operations inside single `db.$transaction()` |
| RULE B003 | Quantity > 0 | Zod validates, double-checked in service |
| RULE B004 | Unit price ≥ 0 | Service guard → B-004 error |
| RULE B005 | Invoice total cannot be negative | Post-calculation guard → B-005 error |
| RULE B006 | Customer required for CREDIT sales | Service guard → B-006 error |
| RULE B007 | Inventory deducted on save, same transaction | `inventoryService.reduceStockTx()` called inside invoice `$transaction` |
| RULE B008 | Customer ledger updated on CREDIT, same transaction | `customerLedgerService.addEntry()` called inside invoice `$transaction` |
| RULE B009 | Payment recorded on direct payment, same transaction | `tx.payment.create()` inside invoice `$transaction` for non-CREDIT/SPLIT |
| RULE B010 | Cancelled invoices remain visible | Soft cancel only — status = CANCELLED, not deleted |
| RULE PM005 | Never verify payments | UPI QR is generated only; no payment verification endpoint |

---

## Tax Calculation Logic

Tax is computed per line item using the effective tax rate (item-level override → product default → 0):

```
lineDiscount = item.discountAmount
lineTaxable = (quantity × unitPrice) − lineDiscount
lineTax = lineTaxable × (taxRate / 100)
lineTotal = lineTaxable + lineTax
```

Invoice totals:
```
subtotal = Σ(quantity × unitPrice)
discountAmount = Σ(lineDiscounts) + globalDiscount
taxAmount = Σ(lineTax)
rawTotal = subtotal − discountAmount + taxAmount
roundingAmount = Math.round(rawTotal) − rawTotal   ← rounds to whole unit
totalAmount = rawTotal + roundingAmount
```

---

## Payment Methods Supported

| Method | Behavior |
|---|---|
| CASH | Payment recorded immediately in same transaction |
| UPI | Payment recorded; QR displayed for customer to scan |
| CARD | Payment recorded immediately |
| WALLET | Payment recorded immediately |
| CREDIT | Invoice stays UNPAID; customer ledger debited; customer required |
| SPLIT | Invoice stays UNPAID; cashier records each method separately via `payments:record` |

---

## UPI QR Generation

- Standard URI format: `upi://pay?pa={upiId}&pn={businessName}&am={amount}&tn={invoiceNumber}`
- Generated client-side from business profile's `upiId` field
- **Never verified** — Sarang records intent, not confirmation (RULE PM005)

---

## Print Templates (`print.service.ts`)

| Template | Format | Contents |
|---|---|---|
| A4 Invoice | A4 HTML/PDF | Business header, logo, items table, tax breakdown, payment method, footer |
| 80mm Thermal | 80mm HTML | Compact receipt for thermal printers — items, totals, UPI QR, Aszurex footer |

---

## Invoice Cancellation — Ledger Reversal Logic

On cancel, only ledger entries that actually exist are reversed (prevents phantom reversals for cash sales with a customer attached but no ledger entry):

1. Query existing `CustomerLedger` entries matching `INVOICE` or `PAYMENT` referenceId
2. For each found entry: swap debit/credit to exactly offset it
3. Mark all non-reversed payments as `isReversed: true`
4. Restore inventory for all STANDARD product line items
5. Soft-cancel invoice — status = CANCELLED, balance = 0, paidAmount = 0

---

## Quality Gates

- ✅ Invoice total matches sum of line items (taxes, discounts correct)
- ✅ Inventory deducted exactly when invoice saved — in same transaction (RULE B007)
- ✅ Full rollback if any step fails — all in `db.$transaction()`
- ✅ Cancelled invoices remain visible — soft cancel only (RULE B010)
- ✅ Payment amount > 0 enforced via Zod
- ✅ Permission check: Cashier can create invoice, Staff cannot (`billing.createInvoice` permission)
- ✅ Negative inventory checked before invoice commit
- ✅ Service-type products skip inventory deduction
- ✅ Archived products rejected at invoice creation (PRD-005)
- ✅ UPI QR — generate only, never verify (RULE PM005)
- ✅ All IPC handlers guarded with `requirePermission()`
- ✅ Audit logs on: INVOICE_CREATED, INVOICE_CANCELLED, PAYMENT_RECORDED, PAYMENT_REVERSED

---

## Database Tables Used

- `Invoice` — invoiceNumber, status (ACTIVE/CANCELLED), paymentStatus (PAID/UNPAID/PARTIAL/CANCELLED)
- `InvoiceItem` — lineTotal, taxRate, taxAmount, discountAmount per line
- `Payment` — method, amount, isReversed, referenceNumber
- `CustomerLedger` — debitAmount/creditAmount; balance = Σdebit − Σcredit
- `InventoryMovement` — SALE movement per invoice, ADJUSTMENT on cancel

---

## Powered by Aszurex
