-- Phase 67 §9.1 — Clothing: size/color exchange workflow.
-- Set only on the replacement-item sale invoice, pointing back at the
-- invoiceType='RETURN' invoice created for the surrendered item.
ALTER TABLE "Invoice" ADD COLUMN "exchangeReturnId" TEXT;

CREATE INDEX "Invoice_exchangeReturnId_idx" ON "Invoice"("exchangeReturnId");
