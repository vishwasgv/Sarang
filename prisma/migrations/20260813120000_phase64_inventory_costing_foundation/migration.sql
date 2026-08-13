-- AlterTable
ALTER TABLE "GRNItem" ADD COLUMN "purchaseUnitQty" REAL;

-- CreateTable
CREATE TABLE "KitComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kitProductId" TEXT NOT NULL,
    "componentProductId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    CONSTRAINT "KitComponent_kitProductId_fkey" FOREIGN KEY ("kitProductId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KitComponent_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LocationStock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LocationStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LocationStock_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LandedCostAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseOrderId" TEXT,
    "billId" TEXT,
    "costType" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "allocationMethod" TEXT NOT NULL DEFAULT 'BY_VALUE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LandedCostAllocation_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LandedCostAllocation_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductionLaborEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productionOrderId" TEXT NOT NULL,
    "workerName" TEXT NOT NULL,
    "hoursWorked" REAL NOT NULL,
    "ratePerHour" REAL NOT NULL,
    "amount" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductionLaborEntry_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BusinessProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessName" TEXT NOT NULL,
    "businessType" TEXT NOT NULL,
    "businessCategory" TEXT NOT NULL DEFAULT 'PRODUCT',
    "serviceTemplateType" TEXT,
    "clinicSpecialty" TEXT,
    "languageLock" TEXT NOT NULL DEFAULT 'multi',
    "ownerName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'IN',
    "postalCode" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'INR',
    "currencySymbol" TEXT NOT NULL DEFAULT '₹',
    "taxModel" TEXT NOT NULL DEFAULT 'GST',
    "taxNumber" TEXT,
    "drugLicenseNumber" TEXT,
    "upiId" TEXT,
    "website" TEXT,
    "logoPath" TEXT,
    "showLogoOnDashboard" BOOLEAN NOT NULL DEFAULT false,
    "enableDocumentWatermark" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "lockDate" DATETIME,
    "gstScheme" TEXT NOT NULL DEFAULT 'REGULAR',
    "creditInterestEnabled" BOOLEAN NOT NULL DEFAULT false,
    "creditInterestRatePercent" REAL NOT NULL DEFAULT 0,
    "creditInterestType" TEXT NOT NULL DEFAULT 'SIMPLE',
    "defaultInvoiceTemplateId" TEXT,
    "overheadAllocationBasis" TEXT,
    "overheadAllocationRate" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BusinessProfile" ("address", "businessCategory", "businessName", "businessType", "city", "clinicSpecialty", "country", "createdAt", "creditInterestEnabled", "creditInterestRatePercent", "creditInterestType", "currencyCode", "currencySymbol", "defaultInvoiceTemplateId", "drugLicenseNumber", "email", "enableDocumentWatermark", "gstScheme", "id", "languageLock", "lockDate", "logoPath", "ownerName", "phone", "postalCode", "serviceTemplateType", "showLogoOnDashboard", "state", "taxModel", "taxNumber", "timezone", "updatedAt", "upiId", "website") SELECT "address", "businessCategory", "businessName", "businessType", "city", "clinicSpecialty", "country", "createdAt", "creditInterestEnabled", "creditInterestRatePercent", "creditInterestType", "currencyCode", "currencySymbol", "defaultInvoiceTemplateId", "drugLicenseNumber", "email", "enableDocumentWatermark", "gstScheme", "id", "languageLock", "lockDate", "logoPath", "ownerName", "phone", "postalCode", "serviceTemplateType", "showLogoOnDashboard", "state", "taxModel", "taxNumber", "timezone", "updatedAt", "upiId", "website" FROM "BusinessProfile";
DROP TABLE "BusinessProfile";
ALTER TABLE "new_BusinessProfile" RENAME TO "BusinessProfile";
CREATE TABLE "new_InventoryMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "movementType" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "remarks" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locationId" TEXT,
    CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryMovement_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_InventoryMovement" ("createdAt", "createdById", "id", "movementType", "productId", "quantity", "referenceId", "referenceType", "remarks") SELECT "createdAt", "createdById", "id", "movementType", "productId", "quantity", "referenceId", "referenceType", "remarks" FROM "InventoryMovement";
