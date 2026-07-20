-- AlterTable
ALTER TABLE "DeliveryTracker" ADD COLUMN "deliveredPhotosCount" INTEGER;

-- CreateTable
CREATE TABLE "ShootChecklistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shootBookingId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'EQUIPMENT',
    "label" TEXT NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShootChecklistItem_shootBookingId_fkey" FOREIGN KEY ("shootBookingId") REFERENCES "ShootBooking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShootAddOnItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shootBookingId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShootAddOnItem_shootBookingId_fkey" FOREIGN KEY ("shootBookingId") REFERENCES "ShootBooking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ShootChecklistItem_shootBookingId_idx" ON "ShootChecklistItem"("shootBookingId");

-- CreateIndex
CREATE INDEX "ShootAddOnItem_shootBookingId_idx" ON "ShootAddOnItem"("shootBookingId");
