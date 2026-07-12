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
    CONSTRAINT "RentalBooking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RentalBooking" ("bookingNumber", "cancelledAt", "checkedOutAt", "checkoutNotes", "createdAt", "createdById", "customerId", "damageChargeAmount", "endDateTime", "id", "invoiceId", "lateFeeAmount", "notes", "returnNotes", "returnedAt", "securityDepositCollected", "securityDepositRefunded", "startDateTime", "status", "updatedAt") SELECT "bookingNumber", "cancelledAt", "checkedOutAt", "checkoutNotes", "createdAt", "createdById", "customerId", "damageChargeAmount", "endDateTime", "id", "invoiceId", "lateFeeAmount", "notes", "returnNotes", "returnedAt", "securityDepositCollected", "securityDepositRefunded", "startDateTime", "status", "updatedAt" FROM "RentalBooking";
DROP TABLE "RentalBooking";
ALTER TABLE "new_RentalBooking" RENAME TO "RentalBooking";
CREATE UNIQUE INDEX "RentalBooking_bookingNumber_key" ON "RentalBooking"("bookingNumber");
CREATE INDEX "RentalBooking_customerId_idx" ON "RentalBooking"("customerId");
CREATE INDEX "RentalBooking_status_idx" ON "RentalBooking"("status");
CREATE INDEX "RentalBooking_startDateTime_endDateTime_idx" ON "RentalBooking"("startDateTime", "endDateTime");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
