ALTER TABLE "Invoice" ADD COLUMN "salespersonId" TEXT REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Invoice_salespersonId_idx" ON "Invoice"("salespersonId");
