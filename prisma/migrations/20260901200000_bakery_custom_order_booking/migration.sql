-- 2026-09 §12 — Bakery/Sweet Shop/Catering vertical: custom order booking,
-- a direct structural mirror of FurnitureBooking/FurnitureBookingItem.

CREATE TABLE "CustomOrderBooking" (
    "id"                   TEXT NOT NULL PRIMARY KEY,
    "bookingNumber"        TEXT NOT NULL,
    "customerId"           TEXT NOT NULL,
    "dueDate"              DATETIME,
    "deliveryAddress"      TEXT,
    "advanceAmount"        REAL NOT NULL DEFAULT 0,
    "advancePaymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "status"               TEXT NOT NULL DEFAULT 'BOOKED',
    "invoiceId"            TEXT,
    "notes"                TEXT,
    "createdById"          TEXT,
    "createdAt"            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            DATETIME NOT NULL,
    CONSTRAINT "CustomOrderBooking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CustomOrderBooking_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CustomOrderBooking_bookingNumber_key" ON "CustomOrderBooking"("bookingNumber");
CREATE INDEX "CustomOrderBooking_customerId_idx" ON "CustomOrderBooking"("customerId");
CREATE INDEX "CustomOrderBooking_status_idx" ON "CustomOrderBooking"("status");
CREATE INDEX "CustomOrderBooking_dueDate_idx" ON "CustomOrderBooking"("dueDate");

CREATE TABLE "CustomOrderBookingItem" (
    "id"                   TEXT NOT NULL PRIMARY KEY,
    "customOrderBookingId" TEXT NOT NULL,
    "productId"            TEXT NOT NULL,
    "quantity"             REAL NOT NULL,
    "unitPrice"            REAL NOT NULL,
    "customFlavor"         TEXT,
    "customSize"           TEXT,
    "customMessage"        TEXT,
    "customDesign"         TEXT,
    CONSTRAINT "CustomOrderBookingItem_customOrderBookingId_fkey" FOREIGN KEY ("customOrderBookingId") REFERENCES "CustomOrderBooking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomOrderBookingItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CustomOrderBookingItem_customOrderBookingId_idx" ON "CustomOrderBookingItem"("customOrderBookingId");
CREATE INDEX "CustomOrderBookingItem_productId_idx" ON "CustomOrderBookingItem"("productId");
