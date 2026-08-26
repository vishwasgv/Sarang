-- Phase 68 §9.1 — Pest Control item 4: recurring contract value trend. Set
-- only on the recurring-fee invoice generateContractInvoice() creates for a
-- PestServiceContract, so the trend report can query real billed history.

ALTER TABLE "Invoice" ADD COLUMN "pestContractId" TEXT;
CREATE INDEX "Invoice_pestContractId_idx" ON "Invoice"("pestContractId");
