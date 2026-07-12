-- CreateTable
CREATE TABLE "HotelRoom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomNumber" TEXT NOT NULL,
    "roomType" TEXT NOT NULL,
    "floor" TEXT,
    "maxOccupancy" INTEGER NOT NULL DEFAULT 2,
    "baseRate" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "amenities" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HotelBooking" (
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
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
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

-- CreateTable
CREATE TABLE "HotelGuestId" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "idType" TEXT NOT NULL,
    "idNumber" TEXT NOT NULL,
    "nationality" TEXT NOT NULL DEFAULT 'IN',
    "address" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HotelGuestId_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "HotelBooking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HotelExtraCharge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 1,
    "unitPrice" REAL NOT NULL,
    "amount" REAL NOT NULL,
    "chargeDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HotelExtraCharge_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "HotelBooking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "HotelRoom_roomNumber_key" ON "HotelRoom"("roomNumber");

-- CreateIndex
CREATE INDEX "HotelRoom_status_idx" ON "HotelRoom"("status");

-- CreateIndex
CREATE UNIQUE INDEX "HotelBooking_bookingNumber_key" ON "HotelBooking"("bookingNumber");

-- CreateIndex
CREATE INDEX "HotelBooking_roomId_idx" ON "HotelBooking"("roomId");

-- CreateIndex
CREATE INDEX "HotelBooking_status_idx" ON "HotelBooking"("status");

-- CreateIndex
CREATE INDEX "HotelBooking_checkInDate_checkOutDate_idx" ON "HotelBooking"("checkInDate", "checkOutDate");

-- CreateIndex
CREATE INDEX "HotelBooking_customerId_idx" ON "HotelBooking"("customerId");

-- CreateIndex
CREATE INDEX "HotelGuestId_bookingId_idx" ON "HotelGuestId"("bookingId");

-- CreateIndex
CREATE INDEX "HotelExtraCharge_bookingId_idx" ON "HotelExtraCharge"("bookingId");

