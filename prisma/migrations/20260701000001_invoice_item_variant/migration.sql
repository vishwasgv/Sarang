-- Phase 2 fix: store variant selection on invoice line items for accurate size/colour tracking
ALTER TABLE "InvoiceItem" ADD COLUMN "variantId" TEXT;
ALTER TABLE "InvoiceItem" ADD COLUMN "variantInfo" TEXT;
