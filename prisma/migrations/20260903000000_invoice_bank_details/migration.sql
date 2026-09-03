-- 2026-09-03 — Bank Details on the printed invoice (InvoiceTemplateConfig.
-- showBankDetails), alongside the existing UPI QR payment option. All
-- nullable, no default needed — no existing install prints an empty block,
-- and the print template only renders this section when at least an
-- account number or bank name is present.

-- AlterTable
ALTER TABLE "BusinessProfile" ADD COLUMN "bankAccountName" TEXT;
ALTER TABLE "BusinessProfile" ADD COLUMN "bankAccountNumber" TEXT;
ALTER TABLE "BusinessProfile" ADD COLUMN "bankName" TEXT;
ALTER TABLE "BusinessProfile" ADD COLUMN "bankBranch" TEXT;
ALTER TABLE "BusinessProfile" ADD COLUMN "bankIfscCode" TEXT;
