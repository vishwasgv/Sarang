ALTER TABLE "RetainerAgreement" ADD COLUMN "pricesIncludeTax" BOOLEAN;
ALTER TABLE "QuotationItem" ADD COLUMN "hsnCode" TEXT;
ALTER TABLE "SalesOrderItem" ADD COLUMN "hsnCode" TEXT;
ALTER TABLE "CreditNote" ADD COLUMN "taxApplied" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CreditNote" ADD COLUMN "taxRate" REAL;
ALTER TABLE "CreditNote" ADD COLUMN "taxAmount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "DebitNote" ADD COLUMN "taxApplied" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "DebitNote" ADD COLUMN "taxRate" REAL;
ALTER TABLE "DebitNote" ADD COLUMN "taxAmount" REAL NOT NULL DEFAULT 0;

UPDATE "CreditNote" SET "taxAmount" = COALESCE((SELECT SUM("taxAmount") FROM "CreditNoteItem" WHERE "CreditNoteItem"."creditNoteId" = "CreditNote"."id"), 0);
UPDATE "CreditNote" SET "taxApplied" = CASE WHEN "taxAmount" > 0 THEN 1 ELSE 0 END;
UPDATE "DebitNote" SET "taxAmount" = COALESCE((SELECT SUM("taxAmount") FROM "DebitNoteItem" WHERE "DebitNoteItem"."debitNoteId" = "DebitNote"."id"), 0);
UPDATE "DebitNote" SET "taxApplied" = CASE WHEN "taxAmount" > 0 THEN 1 ELSE 0 END;
