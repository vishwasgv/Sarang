-- CreateTable
CREATE TABLE "RentalUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "unitLabel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "conditionNotes" TEXT,
    "purchaseDate" DATETIME,
    "unitCost" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RentalUnit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RentalBooking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "startDateTime" DATETIME NOT NULL,
    "endDateTime" DATETIME NOT NULL,
    "securityDepositCollected" REAL NOT NULL DEFAULT 0,
    "securityDepositRefunded" REAL,
    "lateFeeAmount" REAL NOT NULL DEFAULT 0,
    "damageChargeAmount" REAL NOT NULL DEFAULT 0,
    "checkoutNotes" TEXT,
    "returnNotes" TEXT,
    "checkedOutAt" DATETIME,
    "returnedAt" DATETIME,
    "cancelledAt" DATETIME,
    "invoiceId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RentalBooking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RentalBooking_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RentalBookingItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "rentalUnitId" TEXT,
    "quantity" REAL NOT NULL DEFAULT 1,
    "rateBasis" TEXT NOT NULL,
    "rateAmount" REAL NOT NULL,
    "lineTotal" REAL NOT NULL,
    "conditionOut" TEXT,
    "conditionIn" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RentalBookingItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "RentalBooking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RentalBookingItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RentalBookingItem_rentalUnitId_fkey" FOREIGN KEY ("rentalUnitId") REFERENCES "RentalUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

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
    "taxRate" REAL NOT NULL DEFAULT 0,
    "imagePath" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "gender" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "sellByWeight" BOOLEAN NOT NULL DEFAULT false,
    "weightUnit" TEXT,
    "pricePerWeightUnit" REAL,
    "barcodeSource" TEXT,
    "looseItemCode" INTEGER,
    "lastLabelPrintedAt" DATETIME,
    "lastLabelPrintedPrice" REAL,
    "isRentable" BOOLEAN NOT NULL DEFAULT false,
    "rentalTrackingType" TEXT,
    "rentalRates" TEXT NOT NULL DEFAULT '[]',
    "rentalSecurityDeposit" REAL,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("barcode", "barcodeSource", "categoryId", "costPrice", "createdAt", "description", "gender", "hsnCode", "id", "imagePath", "isActive", "lastLabelPrintedAt", "lastLabelPrintedPrice", "looseItemCode", "pricePerWeightUnit", "productName", "productType", "sellByWeight", "sellingPrice", "sku", "taxRate", "unit", "updatedAt", "weightUnit") SELECT "barcode", "barcodeSource", "categoryId", "costPrice", "createdAt", "description", "gender", "hsnCode", "id", "imagePath", "isActive", "lastLabelPrintedAt", "lastLabelPrintedPrice", "looseItemCode", "pricePerWeightUnit", "productName", "productType", "sellByWeight", "sellingPrice", "sku", "taxRate", "unit", "updatedAt", "weightUnit" FROM "Product";
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

-- CreateIndex
CREATE INDEX "RentalUnit_productId_idx" ON "RentalUnit"("productId");

-- CreateIndex
CREATE INDEX "RentalUnit_status_idx" ON "RentalUnit"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RentalBooking_bookingNumber_key" ON "RentalBooking"("bookingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RentalBooking_invoiceId_key" ON "RentalBooking"("invoiceId");

-- CreateIndex
CREATE INDEX "RentalBooking_customerId_idx" ON "RentalBooking"("customerId");

-- CreateIndex
CREATE INDEX "RentalBooking_status_idx" ON "RentalBooking"("status");

-- CreateIndex
CREATE INDEX "RentalBooking_startDateTime_endDateTime_idx" ON "RentalBooking"("startDateTime", "endDateTime");

-- CreateIndex
CREATE INDEX "RentalBookingItem_bookingId_idx" ON "RentalBookingItem"("bookingId");

-- CreateIndex
CREATE INDEX "RentalBookingItem_productId_idx" ON "RentalBookingItem"("productId");

-- CreateIndex
CREATE INDEX "RentalBookingItem_rentalUnitId_idx" ON "RentalBookingItem"("rentalUnitId");
