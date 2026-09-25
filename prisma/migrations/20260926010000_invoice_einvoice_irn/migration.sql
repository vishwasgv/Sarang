ALTER TABLE "Invoice" ADD COLUMN "irn" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "irnAckNo" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "irnAckDate" DATETIME;
ALTER TABLE "Invoice" ADD COLUMN "irnQr" TEXT;
CREATE INDEX "Invoice_irn_idx" ON "Invoice"("irn");