DROP TABLE "InventoryMovement";
ALTER TABLE "new_InventoryMovement" RENAME TO "InventoryMovement";
CREATE INDEX "InventoryMovement_productId_idx" ON "InventoryMovement"("productId");
CREATE INDEX "InventoryMovement_movementType_idx" ON "InventoryMovement"("movementType");
CREATE INDEX "InventoryMovement_createdAt_idx" ON "InventoryMovement"("createdAt");
CREATE INDEX "InventoryMovement_locationId_idx" ON "InventoryMovement"("locationId");
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
    "isPrescriptionRequired" BOOLEAN NOT NULL DEFAULT false,
    "defaultSupplierId" TEXT,
    "expiryAlertLeadDays" INTEGER,
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
    "valuationMethod" TEXT NOT NULL DEFAULT 'WEIGHTED_AVERAGE',
    "standardCost" REAL,
    "isKit" BOOLEAN NOT NULL DEFAULT false,
    "floatingUnitConversion" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Product_defaultSupplierId_fkey" FOREIGN KEY ("defaultSupplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("barcode", "barcodeSource", "categoryId", "costPrice", "createdAt", "defaultSupplierId", "description", "expiryAlertLeadDays", "gender", "grossWeight", "hallmarkNumber", "hsnCode", "id", "imagePath", "isActive", "isPrescriptionRequired", "isRentable", "lastLabelPrintedAt", "lastLabelPrintedPrice", "looseItemCode", "makingChargeType", "makingChargeValue", "metalType", "mrp", "netWeight", "packUnit", "pricePerWeightUnit", "productName", "productType", "purity", "rentalRates", "rentalSecurityDeposit", "rentalTrackingType", "sellByPack", "sellByWeight", "sellingPrice", "sku", "stoneWeight", "taxRate", "unavailableUntil", "unit", "unitsPerPack", "updatedAt", "weightUnit") SELECT "barcode", "barcodeSource", "categoryId", "costPrice", "createdAt", "defaultSupplierId", "description", "expiryAlertLeadDays", "gender", "grossWeight", "hallmarkNumber", "hsnCode", "id", "imagePath", "isActive", "isPrescriptionRequired", "isRentable", "lastLabelPrintedAt", "lastLabelPrintedPrice", "looseItemCode", "makingChargeType", "makingChargeValue", "metalType", "mrp", "netWeight", "packUnit", "pricePerWeightUnit", "productName", "productType", "purity", "rentalRates", "rentalSecurityDeposit", "rentalTrackingType", "sellByPack", "sellByWeight", "sellingPrice", "sku", "stoneWeight", "taxRate", "unavailableUntil", "unit", "unitsPerPack", "updatedAt", "weightUnit" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");
CREATE UNIQUE INDEX "Product_looseItemCode_key" ON "Product"("looseItemCode");
CREATE INDEX "Product_productName_idx" ON "Product"("productName");
CREATE INDEX "Product_isActive_idx" ON "Product"("isActive");
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX "Product_defaultSupplierId_idx" ON "Product"("defaultSupplierId");
CREATE TABLE "new_ProductionOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "plannedQty" REAL NOT NULL,
    "producedQty" REAL NOT NULL DEFAULT 0,
    "scrapQty" REAL NOT NULL DEFAULT 0,
    "laborCost" REAL NOT NULL DEFAULT 0,
    "overheadCost" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startDate" DATETIME,
    "completedDate" DATETIME,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductionOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductionOrder_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "BillOfMaterial" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ProductionOrder" ("bomId", "completedDate", "createdAt", "createdById", "id", "laborCost", "notes", "orderNumber", "plannedQty", "producedQty", "productId", "scrapQty", "startDate", "status", "updatedAt") SELECT "bomId", "completedDate", "createdAt", "createdById", "id", "laborCost", "notes", "orderNumber", "plannedQty", "producedQty", "productId", "scrapQty", "startDate", "status", "updatedAt" FROM "ProductionOrder";
DROP TABLE "ProductionOrder";
ALTER TABLE "new_ProductionOrder" RENAME TO "ProductionOrder";
CREATE UNIQUE INDEX "ProductionOrder_orderNumber_key" ON "ProductionOrder"("orderNumber");
CREATE INDEX "ProductionOrder_status_idx" ON "ProductionOrder"("status");
CREATE INDEX "ProductionOrder_productId_idx" ON "ProductionOrder"("productId");
CREATE INDEX "ProductionOrder_createdAt_idx" ON "ProductionOrder"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "KitComponent_kitProductId_idx" ON "KitComponent"("kitProductId");

-- CreateIndex
CREATE INDEX "KitComponent_componentProductId_idx" ON "KitComponent"("componentProductId");

-- CreateIndex
CREATE INDEX "Location_isActive_idx" ON "Location"("isActive");

-- CreateIndex
CREATE INDEX "LocationStock_locationId_idx" ON "LocationStock"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "LocationStock_productId_locationId_key" ON "LocationStock"("productId", "locationId");

-- CreateIndex
CREATE INDEX "LandedCostAllocation_purchaseOrderId_idx" ON "LandedCostAllocation"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "LandedCostAllocation_billId_idx" ON "LandedCostAllocation"("billId");

-- CreateIndex
CREATE INDEX "ProductionLaborEntry_productionOrderId_idx" ON "ProductionLaborEntry"("productionOrderId");
