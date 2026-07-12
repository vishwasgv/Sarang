-- Phase 2: Industry Expansion
-- Adds ProductVariant, ProductBatch, ProductSerial tables

-- Clothing / Footwear variants (size × colour per product)
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "size" TEXT,
    "color" TEXT,
    "sku" TEXT,
    "barcode" TEXT,
    "additionalPrice" REAL NOT NULL DEFAULT 0,
    "stockQty" REAL NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");
CREATE UNIQUE INDEX "ProductVariant_barcode_key" ON "ProductVariant"("barcode");
CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant"("productId");
CREATE INDEX "ProductVariant_isActive_idx" ON "ProductVariant"("isActive");

-- Pharmacy batch tracking (batch number + expiry date)
CREATE TABLE "ProductBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "mfgDate" DATETIME,
    "expiryDate" DATETIME NOT NULL,
    "quantityReceived" REAL NOT NULL DEFAULT 0,
    "quantityRemaining" REAL NOT NULL DEFAULT 0,
    "unitCost" REAL NOT NULL DEFAULT 0,
    "supplierId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductBatch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProductBatch_productId_batchNumber_key" ON "ProductBatch"("productId", "batchNumber");
CREATE INDEX "ProductBatch_productId_idx" ON "ProductBatch"("productId");
CREATE INDEX "ProductBatch_expiryDate_idx" ON "ProductBatch"("expiryDate");
CREATE INDEX "ProductBatch_isActive_idx" ON "ProductBatch"("isActive");

-- Electronics / Mobile serial number and IMEI tracking
CREATE TABLE "ProductSerial" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "imeiNumber" TEXT,
    "imei2Number" TEXT,
    "warrantyMonths" INTEGER,
    "warrantyExpiryDate" DATETIME,
    "purchaseDate" DATETIME,
    "unitCost" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "invoiceId" TEXT,
    "soldDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductSerial_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ProductSerial_serialNumber_key" ON "ProductSerial"("serialNumber");
CREATE UNIQUE INDEX "ProductSerial_imeiNumber_key" ON "ProductSerial"("imeiNumber");
CREATE INDEX "ProductSerial_productId_idx" ON "ProductSerial"("productId");
CREATE INDEX "ProductSerial_status_idx" ON "ProductSerial"("status");
CREATE INDEX "ProductSerial_imeiNumber_idx" ON "ProductSerial"("imeiNumber");
