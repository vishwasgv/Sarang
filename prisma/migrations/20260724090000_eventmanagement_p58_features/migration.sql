-- CreateTable
CREATE TABLE "EventRunOfShowItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "scheduledTime" DATETIME NOT NULL,
    "activity" TEXT NOT NULL,
    "responsibleParty" TEXT,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EventRunOfShowItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "EventBooking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EventVendorBooking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "vendorCategory" TEXT NOT NULL,
    "quotedAmount" DECIMAL NOT NULL,
    "pricingType" TEXT NOT NULL DEFAULT 'FLAT',
    "perHeadRate" DECIMAL,
    "advancePaid" DECIMAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ENQUIRED',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EventVendorBooking_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "EventBooking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventVendorBooking_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_EventVendorBooking" ("advancePaid", "createdAt", "eventId", "id", "notes", "quotedAmount", "status", "updatedAt", "vendorCategory", "vendorId") SELECT "advancePaid", "createdAt", "eventId", "id", "notes", "quotedAmount", "status", "updatedAt", "vendorCategory", "vendorId" FROM "EventVendorBooking";
DROP TABLE "EventVendorBooking";
ALTER TABLE "new_EventVendorBooking" RENAME TO "EventVendorBooking";
CREATE INDEX "EventVendorBooking_eventId_idx" ON "EventVendorBooking"("eventId");
CREATE INDEX "EventVendorBooking_vendorId_idx" ON "EventVendorBooking"("vendorId");
CREATE INDEX "EventVendorBooking_status_idx" ON "EventVendorBooking"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "EventRunOfShowItem_eventId_idx" ON "EventRunOfShowItem"("eventId");
