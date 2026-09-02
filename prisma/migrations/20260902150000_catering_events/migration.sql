-- 2026-09-02 — Catering feature (Bakery/Sweet Shop/Catering vertical,
-- catering_events module): a booked event's agreed menu, quoted
-- price-per-plate vs. the final bargained total, per-day meal/snack
-- counts for multi-day events, and per-role staffing cost (cook/server/
-- cleaner all paid differently). Purely additive — 4 new tables, no
-- existing table touched.

CREATE TABLE "CateringEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "eventStartDate" DATETIME NOT NULL,
    "eventEndDate" DATETIME,
    "venueAddress" TEXT,
    "attendeeCount" INTEGER NOT NULL,
    "pricePerPlate" REAL NOT NULL,
    "finalNegotiatedPrice" REAL,
    "advanceAmount" REAL NOT NULL DEFAULT 0,
    "advancePaymentMethod" TEXT NOT NULL DEFAULT 'CASH',
    "status" TEXT NOT NULL DEFAULT 'BOOKED',
    "invoiceId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CateringEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CateringEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CateringEvent_eventNumber_key" ON "CateringEvent"("eventNumber");
CREATE INDEX "CateringEvent_customerId_idx" ON "CateringEvent"("customerId");
CREATE INDEX "CateringEvent_status_idx" ON "CateringEvent"("status");
CREATE INDEX "CateringEvent_eventStartDate_idx" ON "CateringEvent"("eventStartDate");

CREATE TABLE "CateringEventMenuItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cateringEventId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    CONSTRAINT "CateringEventMenuItem_cateringEventId_fkey" FOREIGN KEY ("cateringEventId") REFERENCES "CateringEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CateringEventMenuItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CateringEventMenuItem_cateringEventId_idx" ON "CateringEventMenuItem"("cateringEventId");
CREATE INDEX "CateringEventMenuItem_productId_idx" ON "CateringEventMenuItem"("productId");

CREATE TABLE "CateringEventDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cateringEventId" TEXT NOT NULL,
    "serviceDate" DATETIME NOT NULL,
    "mealsCount" INTEGER NOT NULL DEFAULT 0,
    "snacksCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CateringEventDay_cateringEventId_fkey" FOREIGN KEY ("cateringEventId") REFERENCES "CateringEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CateringEventDay_cateringEventId_idx" ON "CateringEventDay"("cateringEventId");

CREATE TABLE "CateringEventStaff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cateringEventId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "workerCount" INTEGER NOT NULL,
    "ratePerWorker" REAL NOT NULL,
    "serviceDate" DATETIME,
    "amount" REAL NOT NULL,
    CONSTRAINT "CateringEventStaff_cateringEventId_fkey" FOREIGN KEY ("cateringEventId") REFERENCES "CateringEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CateringEventStaff_cateringEventId_idx" ON "CateringEventStaff"("cateringEventId");
