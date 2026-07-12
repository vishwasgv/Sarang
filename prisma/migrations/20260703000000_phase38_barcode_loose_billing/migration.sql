-- Phase 38: Barcode System + Loose/Weight Billing
-- All changes additive: nullable columns or DEFAULT-bearing booleans, one new table.
-- No existing column renamed or dropped. Product.barcode's unique constraint pre-dates this migration.

-- AlterTable: Product — loose/weight billing config (opt-in, off by default) + barcode provenance
ALTER TABLE "Product" ADD COLUMN "sellByWeight" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "weightUnit" TEXT;
ALTER TABLE "Product" ADD COLUMN "pricePerWeightUnit" REAL;
ALTER TABLE "Product" ADD COLUMN "barcodeSource" TEXT;
ALTER TABLE "Product" ADD COLUMN "looseItemCode" INTEGER;
CREATE UNIQUE INDEX "Product_looseItemCode_key" ON "Product"("looseItemCode");
-- Tracks the price at the time a regular (non-weight) barcode label was last
-- printed, so updateProduct can warn when a price change makes a previously
-- printed shelf label stale — the charge is always correct (live lookup), only
-- the printed sticker text can go stale.
ALTER TABLE "Product" ADD COLUMN "lastLabelPrintedAt" DATETIME;
ALTER TABLE "Product" ADD COLUMN "lastLabelPrintedPrice" REAL;

-- AlterTable: InvoiceItem — snapshot the unit a line was billed in (null = normal pack sale)
ALTER TABLE "InvoiceItem" ADD COLUMN "weightUnit" TEXT;

-- CreateTable: LabelPrintLog — records the price baked into a weight-embedded label at print time,
-- so the POS can charge what's printed and warn staff if the product's price has since changed.
CREATE TABLE "LabelPrintLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "weightGrams" REAL NOT NULL,
    "pricePerWeightUnitAtPrint" REAL NOT NULL,
    "weightUnitAtPrint" TEXT NOT NULL,
    "printedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "printedBy" TEXT,
    CONSTRAINT "LabelPrintLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "LabelPrintLog_barcode_idx" ON "LabelPrintLog"("barcode");
CREATE INDEX "LabelPrintLog_productId_idx" ON "LabelPrintLog"("productId");
