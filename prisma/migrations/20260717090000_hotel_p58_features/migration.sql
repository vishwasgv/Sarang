-- AlterTable
ALTER TABLE "HotelRoom" ADD COLUMN "dayUseRate" REAL;

-- CreateTable
CREATE TABLE "HotelRateCalendar" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomType" TEXT NOT NULL DEFAULT '',
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "rate" REAL NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HotelHousekeepingTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "bookingId" TEXT,
    "taskLabel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "assignedToId" TEXT,
    "completedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HotelHousekeepingTask_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HotelRoom" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "HotelHousekeepingTask_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "HotelBooking" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "HotelHousekeepingTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HotelBooking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingNumber" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "customerId" TEXT,
    "guestName" TEXT NOT NULL,
    "guestPhone" TEXT,
    "guestEmail" TEXT,
    "numberOfGuests" INTEGER NOT NULL DEFAULT 1,
    "checkInDate" DATETIME NOT NULL,
    "checkOutDate" DATETIME NOT NULL,
    "actualCheckInAt" DATETIME,
    "actualCheckOutAt" DATETIME,
    "ratePerNight" REAL NOT NULL,
    "roomChargeTotal" REAL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "channel" TEXT NOT NULL DEFAULT 'WALK_IN',
    "bookingType" TEXT NOT NULL DEFAULT 'OVERNIGHT',
    "advanceAmount" REAL NOT NULL DEFAULT 0,
    "advancePaymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "cancelReason" TEXT,
    "notes" TEXT,
    "invoiceId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HotelBooking_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HotelRoom" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HotelBooking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_HotelBooking" ("actualCheckInAt", "actualCheckOutAt", "advanceAmount", "advancePaymentMethod", "bookingNumber", "cancelReason", "checkInDate", "checkOutDate", "createdAt", "createdById", "customerId", "guestEmail", "guestName", "guestPhone", "id", "invoiceId", "notes", "numberOfGuests", "ratePerNight", "roomId", "status", "updatedAt") SELECT "actualCheckInAt", "actualCheckOutAt", "advanceAmount", "advancePaymentMethod", "bookingNumber", "cancelReason", "checkInDate", "checkOutDate", "createdAt", "createdById", "customerId", "guestEmail", "guestName", "guestPhone", "id", "invoiceId", "notes", "numberOfGuests", "ratePerNight", "roomId", "status", "updatedAt" FROM "HotelBooking";
DROP TABLE "HotelBooking";
ALTER TABLE "new_HotelBooking" RENAME TO "HotelBooking";
CREATE UNIQUE INDEX "HotelBooking_bookingNumber_key" ON "HotelBooking"("bookingNumber");
CREATE INDEX "HotelBooking_roomId_idx" ON "HotelBooking"("roomId");
CREATE INDEX "HotelBooking_status_idx" ON "HotelBooking"("status");
CREATE INDEX "HotelBooking_checkInDate_checkOutDate_idx" ON "HotelBooking"("checkInDate", "checkOutDate");
CREATE INDEX "HotelBooking_customerId_idx" ON "HotelBooking"("customerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "HotelRateCalendar_roomType_idx" ON "HotelRateCalendar"("roomType");

-- CreateIndex
CREATE INDEX "HotelRateCalendar_startDate_endDate_idx" ON "HotelRateCalendar"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "HotelHousekeepingTask_roomId_idx" ON "HotelHousekeepingTask"("roomId");

-- CreateIndex
CREATE INDEX "HotelHousekeepingTask_status_idx" ON "HotelHousekeepingTask"("status");

-- CreateIndex
CREATE INDEX "HotelHousekeepingTask_assignedToId_idx" ON "HotelHousekeepingTask"("assignedToId");
