-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RentalBooking" (
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
    "recurrenceIntervalDays" INTEGER,
    "parentBookingId" TEXT,
    "nextCycleGenerated" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "RentalBooking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RentalBooking_parentBookingId_fkey" FOREIGN KEY ("parentBookingId") REFERENCES "RentalBooking" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RentalBooking" ("bookingNumber", "cancelledAt", "checkedOutAt", "checkoutNotes", "createdAt", "createdById", "customerId", "damageChargeAmount", "endDateTime", "id", "invoiceId", "lateFeeAmount", "notes", "returnNotes", "returnedAt", "securityDepositCollected", "securityDepositRefunded", "startDateTime", "status", "updatedAt") SELECT "bookingNumber", "cancelledAt", "checkedOutAt", "checkoutNotes", "createdAt", "createdById", "customerId", "damageChargeAmount", "endDateTime", "id", "invoiceId", "lateFeeAmount", "notes", "returnNotes", "returnedAt", "securityDepositCollected", "securityDepositRefunded", "startDateTime", "status", "updatedAt" FROM "RentalBooking";
DROP TABLE "RentalBooking";
ALTER TABLE "new_RentalBooking" RENAME TO "RentalBooking";
CREATE UNIQUE INDEX "RentalBooking_bookingNumber_key" ON "RentalBooking"("bookingNumber");
CREATE INDEX "RentalBooking_customerId_idx" ON "RentalBooking"("customerId");
CREATE INDEX "RentalBooking_status_idx" ON "RentalBooking"("status");
CREATE INDEX "RentalBooking_startDateTime_endDateTime_idx" ON "RentalBooking"("startDateTime", "endDateTime");
CREATE INDEX "RentalBooking_parentBookingId_idx" ON "RentalBooking"("parentBookingId");
CREATE TABLE "new_RentalBookingItem" (
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
    "damageChargeAmount" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RentalBookingItem_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "RentalBooking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RentalBookingItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RentalBookingItem_rentalUnitId_fkey" FOREIGN KEY ("rentalUnitId") REFERENCES "RentalUnit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RentalBookingItem" ("bookingId", "conditionIn", "conditionOut", "createdAt", "id", "lineTotal", "productId", "quantity", "rateAmount", "rateBasis", "rentalUnitId") SELECT "bookingId", "conditionIn", "conditionOut", "createdAt", "id", "lineTotal", "productId", "quantity", "rateAmount", "rateBasis", "rentalUnitId" FROM "RentalBookingItem";
DROP TABLE "RentalBookingItem";
ALTER TABLE "new_RentalBookingItem" RENAME TO "RentalBookingItem";
CREATE INDEX "RentalBookingItem_bookingId_idx" ON "RentalBookingItem"("bookingId");
CREATE INDEX "RentalBookingItem_productId_idx" ON "RentalBookingItem"("productId");
CREATE INDEX "RentalBookingItem_rentalUnitId_idx" ON "RentalBookingItem"("rentalUnitId");
CREATE TABLE "new_RentalUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "unitLabel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "conditionNotes" TEXT,
    "purchaseDate" DATETIME,
    "unitCost" REAL NOT NULL DEFAULT 0,
    "serviceIntervalRentals" INTEGER,
    "serviceIntervalDays" INTEGER,
    "rentalCountSinceService" INTEGER NOT NULL DEFAULT 0,
    "lastServicedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RentalUnit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RentalUnit" ("conditionNotes", "createdAt", "id", "productId", "purchaseDate", "status", "unitCost", "unitLabel", "updatedAt") SELECT "conditionNotes", "createdAt", "id", "productId", "purchaseDate", "status", "unitCost", "unitLabel", "updatedAt" FROM "RentalUnit";
DROP TABLE "RentalUnit";
ALTER TABLE "new_RentalUnit" RENAME TO "RentalUnit";
CREATE INDEX "RentalUnit_productId_idx" ON "RentalUnit"("productId");
CREATE INDEX "RentalUnit_status_idx" ON "RentalUnit"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
