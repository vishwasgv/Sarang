-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT,
    "sku" TEXT,
    "barcode" TEXT,
    "hsnCode" TEXT,
    "productName" TEXT NOT NULL,
    "description" TEXT,
    "productType" TEXT NOT NULL DEFAULT 'STANDARD',
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "costPrice" REAL NOT NULL DEFAULT 0,
    "sellingPrice" REAL NOT NULL,
    "mrp" REAL,
    "taxRate" REAL NOT NULL DEFAULT 0,
    "imagePath" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "gender" TEXT,
    "unavailableUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sellByWeight" BOOLEAN NOT NULL DEFAULT false,
    "weightUnit" TEXT,
    "pricePerWeightUnit" REAL,
    "sellByPack" BOOLEAN NOT NULL DEFAULT false,
    "packUnit" TEXT,
    "unitsPerPack" REAL,
    "barcodeSource" TEXT,
    "looseItemCode" INTEGER,
    "lastLabelPrintedAt" DATETIME,
    "lastLabelPrintedPrice" REAL,
    "isRentable" BOOLEAN NOT NULL DEFAULT false,
    "rentalTrackingType" TEXT,
    "rentalRates" TEXT NOT NULL DEFAULT '[]',
    "rentalSecurityDeposit" REAL,
    "metalType" TEXT,
    "purity" TEXT,
    "hallmarkNumber" TEXT,
    "grossWeight" REAL,
    "stoneWeight" REAL,
    "netWeight" REAL,
    "makingChargeType" TEXT,
    "makingChargeValue" REAL,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("barcode", "barcodeSource", "categoryId", "costPrice", "createdAt", "description", "gender", "grossWeight", "hallmarkNumber", "hsnCode", "id", "imagePath", "isActive", "isRentable", "lastLabelPrintedAt", "lastLabelPrintedPrice", "looseItemCode", "makingChargeType", "makingChargeValue", "metalType", "mrp", "netWeight", "pricePerWeightUnit", "productName", "productType", "purity", "rentalRates", "rentalSecurityDeposit", "rentalTrackingType", "sellByWeight", "sellingPrice", "sku", "stoneWeight", "taxRate", "unavailableUntil", "unit", "updatedAt", "weightUnit") SELECT "barcode", "barcodeSource", "categoryId", "costPrice", "createdAt", "description", "gender", "grossWeight", "hallmarkNumber", "hsnCode", "id", "imagePath", "isActive", "isRentable", "lastLabelPrintedAt", "lastLabelPrintedPrice", "looseItemCode", "makingChargeType", "makingChargeValue", "metalType", "mrp", "netWeight", "pricePerWeightUnit", "productName", "productType", "purity", "rentalRates", "rentalSecurityDeposit", "rentalTrackingType", "sellByWeight", "sellingPrice", "sku", "stoneWeight", "taxRate", "unavailableUntil", "unit", "updatedAt", "weightUnit" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");
CREATE UNIQUE INDEX "Product_looseItemCode_key" ON "Product"("looseItemCode");
CREATE INDEX "Product_productName_idx" ON "Product"("productName");
CREATE INDEX "Product_isActive_idx" ON "Product"("isActive");
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

