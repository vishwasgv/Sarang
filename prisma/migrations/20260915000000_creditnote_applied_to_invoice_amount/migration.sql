-- 2026-09-15 — real bug fix: credit-note update()/delete() used to reverse
-- a linked invoice's balanceAmount using the credit note's full `amount`,
-- not the amount actually applied to that invoice at creation time (which
-- create() itself caps at the invoice's balance then) — silently
-- over-restoring the invoice balance whenever `amount` exceeded that cap.
-- This column persists the actually-applied figure so the reversal uses
-- the correct one. Null for existing rows (backfilled by application code
-- reading `amount` as a fallback where the linked invoice is still around;
-- rows with no invoiceId are unaffected either way).

-- AlterTable
ALTER TABLE "CreditNote" ADD COLUMN "appliedToInvoiceAmount" REAL;
